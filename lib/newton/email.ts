import { newId } from "@/lib/admin/ids";
import { query, withTransaction } from "@/lib/db";
import { NewtonError } from "@/lib/newton/errors";
import type {
  NewtonEmailMessage,
  NewtonEmailThreadStatus,
  NewtonEmailThreadSummary,
} from "@/lib/newton/types";
import {
  emailNotConfiguredMessage,
  escapeHtml,
  getMailTransport,
} from "@/lib/email/transport";

type ThreadRow = {
  id: string;
  thread_key: string;
  from_email: string;
  from_name: string | null;
  subject: string;
  status: NewtonEmailThreadStatus;
  last_message_at: string;
  created_at: string;
  message_count?: number;
};

type MessageRow = {
  id: string;
  thread_id: string;
  direction: "inbound" | "outbound";
  from_email: string;
  from_name: string | null;
  to_email: string;
  subject: string;
  body: string;
  auto_reply: boolean;
  sender_role: string | null;
  sent_by: string | null;
  status: "received" | "sent" | "failed";
  provider_message_id: string | null;
  error: string | null;
  created_at: string;
};

export type ParsedInboundEmail = {
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  subject: string;
  text: string;
  html: string | null;
  providerMessageId: string | null;
};

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const text = stringValue(value);
    if (text) return text;
  }
  return "";
}

function extractEmail(value: string) {
  const match = value.match(EMAIL_PATTERN);
  return match ? match[0].toLowerCase() : "";
}

function extractName(value: string) {
  const match = value.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>/);
  return match ? match[1].trim().slice(0, 160) : null;
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function normaliseSubject(value: string) {
  const subject = value.replace(/[\r\n]+/g, " ").trim();
  return subject.slice(0, 240) || "(no subject)";
}

function baseSubject(value: string) {
  return normaliseSubject(value)
    .replace(/^(re|fwd|fw)\s*:\s*/gi, "")
    .trim()
    .toLowerCase()
    .slice(0, 200);
}

export function threadKeyFor(fromEmail: string, subject: string) {
  return `${fromEmail.toLowerCase()}::${baseSubject(subject)}`;
}

/**
 * Inbound providers all send slightly different JSON. Normalise the common
 * shapes (generic webhook, Postmark, SendGrid inbound parse and Mailgun) rather
 * than tying Newton to a single vendor.
 */
export function parseInboundEmail(raw: unknown): ParsedInboundEmail {
  if (!raw || typeof raw !== "object") {
    throw new NewtonError("Email payload must be an object.", 400, "invalid_email");
  }

  const payload = raw as Record<string, unknown>;
  const envelope =
    payload.envelope && typeof payload.envelope === "object"
      ? (payload.envelope as Record<string, unknown>)
      : {};

  const fromRaw = firstString(
    payload.from,
    payload.From,
    payload.sender,
    payload.from_email,
    payload.fromEmail,
    envelope.from,
  );
  const fromEmail = extractEmail(fromRaw);
  if (!fromEmail) {
    throw new NewtonError(
      "The email payload has no valid sender address.",
      422,
      "invalid_sender",
    );
  }

  const toRaw = firstString(
    payload.to,
    payload.To,
    payload.recipient,
    payload.to_email,
    payload.toEmail,
    envelope.to,
  );
  const html = firstString(payload.html, payload.Html, payload.body_html);
  const text =
    firstString(
      payload.text,
      payload.Text,
      payload.plain,
      payload.body,
      payload.body_text,
      payload["stripped-text"],
    ) || (html ? stripHtml(html) : "");

  const name =
    firstString(payload.fromName, payload.from_name, payload.name) ||
    extractName(fromRaw);

  return {
    fromEmail,
    fromName: name ? name.slice(0, 160) : null,
    toEmail:
      extractEmail(toRaw) ||
      stringValue(process.env.EMAIL_REPLY_TO) ||
      stringValue(process.env.GMAIL_USER) ||
      "unknown",
    subject: normaliseSubject(
      firstString(payload.subject, payload.Subject, payload.title),
    ),
    text: text.slice(0, 50_000),
    html: html ? html.slice(0, 100_000) : null,
    providerMessageId:
      firstString(
        payload.messageId,
        payload["Message-Id"],
        payload.message_id,
        payload.MessageID,
        payload["message-id"],
        payload.id,
      ) || null,
  };
}

function autoReplyBody(parsed: ParsedInboundEmail, threadId: string) {
  const name = parsed.fromName?.trim();
  return `Hi ${name || "there"},

Thank you for emailing Xenon Tech${name ? `, ${name}` : ""}. Your message has reached us and is in the queue for a response.

Please wait for a response from a member of our team. We aim to reply as soon as possible during our normal working hours. If your message is about an urgent repair, WhatsApp is usually the fastest way to reach us.

Reference: ${threadId.slice(0, 8).toUpperCase()}
Subject: ${parsed.subject}

Your original message:
${parsed.text || "(no message body)"}

Xenon Tech
Bahrain`;
}

function autoReplyHtml(parsed: ParsedInboundEmail, threadId: string, body: string) {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f3f7fb;font-family:Arial,Helvetica,sans-serif;color:#0a2540;">
    <div style="max-width:620px;margin:0 auto;padding:28px 16px;">
      <div style="border-radius:24px;overflow:hidden;background:#ffffff;border:1px solid #e5edf5;">
        <div style="background:#0a2540;padding:30px 28px;color:#ffffff;">
          <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#67c3ff;">Xenon Tech</div>
          <h1 style="margin:10px 0 0;font-size:28px;line-height:1.25;">We received your email.</h1>
          <p style="margin:10px 0 0;color:#c8d8e8;font-size:14px;line-height:1.6;">Reference ${escapeHtml(threadId.slice(0, 8).toUpperCase())}</p>
        </div>
        <div style="padding:28px;font-size:15px;line-height:1.75;color:#315578;">
          <p style="margin:0 0 14px;">Hi ${escapeHtml(parsed.fromName || "there")},</p>
          <p style="margin:0 0 14px;">Thank you for emailing Xenon Tech. Your message has reached us and is in the queue for a response.</p>
          <p style="margin:0 0 14px;"><strong>Please wait for a response</strong> from a member of our team. We aim to reply as soon as possible during our normal working hours.</p>
          <p style="margin:0 0 14px;">If your message is about an urgent repair, WhatsApp is usually the fastest way to reach us.</p>
          <div style="border-radius:14px;background:#f6f9fd;border:1px solid #e5edf5;padding:16px;margin:18px 0;">
            <p style="margin:0 0 6px;font-size:12px;color:#6b8eaf;">Subject</p>
            <p style="margin:0 0 12px;">${escapeHtml(parsed.subject)}</p>
            <p style="margin:0 0 6px;font-size:12px;color:#6b8eaf;">Your message</p>
            <p style="margin:0;white-space:pre-wrap;">${escapeHtml(parsed.text || "(no message body)")}</p>
          </div>
          <p style="margin:0;font-size:13px;color:#6b8eaf;">Please do not send passwords or sensitive personal data by email.</p>
        </div>
        <div style="padding:18px 28px;background:#f6f9fd;font-size:12px;line-height:1.6;color:#6b8eaf;">
          Xenon Tech - Bahrain<br />
          This is an automatic acknowledgement. Replies reach our team directly.
        </div>
      </div>
    </div>
  </body>
</html>`;
}

async function sendPlainEmail({
  to,
  subject,
  text,
  html,
  replyTo,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}) {
  const transport = getMailTransport();
  if (!transport) {
    return { ok: false as const, error: emailNotConfiguredMessage() };
  }

  try {
    const info = await transport.transporter.sendMail({
      from: transport.from,
      to,
      replyTo: replyTo || transport.replyTo,
      subject,
      text,
      html,
    });
    return { ok: true as const, messageId: info.messageId };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Unknown email error",
    };
  }
}

function toThread(row: ThreadRow): NewtonEmailThreadSummary {
  return {
    id: row.id,
    fromEmail: row.from_email,
    fromName: row.from_name,
    subject: row.subject,
    status: row.status,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    messageCount: Number(row.message_count ?? 0),
  };
}

function toMessage(row: MessageRow): NewtonEmailMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    direction: row.direction,
    fromEmail: row.from_email,
    fromName: row.from_name,
    toEmail: row.to_email,
    subject: row.subject,
    body: row.body,
    autoReply: Boolean(row.auto_reply),
    senderRole: row.sender_role,
    sentBy: row.sent_by,
    status: row.status,
    providerMessageId: row.provider_message_id,
    error: row.error,
    createdAt: row.created_at,
  };
}

export async function processInboundEmail(raw: unknown) {
  const parsed = parseInboundEmail(raw);
  const threadKey = threadKeyFor(parsed.fromEmail, parsed.subject);

  const thread = await withTransaction(async (client) => {
    const threadResult = await client.query<ThreadRow>(
      `insert into newton_email_threads
         (id, thread_key, from_email, from_name, subject, status, last_message_at)
       values ($1, $2, $3, $4, $5, 'open', now())
       on conflict (thread_key) do update
         set from_name = coalesce(excluded.from_name, newton_email_threads.from_name),
             subject = case
                         when newton_email_threads.subject = '(no subject)'
                         then excluded.subject
                         else newton_email_threads.subject
                       end,
             status = case
                        when newton_email_threads.status = 'closed' then 'open'
                        else newton_email_threads.status
                      end,
             last_message_at = now(),
             updated_at = now()
       returning id, thread_key, from_email, from_name, subject, status,
                 last_message_at, created_at`,
      [
        newId(),
        threadKey,
        parsed.fromEmail,
        parsed.fromName,
        parsed.subject,
      ],
    );

    const row = threadResult.rows[0];

    await client.query(
      `insert into newton_email_messages
         (id, thread_id, direction, from_email, from_name, to_email,
          subject, body, auto_reply, status, provider_message_id)
       values ($1, $2, 'inbound', $3, $4, $5, $6, $7, false, 'received', $8)`,
      [
        newId(),
        row.id,
        parsed.fromEmail,
        parsed.fromName,
        parsed.toEmail,
        parsed.subject,
        parsed.text || "(no message body)",
        parsed.providerMessageId,
      ],
    );

    return row;
  });

  const body = autoReplyBody(parsed, thread.id);
  const subject = `Re: ${parsed.subject}`.slice(0, 240);
  const sent = await sendPlainEmail({
    to: parsed.fromEmail,
    subject,
    text: body,
    html: autoReplyHtml(parsed, thread.id, body),
    replyTo:
      stringValue(process.env.EMAIL_REPLY_TO) ||
      stringValue(process.env.GMAIL_USER) ||
      undefined,
  });

  const transport = getMailTransport();
  const fromEmail =
    extractEmail(transport?.replyTo || "") ||
    stringValue(process.env.GMAIL_USER) ||
    stringValue(process.env.SMTP_USER) ||
    "xenon";

  await query(
    `insert into newton_email_messages
       (id, thread_id, direction, from_email, from_name, to_email,
        subject, body, auto_reply, sender_role, sent_by, status,
        provider_message_id, error)
     values ($1, $2, 'outbound', $3, 'Xenon Tech', $4, $5, $6, true,
             'automatic', 'auto-reply', $7, $8, $9)`,
    [
      newId(),
      thread.id,
      fromEmail,
      parsed.fromEmail,
      subject,
      body,
      sent.ok ? "sent" : "failed",
      sent.ok ? sent.messageId : null,
      sent.ok ? null : sent.error,
    ],
  );

  await query(
    `update newton_email_threads
        set last_message_at = now(), updated_at = now()
      where id = $1`,
    [thread.id],
  );

  return {
    threadId: thread.id,
    autoReplySent: sent.ok,
    autoReplyError: sent.ok ? null : sent.error,
  };
}

export async function listEmailThreads(options?: {
  status?: NewtonEmailThreadStatus | "all";
  q?: string;
  limit?: number;
}): Promise<NewtonEmailThreadSummary[]> {
  const status = options?.status ?? "all";
  const q = options?.q?.trim() ?? "";
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 200);

  const result = await query<ThreadRow>(
    `select t.id, t.thread_key, t.from_email, t.from_name, t.subject,
            t.status, t.last_message_at, t.created_at,
            (select count(*)::int from newton_email_messages m
              where m.thread_id = t.id) as message_count
       from newton_email_threads t
      where ($1 = 'all' or t.status = $1)
        and (
          $2 = '' or
          lower(t.from_email) like lower('%' || $2 || '%') or
          lower(coalesce(t.from_name, '')) like lower('%' || $2 || '%') or
          lower(t.subject) like lower('%' || $2 || '%')
        )
      order by t.last_message_at desc
      limit $3`,
    [status, q, limit],
  );

  return result.rows.map(toThread);
}

export async function getEmailThread(id: string) {
  const threadResult = await query<ThreadRow>(
    `select id, thread_key, from_email, from_name, subject, status,
            last_message_at, created_at
       from newton_email_threads
      where id = $1
      limit 1`,
    [id],
  );

  const thread = threadResult.rows[0];
  if (!thread) {
    throw new NewtonError("That email thread was not found.", 404, "email_not_found");
  }

  const messages = await query<MessageRow>(
    `select id, thread_id, direction, from_email, from_name, to_email,
            subject, body, auto_reply, sender_role, sent_by, status,
            provider_message_id, error, created_at
       from newton_email_messages
      where thread_id = $1
      order by created_at asc`,
    [id],
  );

  return {
    thread: toThread(thread),
    messages: messages.rows.map(toMessage),
  };
}

export type AdminEmailReplyInput = {
  threadId: string;
  adminName: string;
  adminRole: string;
  body: string;
  actor: string;
};

export async function replyToEmailThread(input: AdminEmailReplyInput) {
  const adminName = input.adminName.trim();
  const adminRole = input.adminRole.trim();
  const body = input.body.trim();

  if (adminName.length < 2) {
    throw new NewtonError(
      "Add the name of the person replying.",
      422,
      "name_required",
    );
  }
  if (adminRole.length < 2) {
    throw new NewtonError("Add the sender's role.", 422, "role_required");
  }
  if (body.length < 2) {
    throw new NewtonError("Write a reply message.", 422, "message_required");
  }

  const { thread } = await getEmailThread(input.threadId);
  const subject = `Re: ${thread.subject}`.replace(/^Re:\s*Re:/i, "Re:").slice(0, 240);

  const transport = getMailTransport();
  const fromEmail =
    extractEmail(transport?.replyTo || "") ||
    stringValue(process.env.GMAIL_USER) ||
    stringValue(process.env.SMTP_USER) ||
    "xenon";

  const signature = `\n\n${adminName}\n${adminRole}\nXenon Tech`;
  const text = `${body}${signature}`;
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f3f7fb;font-family:Arial,Helvetica,sans-serif;color:#0a2540;">
    <div style="max-width:620px;margin:0 auto;padding:28px 16px;">
      <div style="border-radius:24px;overflow:hidden;background:#ffffff;border:1px solid #e5edf5;">
        <div style="padding:26px 28px;font-size:15px;line-height:1.75;color:#315578;white-space:pre-wrap;">${escapeHtml(body)}</div>
        <div style="padding:18px 28px;background:#f6f9fd;font-size:13px;line-height:1.6;color:#315578;">
          <strong>${escapeHtml(adminName)}</strong><br />
          ${escapeHtml(adminRole)}<br />
          Xenon Tech - Bahrain
        </div>
      </div>
    </div>
  </body>
</html>`;

  const sent = await sendPlainEmail({
    to: thread.fromEmail,
    subject,
    text,
    html,
    replyTo:
      stringValue(process.env.EMAIL_REPLY_TO) ||
      stringValue(process.env.GMAIL_USER) ||
      undefined,
  });

  const messageId = newId();
  await query(
    `insert into newton_email_messages
       (id, thread_id, direction, from_email, from_name, to_email,
        subject, body, auto_reply, sender_role, sent_by, status,
        provider_message_id, error)
     values ($1, $2, 'outbound', $3, $4, $5, $6, $7, false, $8, $9, $10, $11, $12)`,
    [
      messageId,
      input.threadId,
      fromEmail,
      adminName,
      thread.fromEmail,
      subject,
      body,
      adminRole,
      input.actor,
      sent.ok ? "sent" : "failed",
      sent.ok ? sent.messageId : null,
      sent.ok ? null : sent.error,
    ],
  );

  await query(
    `update newton_email_threads
        set status = 'replied',
            last_message_at = now(),
            updated_at = now()
      where id = $1`,
    [input.threadId],
  );

  if (!sent.ok) {
    throw new NewtonError(
      `The reply was recorded but email delivery failed: ${sent.error}`,
      502,
      "email_failed",
    );
  }

  return { messageId, subject, to: thread.fromEmail };
}

export async function closeEmailThread(threadId: string) {
  await query(
    `update newton_email_threads
        set status = 'closed', updated_at = now()
      where id = $1`,
    [threadId],
  );
}

export async function countOpenEmailThreads() {
  const result = await query<{ count: number }>(
    `select count(*)::int as count
       from newton_email_threads
      where status = 'open'`,
  );
  return Number(result.rows[0]?.count ?? 0);
}
