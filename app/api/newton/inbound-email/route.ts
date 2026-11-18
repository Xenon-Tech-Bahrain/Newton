import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { noStore } from "@/lib/account/http";
import { processInboundEmail } from "@/lib/newton/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BODY_BYTES = 128 * 1024;

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function authorised(request: Request) {
  const secret = process.env.NEWTON_INBOUND_EMAIL_SECRET?.trim();
  if (!secret) return false;

  const header = request.headers.get("x-newton-email-secret")?.trim() || "";
  if (header && safeEqual(header, secret)) return true;

  const authorization = request.headers.get("authorization") || "";
  if (authorization.startsWith("Bearer ")) {
    return safeEqual(authorization.slice(7).trim(), secret);
  }

  return false;
}

async function readPayload(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new Error("Email payload is too large.");
  }

  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
    throw new Error("Email payload is too large.");
  }
  if (!text.trim()) throw new Error("Email payload is empty.");

  const contentType = request.headers.get("content-type")?.toLowerCase() || "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(text);
    return Object.fromEntries(params.entries());
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    // Some providers post multipart/form-data. URLSearchParams still recovers
    // simple `from=...&subject=...` bodies, but full MIME parsing is left to a
    // provider that can send JSON.
    const params = new URLSearchParams(text);
    if (params.has("from") || params.has("From")) {
      return Object.fromEntries(params.entries());
    }
    throw new Error("Email payload must be JSON or form-encoded.");
  }
}

export async function POST(request: Request) {
  if (!process.env.NEWTON_INBOUND_EMAIL_SECRET?.trim()) {
    return noStore(
      NextResponse.json(
        {
          error:
            "Inbound email is not configured. Set NEWTON_INBOUND_EMAIL_SECRET and point your mail provider at this endpoint.",
          code: "inbound_email_not_configured",
        },
        { status: 503 },
      ),
    );
  }

  if (!authorised(request)) {
    return noStore(
      NextResponse.json(
        { error: "Unauthorized.", code: "unauthorized" },
        { status: 401 },
      ),
    );
  }

  try {
    const payload = await readPayload(request);
    const result = await processInboundEmail(payload);

    return noStore(
      NextResponse.json({
        ok: true,
        threadId: result.threadId,
        autoReply: result.autoReplySent ? "sent" : "failed",
        autoReplyError: result.autoReplyError,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The email could not be processed.";
    return noStore(
      NextResponse.json(
        { error: message, code: "inbound_email_failed" },
        { status: 422 },
      ),
    );
  }
}
