import { NextResponse } from "next/server";
import { requireApiAccount } from "@/lib/account/auth";
import { noStore } from "@/lib/account/http";
import {
  MAX_IMAGE_BYTES,
  isAllowedImageType,
  storeImage,
} from "@/lib/newton/attachments";
import { NewtonError } from "@/lib/newton/errors";
import { newtonJsonError } from "@/lib/newton/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stores one image for the signed-in account. The client only ever holds the
 * opaque attachment id, and the model call resolves it to bytes on the server.
 */
export async function POST(request: Request) {
  try {
    const session = await requireApiAccount(request);

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      throw new NewtonError(
        "Choose an image to attach.",
        422,
        "missing_file",
      );
    }
    if (!isAllowedImageType(file.type)) {
      throw new NewtonError(
        "Attach a PNG, JPEG, WebP or GIF image.",
        415,
        "unsupported_attachment",
      );
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new NewtonError(
        "Images must be 5 MB or smaller.",
        413,
        "attachment_too_large",
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const image = await storeImage({
      accountId: session.account.id,
      name: file.name,
      mimeType: file.type,
      bytes,
    });

    return noStore(NextResponse.json({ attachment: image }, { status: 201 }));
  } catch (error) {
    return newtonJsonError(error);
  }
}
