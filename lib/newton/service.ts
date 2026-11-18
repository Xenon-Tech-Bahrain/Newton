import { newId } from "@/lib/admin/ids";
import { checkRateLimit } from "@/lib/admin/rate-limit";
import { query, withTransaction } from "@/lib/db";
import { newtonLimits } from "@/lib/newton/config";
import { NewtonError } from "@/lib/newton/errors";
import type { ChatMessage, TokenUsage } from "@/lib/newton/aria";
import type {
  NewtonAttachment,
  NewtonMessage,
  NewtonThreadSummary,
  NewtonUsage,
} from "@/lib/newton/types";

export type {
  NewtonAttachment,
  NewtonMessage,
  NewtonThreadSummary,
  NewtonUsage,
};

type ThreadRow = {
  id: string;
  title: string | null;
  model: string | null;
  updated_at: string;
  last_message_at: string | null;
  message_count: number;
};

type MessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model: string | null;
  total_tokens: number | null;
  created_at: string;
  attachments: string | null;
};

function toThreadSummary(row: ThreadRow): NewtonThreadSummary {
  return {
    id: row.id,
    title: row.title?.trim() || "New conversation",
    model: row.model,
    updatedAt: row.updated_at,
    lastMessageAt: row.last_message_at,
    messageCount: Number(row.message_count ?? 0),
  };
}

function toMessage(row: MessageRow): NewtonMessage {
  let attachments: NewtonAttachment[] = [];
  if (row.attachments) {
    try {
      attachments = JSON.parse(row.attachments);
    } catch {
      attachments = [];
    }
  }
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    model: row.model,
    totalTokens: row.total_tokens === null ? null : Number(row.total_tokens),
    createdAt: row.created_at,
    attachments,
  };
}

/**
 * Turns a first message into a short, readable chat title. No model call: the
 * title must exist even if the reply fails halfway through.
 */
export function titleFromPrompt(prompt: string) {
  const cleaned = prompt.replace(/\s+/g, " ").trim();
  if (!cleaned) return "New conversation";

  if (cleaned.length <= 56) return cleaned;

  const clipped = cleaned.slice(0, 56);
  const lastSpace = clipped.lastIndexOf(" ");
  const title = (lastSpace > 24 ? clipped.slice(0, lastSpace) : clipped).trim();
  return `${title.replace(/[.,;:!?-]+$/, "")}…`;
}

export async function listThreads(
  accountId: string,
): Promise<NewtonThreadSummary[]> {
  const result = await query<ThreadRow>(
    `select t.id,
            t.title,
            t.model,
            t.updated_at,
            t.last_message_at,
            (
              select count(*)::int
                from newton_messages m
               where m.thread_id = t.id
            ) as message_count
       from newton_threads t
      where t.account_id = $1
        and t.archived_at is null
      order by coalesce(t.last_message_at, t.created_at) desc
      limit 100`,
    [accountId],
  );

  return result.rows.map(toThreadSummary);
}

export async function createThread(accountId: string, title?: string) {
  const limits = newtonLimits();

  const count = await query<{ count: number }>(
    `select count(*)::int as count
       from newton_threads
      where account_id = $1 and archived_at is null`,
    [accountId],
  );

  if (Number(count.rows[0]?.count ?? 0) >= limits.maxThreadsPerAccount) {
    throw new NewtonError(
      "You have reached the maximum number of saved chats. Delete an old chat to start a new one.",
      429,
      "thread_limit",
    );
  }

  const id = newId();
  const result = await query<ThreadRow>(
    `insert into newton_threads (id, account_id, title, created_at, updated_at)
     values ($1, $2, $3, now(), now())
     returning id, title, model, updated_at, last_message_at,
               0::int as message_count`,
    [id, accountId, title?.trim() || null],
  );

  return toThreadSummary(result.rows[0]);
}

export async function getThread(accountId: string, threadId: string) {
  const thread = await query<ThreadRow>(
    `select t.id,
            t.title,
            t.model,
            t.updated_at,
            t.last_message_at,
            (
              select count(*)::int
                from newton_messages m
               where m.thread_id = t.id
            ) as message_count
       from newton_threads t
      where t.id = $1
        and t.account_id = $2
        and t.archived_at is null
      limit 1`,
    [threadId, accountId],
  );

  const row = thread.rows[0];
  if (!row) {
    throw new NewtonError("That chat was not found.", 404, "thread_not_found");
  }

  const messages = await query<MessageRow>(
    `select id, role, content, model, total_tokens, created_at
       from newton_messages
      where thread_id = $1
        and moderation_status = 'visible'
      order by created_at asc,
               case when role = 'user' then 0 else 1 end asc`,
    [threadId],
  );

  return {
    thread: toThreadSummary(row),
    messages: messages.rows.map(toMessage),
  };
}

/**
 * Cheap ownership check used before a provider call, so a forged thread id
 * never reaches Gemini and never gets a user message written for it.
 */
export async function assertThreadOwned(accountId: string, threadId: string) {
  const result = await query<{ id: string }>(
    `select id
       from newton_threads
      where id = $1 and account_id = $2 and archived_at is null
      limit 1`,
    [threadId, accountId],
  );

  if (!result.rows[0]) {
    throw new NewtonError("That chat was not found.", 404, "thread_not_found");
  }
}

export async function renameThread({
  accountId,
  threadId,
  title,
}: {
  accountId: string;
  threadId: string;
  title: string;
}) {
  const result = await query<ThreadRow>(
    `update newton_threads
        set title = $3,
            updated_at = now()
      where id = $1 and account_id = $2 and archived_at is null
      returning id, title, model, updated_at, last_message_at,
                (select count(*)::int from newton_messages m where m.thread_id = $1) as message_count`,
    [threadId, accountId, title.trim()],
  );

  const row = result.rows[0];
  if (!row) {
    throw new NewtonError("That chat was not found.", 404, "thread_not_found");
  }

  return toThreadSummary(row);
}

export async function deleteThread(accountId: string, threadId: string) {
  const result = await query<{ id: string }>(
    `delete from newton_threads
      where id = $1 and account_id = $2
      returning id`,
    [threadId, accountId],
  );

  if (!result.rows[0]) {
    throw new NewtonError("That chat was not found.", 404, "thread_not_found");
  }
}

export async function getUsageToday(accountId: string): Promise<NewtonUsage> {
  const result = await query<{
    requests: number;
    prompt_tokens: string;
    completion_tokens: string;
  }>(
    `select requests, prompt_tokens, completion_tokens
       from newton_usage_daily
      where account_id = $1 and day = current_date
      limit 1`,
    [accountId],
  );

  const row = result.rows[0];
  const promptTokens = Number(row?.prompt_tokens ?? 0);
  const completionTokens = Number(row?.completion_tokens ?? 0);

  return {
    requests: Number(row?.requests ?? 0),
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
}

/**
 * Per-account quota gate. Runs before any provider call so a scripted client
 * cannot burn the Gemini budget faster than the limits allow.
 */
export async function enforceMessageQuota(accountId: string) {
  const limits = newtonLimits();

  const burst = await checkRateLimit(
    `newton:minute:${accountId}`,
    limits.requestsPerMinute,
    60 * 1000,
  );

  if (!burst.allowed) {
    const seconds = Math.max(1, burst.retryAfterSeconds);
    throw new NewtonError(
      `You are sending messages too quickly. Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`,
      429,
      "rate_limited",
    );
  }

  const usage = await getUsageToday(accountId);

  if (usage.requests >= limits.messagesPerDay) {
    throw new NewtonError(
      `You have reached today's limit of ${limits.messagesPerDay} Aria messages. The limit resets at midnight Bahrain time.`,
      429,
      "quota_messages",
    );
  }

  if (usage.totalTokens >= limits.tokensPerDay) {
    throw new NewtonError(
      "You have used today's Aria allowance. It resets at midnight Bahrain time.",
      429,
      "quota_tokens",
    );
  }
}

export async function registerRequest(accountId: string) {
  await query(
    `insert into newton_usage_daily (account_id, day, requests, updated_at)
     values ($1, current_date, 1, now())
     on conflict (account_id, day) do update
       set requests = newton_usage_daily.requests + 1,
           updated_at = now()`,
    [accountId],
  );
}

export async function recordTokenUsage(
  accountId: string,
  usage: TokenUsage,
) {
  if (usage.prompt === 0 && usage.completion === 0) return;

  await query(
    `insert into newton_usage_daily
       (account_id, day, requests, prompt_tokens, completion_tokens, updated_at)
     values ($1, current_date, 0, $2, $3, now())
     on conflict (account_id, day) do update
       set prompt_tokens = newton_usage_daily.prompt_tokens + $2,
           completion_tokens = newton_usage_daily.completion_tokens + $3,
           updated_at = now()`,
    [accountId, usage.prompt, usage.completion],
  );
}

export async function saveUserMessage({
  threadId,
  accountId,
  content,
  attachments,
}: {
  threadId: string;
  accountId: string;
  content: string;
  attachments?: NewtonAttachment[];
}) {
  const id = newId();
  const attachmentsJson = attachments && attachments.length > 0
    ? JSON.stringify(attachments)
    : "[]";
  const result = await query<{ id: string; created_at: string }>(
    `insert into newton_messages (id, thread_id, account_id, role, content, attachments, created_at)
     select $1, t.id, t.account_id, 'user', $3, $4, now()
       from newton_threads t
      where t.id = $2 and t.account_id = $5 and t.archived_at is null
      returning id, created_at`,
    [id, threadId, content, attachmentsJson, accountId],
  );

  if (!result.rows[0]) {
    throw new NewtonError("That chat was not found.", 404, "thread_not_found");
  }

  return result.rows[0];
}

/**
 * Persists Aria's finished reply and rolls the thread metadata forward. Runs in
 * one transaction so a crash cannot leave a message without its thread update.
 */
export async function saveAssistantMessage({
  threadId,
  accountId,
  content,
  model,
  usage,
  latencyMs,
  finishReason,
  titleIfEmpty,
}: {
  threadId: string;
  accountId: string;
  content: string;
  model: string | null;
  usage: TokenUsage;
  latencyMs: number;
  finishReason: string | null;
  titleIfEmpty: string;
}) {
  const id = newId();
  const body = content.trim() || "Aria did not return a reply. Please try again.";

  await withTransaction(async (client) => {
    await client.query(
      `insert into newton_messages
         (id, thread_id, account_id, role, content, model,
          prompt_tokens, completion_tokens, total_tokens, latency_ms,
          finish_reason, created_at)
       values ($1, $2, $3, 'assistant', $4, $5, $6, $7, $8, $9, $10, now())`,
      [
        id,
        threadId,
        accountId,
        body,
        model,
        usage.prompt,
        usage.completion,
        usage.total,
        latencyMs,
        finishReason,
      ],
    );

    await client.query(
      `update newton_threads
          set model = coalesce($3, model),
              title = coalesce(title, $4),
              last_message_at = now(),
              updated_at = now()
        where id = $1 and account_id = $2`,
      [threadId, accountId, model, titleIfEmpty],
    );
  });

  return { id, content: body };
}

/**
 * Builds the message window sent to Aria: system prompt, then as much recent
 * history as fits, always ending with the user's newest message.
 */
export async function buildChatHistory({
  threadId,
  accountId,
  systemPrompt,
}: {
  threadId: string;
  accountId: string;
  systemPrompt: string;
}): Promise<ChatMessage[]> {
  const limits = newtonLimits();
  const result = await query<{ role: "user" | "assistant"; content: string }>(
    `select role, content
       from (
         select role, content, created_at, id
           from newton_messages
          where thread_id = $1 and account_id = $2
            and moderation_status = 'visible'
          order by created_at desc, id desc
          limit $3
       ) recent
      order by created_at asc, id asc`,
    [threadId, accountId, limits.maxHistoryMessages],
  );

  const history: ChatMessage[] = [];
  let budget = 24_000;

  for (let index = result.rows.length - 1; index >= 0; index -= 1) {
    const row = result.rows[index];
    const cost = row.content.length;
    if (cost > budget && history.length > 0) break;
    history.unshift({ role: row.role, content: row.content });
    budget -= cost;
    if (budget <= 0) break;
  }

  return [{ role: "system", content: systemPrompt }, ...history];
}

export async function getNewtonAdminOverview() {
  const [today, totals, days, topAccounts] = await Promise.all([
    query<{ requests: number; tokens: string; accounts: number }>(
      `select coalesce(sum(requests), 0)::int as requests,
              coalesce(sum(prompt_tokens), 0)::bigint
                + coalesce(sum(completion_tokens), 0)::bigint as tokens,
              count(distinct account_id)::int as accounts
         from newton_usage_daily
        where day = current_date`,
    ),
    query<{ threads: number; messages: number }>(
      `select (select count(*)::int from newton_threads) as threads,
              (select count(*)::int from newton_messages) as messages`,
    ),
    query<{ day: string; requests: number; tokens: string }>(
      `select day::text as day,
              coalesce(sum(requests), 0)::int as requests,
              coalesce(sum(prompt_tokens), 0)::bigint
                + coalesce(sum(completion_tokens), 0)::bigint as tokens
         from newton_usage_daily
        where day > current_date - interval '14 days'
        group by day
        order by day desc`,
    ),
    query<{
      account_id: string;
      code: string;
      email: string;
      name: string | null;
      requests: number;
      tokens: string;
    }>(
      `select u.account_id,
              a.code,
              a.email,
              a.name,
              coalesce(sum(u.requests), 0)::int as requests,
              coalesce(sum(u.prompt_tokens), 0)::bigint
                + coalesce(sum(u.completion_tokens), 0)::bigint as tokens
         from newton_usage_daily u
         join accounts a on a.id = u.account_id
        where u.day > current_date - interval '7 days'
        group by u.account_id, a.code, a.email, a.name
        order by tokens desc
        limit 12`,
    ),
  ]);

  return {
    today: {
      requests: Number(today.rows[0]?.requests ?? 0),
      tokens: Number(today.rows[0]?.tokens ?? 0),
      accounts: Number(today.rows[0]?.accounts ?? 0),
    },
    totals: {
      threads: Number(totals.rows[0]?.threads ?? 0),
      messages: Number(totals.rows[0]?.messages ?? 0),
    },
    days: days.rows.map((row) => ({
      day: row.day,
      requests: Number(row.requests ?? 0),
      tokens: Number(row.tokens ?? 0),
    })),
    topAccounts: topAccounts.rows.map((row) => ({
      accountId: row.account_id,
      code: row.code,
      email: row.email,
      name: row.name,
      requests: Number(row.requests ?? 0),
      tokens: Number(row.tokens ?? 0),
    })),
  };
}

/** Removes every trace of a customer's Aria history. */
export async function purgeNewtonData(accountId: string) {
  await query(`delete from newton_messages where account_id = $1`, [accountId]);
  await query(`delete from newton_threads where account_id = $1`, [accountId]);
  await query(`delete from newton_usage_daily where account_id = $1`, [
    accountId,
  ]);
}
