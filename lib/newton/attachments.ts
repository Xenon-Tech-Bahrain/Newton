import { newId } from "@/lib/admin/ids";
import { query } from "@/lib/db";
import { NewtonError } from "@/lib/newton/errors";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

export function isAllowedImageType(mimeType: string) {
  return ALLOWED_IMAGE_TYPES.has(mimeType.toLowerCase());
}

/**
 * Stores an uploaded image for one account. Bytes live in Postgres because the
 * deployment has no object store configured; the message JSON only keeps the
 * attachment id and a reference URL.
 */
export async function storeImage({
  accountId,
  name,
  mimeType,
  bytes,
}: {
  accountId: string;
  name: string;
  mimeType: string;
  bytes: Buffer;
}) {
  const type = mimeType.toLowerCase();
  if (!isAllowedImageType(type)) {
    throw new NewtonError(
      "Attach a PNG, JPEG, WebP or GIF image.",
      415,
      "unsupported_attachment",
    );
  }
  if (bytes.byteLength === 0) {
    throw new NewtonError("That image is empty.", 422, "empty_attachment");
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new NewtonError(
      "Images must be 5 MB or smaller.",
      413,
      "attachment_too_large",
    );
  }

  const id = newId();
  await query(
    `insert into newton_attachment_files
       (id, account_id, name, mime_type, byte_size, data)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      accountId,
      name.slice(0, 160) || `image.${ALLOWED_IMAGE_TYPES.get(type)}`,
      type,
      bytes.byteLength,
      bytes,
    ],
  );

  // Housekeeping: attachment bytes are only needed while a conversation is
  // live. Drop anything older than 30 days for this account.
  await query(
    `delete from newton_attachment_files
      where account_id = $1 and created_at < now() - interval '30 days'`,
    [accountId],
  ).catch(() => undefined);

  return {
    id,
    name: name.slice(0, 160),
    mimeType: type,
    size: bytes.byteLength,
    url: `/api/newton/attachments/${id}`,
  };
}

export async function getAttachmentFile(accountId: string, attachmentId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(attachmentId)) {
    throw new NewtonError(
      "That attachment was not found.",
      404,
      "attachment_not_found",
    );
  }

  const result = await query<{
    name: string;
    mime_type: string;
    byte_size: number;
    data: Buffer;
  }>(
    `select name, mime_type, byte_size, data
       from newton_attachment_files
      where id = $1 and account_id = $2
      limit 1`,
    [attachmentId, accountId],
  );

  const row = result.rows[0];
  if (!row) {
    throw new NewtonError(
      "That attachment was not found.",
      404,
      "attachment_not_found",
    );
  }
  return row;
}

/**
 * Resolves the image references a client sent into data URLs the model can
 * read. Only ids owned by the caller are accepted, and inline data URLs from an
 * untrusted client are ignored.
 */
export async function resolveImageAttachments(
  accountId: string,
  attachments: { type: string; url?: string }[],
) {
  const images: { url: string; detail: "high" }[] = [];

  for (const attachment of attachments) {
    if (attachment.type !== "image" || !attachment.url) continue;

    const match = /^\/api\/newton\/attachments\/([0-9a-f-]{36})$/i.exec(
      attachment.url,
    );
    if (!match) continue;

    const file = await getAttachmentFile(accountId, match[1]);
    images.push({
      url: `data:${file.mime_type};base64,${file.data.toString("base64")}`,
      detail: "high",
    });
  }

  return images;
}
