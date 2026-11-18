import { requireApiAccount } from "@/lib/account/auth";
import { getAttachmentFile } from "@/lib/newton/attachments";
import { newtonJsonError } from "@/lib/newton/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Serves an image the caller uploaded. Anonymous access is never allowed. */
export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await requireApiAccount(request);
    const { id } = await context.params;
    const file = await getAttachmentFile(session.account.id, id);

    const body = new Uint8Array(file.data);
    return new Response(body, {
      headers: {
        "content-type": file.mime_type,
        "content-length": String(file.byte_size),
        "content-disposition": `inline; filename="${file.name.replace(/["\\]/g, "")}"`,
        "cache-control": "private, max-age=86400, immutable",
        "x-content-type-options": "nosniff",
        "x-robots-tag": "noindex, nofollow",
      },
    });
  } catch (error) {
    return newtonJsonError(error);
  }
}
