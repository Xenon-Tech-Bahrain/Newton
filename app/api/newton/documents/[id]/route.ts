import { NextResponse } from "next/server";
import { requireApiAccount } from "@/lib/account/auth";
import { noStore, readJson } from "@/lib/account/http";
import {
  archiveDocument,
  getDocument,
  updateDocument,
} from "@/lib/newton/documents";
import { newtonJsonError } from "@/lib/newton/http";
import { documentUpdateSchema } from "@/lib/newton/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await requireApiAccount(request);
    const { id } = await context.params;
    const document = await getDocument(session.account.id, id);
    return noStore(NextResponse.json({ document }));
  } catch (error) {
    return newtonJsonError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireApiAccount(request);
    const { id } = await context.params;
    const input = documentUpdateSchema.parse(await readJson(request));
    const document = await updateDocument(session.account.id, id, input);
    return noStore(NextResponse.json({ document }));
  } catch (error) {
    return newtonJsonError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await requireApiAccount(request);
    const { id } = await context.params;
    await archiveDocument(session.account.id, id);
    return noStore(NextResponse.json({ ok: true }));
  } catch (error) {
    return newtonJsonError(error);
  }
}
