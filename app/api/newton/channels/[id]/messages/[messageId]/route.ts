import { NextResponse } from "next/server";
import { requireApiAccount } from "@/lib/account/auth";
import { noStore } from "@/lib/account/http";
import { newtonJsonError } from "@/lib/newton/http";
import { deleteChannelMessage } from "@/lib/newton/teams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; messageId: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await requireApiAccount(request);
    const { id, messageId } = await context.params;
    await deleteChannelMessage(id, messageId, session.account.id);
    return noStore(NextResponse.json({ ok: true }));
  } catch (error) {
    return newtonJsonError(error);
  }
}
