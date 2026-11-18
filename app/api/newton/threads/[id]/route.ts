import { NextResponse } from "next/server";
import { requireApiAccount } from "@/lib/account/auth";
import { noStore, readJson } from "@/lib/account/http";
import { newtonJsonError } from "@/lib/newton/http";
import {
  deleteThread,
  getThread,
  renameThread,
} from "@/lib/newton/service";
import { renameThreadSchema } from "@/lib/newton/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await requireApiAccount(request);
    const { id } = await context.params;
    const result = await getThread(session.account.id, id);
    return noStore(NextResponse.json(result));
  } catch (error) {
    return newtonJsonError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireApiAccount(request);
    const { id } = await context.params;
    const input = renameThreadSchema.parse(await readJson(request));
    const thread = await renameThread({
      accountId: session.account.id,
      threadId: id,
      title: input.title,
    });
    return noStore(NextResponse.json({ thread }));
  } catch (error) {
    return newtonJsonError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await requireApiAccount(request);
    const { id } = await context.params;
    await deleteThread(session.account.id, id);
    return noStore(NextResponse.json({ ok: true }));
  } catch (error) {
    return newtonJsonError(error);
  }
}
