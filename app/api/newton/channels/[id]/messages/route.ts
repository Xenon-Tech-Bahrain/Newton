import { NextResponse } from "next/server";
import { requireApiAccount } from "@/lib/account/auth";
import { noStore, readJson } from "@/lib/account/http";
import { newtonJsonError } from "@/lib/newton/http";
import { listChannelMessages, postChannelMessage } from "@/lib/newton/teams";
import { channelMessageSchema } from "@/lib/newton/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await requireApiAccount(request);
    const { id } = await context.params;
    const limit = Number(new URL(request.url).searchParams.get("limit") || 100);
    const messages = await listChannelMessages(
      id,
      session.account.id,
      Number.isFinite(limit) ? limit : 100,
    );
    return noStore(NextResponse.json({ messages }));
  } catch (error) {
    return newtonJsonError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireApiAccount(request);
    const { id } = await context.params;
    const input = channelMessageSchema.parse(await readJson(request));
    const message = await postChannelMessage(
      id,
      session.account.id,
      input.content,
    );
    return noStore(NextResponse.json({ message }, { status: 201 }));
  } catch (error) {
    return newtonJsonError(error);
  }
}
