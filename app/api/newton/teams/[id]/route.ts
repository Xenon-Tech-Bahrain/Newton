import { NextResponse } from "next/server";
import { requireApiAccount } from "@/lib/account/auth";
import { noStore, readJson } from "@/lib/account/http";
import { newtonJsonError } from "@/lib/newton/http";
import {
  listTeamChannels,
  listTeamMembers,
  renameTeam,
} from "@/lib/newton/teams";
import { teamNameSchema } from "@/lib/newton/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await requireApiAccount(request);
    const { id } = await context.params;
    const [members, channels] = await Promise.all([
      listTeamMembers(id, session.account.id),
      listTeamChannels(id, session.account.id),
    ]);
    return noStore(NextResponse.json({ members, channels }));
  } catch (error) {
    return newtonJsonError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireApiAccount(request);
    const { id } = await context.params;
    const input = teamNameSchema.parse(await readJson(request));
    const team = await renameTeam(id, session.account.id, input.name);
    return noStore(NextResponse.json({ team }));
  } catch (error) {
    return newtonJsonError(error);
  }
}
