import { NextResponse } from "next/server";
import { requireApiAccount } from "@/lib/account/auth";
import { noStore, readJson } from "@/lib/account/http";
import { newtonJsonError } from "@/lib/newton/http";
import { createChannel, listTeamChannels } from "@/lib/newton/teams";
import { createChannelSchema } from "@/lib/newton/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await requireApiAccount(request);
    const { id } = await context.params;
    const channels = await listTeamChannels(id, session.account.id);
    return noStore(NextResponse.json({ channels }));
  } catch (error) {
    return newtonJsonError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireApiAccount(request);
    const { id } = await context.params;
    const input = createChannelSchema.parse(await readJson(request));
    const channel = await createChannel(
      id,
      session.account.id,
      input.name,
      input.description,
    );
    return noStore(NextResponse.json({ channel }, { status: 201 }));
  } catch (error) {
    return newtonJsonError(error);
  }
}
