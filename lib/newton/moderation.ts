import { newId } from "@/lib/admin/ids";
import { query, withTransaction } from "@/lib/db";
import { NewtonError } from "@/lib/newton/errors";
import type {
  NewtonModeratedMessage,
  NewtonModerationAction,
  NewtonModerationActionName,
  NewtonModerationState,
  NewtonModerationStateName,
} from "@/lib/newton/types";

type StateRow = {
  account_id: string;
  state: NewtonModerationStateName;
  reason: string | null;
  until: string | null;
  updated_at: string;
};

type ActionRow = {
  id: string;
  account_id: string;
  message_id: string | null;
  action: NewtonModerationActionName;
  reason: string;
  state_after: NewtonModerationStateName;
  until: string | null;
  created_by: string;
  created_at: string;
};

type MessageRow = {
  id: string;
  thread_id: string;
  account_id: string;
  code: string;
  email: string;
  name: string | null;
  content: string;
  created_at: string;
  moderation_status: "visible" | "hidden" | "removed";
  state: NewtonModerationStateName | null;
  reason: string | null;
  until: string | null;
  state_updated_at: string | null;
};

const CLEAR_STATE: NewtonModerationState = {
  state: "clear",
  reason: null,
  until: null,
  updatedAt: null,
};

function effectiveState(row: StateRow | null | undefined): NewtonModerationState {
  if (!row) return CLEAR_STATE;

  const until = row.until ? new Date(row.until) : null;
  const expired = Boolean(until && until.getTime() <= Date.now());

  // Timed restrictions and suspensions expire without an admin action. A
  // "warned" state is informational and never blocks Aria.
  if (expired && (row.state === "restricted" || row.state === "suspended")) {
    return {
      state: "clear",
      reason: null,
      until: null,
      updatedAt: row.updated_at,
    };
  }

  return {
    state: row.state,
    reason: row.reason,
    until: row.until,
    updatedAt: row.updated_at,
  };
}

function toAction(row: ActionRow): NewtonModerationAction {
  return {
    id: row.id,
    accountId: row.account_id,
    messageId: row.message_id,
    action: row.action,
    reason: row.reason,
    stateAfter: row.state_after,
    until: row.until,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function toMessage(row: MessageRow): NewtonModeratedMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    accountId: row.account_id,
    accountCode: row.code,
    accountEmail: row.email,
    accountName: row.name,
    content: row.content,
    createdAt: row.created_at,
    moderationStatus: row.moderation_status,
    moderationState: effectiveState(
      row.state
        ? {
            account_id: row.account_id,
            state: row.state,
            reason: row.reason,
            until: row.until,
            updated_at: row.state_updated_at ?? row.created_at,
          }
        : null,
    ),
  };
}

export async function getModerationState(
  accountId: string,
): Promise<NewtonModerationState> {
  try {
    const result = await query<StateRow>(
      `select account_id, state, reason, until, updated_at
         from newton_moderation_state
        where account_id = $1
        limit 1`,
      [accountId],
    );
    return effectiveState(result.rows[0]);
  } catch {
    return CLEAR_STATE;
  }
}

/** Throws a friendly 403 when Aria is restricted, suspended or terminated. */
export async function assertAriaAllowed(accountId: string) {
  const state = await getModerationState(accountId);

  if (state.state === "clear" || state.state === "warned") {
    return state;
  }

  const until = state.until
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Bahrain",
      }).format(new Date(state.until))
    : null;

  const suffix = until ? ` This ends on ${until}.` : "";
  const reason = state.reason ? ` Reason: ${state.reason}` : "";

  throw new NewtonError(
    `Aria access is ${state.state} for this account.${reason}${suffix} Contact Xenon Tech if you think this is a mistake.`,
    403,
    `newton_moderation_${state.state}`,
  );
}

export async function listModerationActions(
  limit = 40,
): Promise<NewtonModerationAction[]> {
  const result = await query<ActionRow>(
    `select id, account_id, message_id, action, reason, state_after,
            until, created_by, created_at
       from newton_moderation_actions
      order by created_at desc
      limit $1`,
    [Math.min(Math.max(limit, 1), 200)],
  );

  return result.rows.map(toAction);
}

export async function listRecentAriaMessages(
  limit = 60,
): Promise<NewtonModeratedMessage[]> {
  const result = await query<MessageRow>(
    `select m.id,
            m.thread_id,
            m.account_id,
            a.code,
            a.email,
            a.name,
            m.content,
            m.created_at,
            m.moderation_status,
            s.state,
            s.reason,
            s.until,
            s.updated_at as state_updated_at
       from newton_messages m
       join accounts a on a.id = m.account_id
       left join newton_moderation_state s on s.account_id = m.account_id
      where m.role = 'user'
      order by m.created_at desc
      limit $1`,
    [Math.min(Math.max(limit, 1), 200)],
  );

  return result.rows.map(toMessage);
}

export async function getModerationOverview() {
  const [counts, messages, actions] = await Promise.all([
    query<{ state: NewtonModerationStateName; count: number }>(
      `select state, count(*)::int as count
         from newton_moderation_state
        group by state`,
    ),
    listRecentAriaMessages(50),
    listModerationActions(30),
  ]);

  const byState: Record<NewtonModerationStateName, number> = {
    clear: 0,
    warned: 0,
    restricted: 0,
    suspended: 0,
    terminated: 0,
  };
  for (const row of counts.rows) {
    byState[row.state] = Number(row.count ?? 0);
  }

  return {
    byState,
    messages,
    actions,
    hiddenMessages: messages.filter(
      (message) => message.moderationStatus !== "visible",
    ).length,
  };
}

export type ModerationActionInput = {
  accountId: string;
  action: NewtonModerationActionName;
  reason: string;
  messageId?: string | null;
  until?: Date | null;
  actor: string;
};

function nextStateFor(
  action: NewtonModerationActionName,
  current: NewtonModerationStateName,
): NewtonModerationStateName {
  switch (action) {
    case "warn":
      return "warned";
    case "restrict":
      return "restricted";
    case "suspend":
      return "suspended";
    case "terminate":
      return "terminated";
    case "lift":
      return "clear";
    default:
      return current;
  }
}

export async function applyModerationAction(
  input: ModerationActionInput,
): Promise<NewtonModerationState> {
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new NewtonError(
      "Add a short reason so the decision is auditable.",
      422,
      "reason_required",
    );
  }
  if (reason.length > 1000) {
    throw new NewtonError("Keep the reason under 1,000 characters.", 422, "reason_too_long");
  }

  return withTransaction(async (client) => {
    const currentResult = await client.query<StateRow>(
      `select account_id, state, reason, until, updated_at
         from newton_moderation_state
        where account_id = $1
        for update`,
      [input.accountId],
    );
    const current = currentResult.rows[0];
    const currentState: NewtonModerationStateName = current?.state ?? "clear";

    if (input.messageId && (input.action === "hide" || input.action === "restore")) {
      const message = await client.query<{ id: string; account_id: string }>(
        `select id, account_id from newton_messages
          where id = $1 and account_id = $2
          limit 1`,
        [input.messageId, input.accountId],
      );
      if (!message.rows[0]) {
        throw new NewtonError(
          "That Aria message was not found.",
          404,
          "message_not_found",
        );
      }

      await client.query(
        `update newton_messages
            set moderation_status = $2,
                moderated_at = now(),
                moderated_by = $3
          where id = $1`,
        [
          input.messageId,
          input.action === "hide" ? "hidden" : "visible",
          input.actor,
        ],
      );

      await client.query(
        `insert into newton_moderation_actions
           (id, account_id, message_id, action, reason, state_after, until, created_by)
         values ($1, $2, $3, $4, $5, $6, null, $7)`,
        [
          newId(),
          input.accountId,
          input.messageId,
          input.action,
          reason,
          currentState,
          input.actor,
        ],
      );

      return effectiveState(current);
    }

    if (
      input.action !== "warn" &&
      input.action !== "restrict" &&
      input.action !== "suspend" &&
      input.action !== "terminate" &&
      input.action !== "lift"
    ) {
      throw new NewtonError(
        "Choose a moderation action.",
        422,
        "invalid_action",
      );
    }

    const stateAfter = nextStateFor(input.action, currentState);
    let until: Date | null = null;

    if (input.action === "restrict") {
      until = input.until ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
    } else if (input.action === "suspend") {
      until = input.until ?? null;
    }

    const result = await client.query<StateRow>(
      `insert into newton_moderation_state
         (account_id, state, reason, until, updated_by, updated_at)
       values ($1, $2, $3, $4, $5, now())
       on conflict (account_id) do update
         set state = excluded.state,
             reason = excluded.reason,
             until = excluded.until,
             updated_by = excluded.updated_by,
             updated_at = now()
       returning account_id, state, reason, until, updated_at`,
      [
        input.accountId,
        stateAfter,
        input.action === "lift" ? null : reason,
        until,
        input.actor,
      ],
    );

    if (input.action === "terminate") {
      // Terminating Newton access also closes every open Aria chat so the
      // account cannot continue from a stale tab.
      await client.query(
        `update newton_threads
            set archived_at = now(), updated_at = now()
          where account_id = $1 and archived_at is null`,
        [input.accountId],
      );
    }

    await client.query(
      `insert into newton_moderation_actions
         (id, account_id, message_id, action, reason, state_after, until, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        newId(),
        input.accountId,
        input.messageId ?? null,
        input.action,
        reason,
        stateAfter,
        until,
        input.actor,
      ],
    );

    await client.query(
      `insert into audit_log (id, actor, action, entity_type, entity_id, details)
       values ($1, $2, 'newton_moderation_action', 'account', $3, $4::jsonb)`,
      [
        newId(),
        input.actor,
        input.accountId,
        JSON.stringify({
          action: input.action,
          stateAfter,
          reason,
          messageId: input.messageId ?? null,
          until: until?.toISOString() ?? null,
        }),
      ],
    );

    return effectiveState(result.rows[0]);
  });
}
