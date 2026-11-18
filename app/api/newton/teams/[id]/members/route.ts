import { NextResponse } from "next/server";
import { requireApiAccount } from "@/lib/account/auth";
import { noStore, readJson } from "@/lib/account/http";
import { newtonJsonError } from "@/lib/newton/http";
import { inviteTeamMember, listTeamMembers } from "@/lib/newton/teams";
import { inviteMemberSchema } from "@/lib/newton/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await requireApiAccount(request);
    const { id } = await context.params;
    const members = await listTeamMembers(id, session.account.id);
    return noStore(NextResponse.json({ members }));
  } catch (error) {
    return newtonJsonError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireApiAccount(request);
    const { id } = await context.params;
    const input = inviteMemberSchema.parse(await readJson(request));
    const member = await inviteTeamMember(
      id,
      session.account.id,
      input.email,
      input.role,
    );
    return noStore(NextResponse.json({ member }, { status: 201 }));
  } catch (error) {
    return newtonJsonError(error);
  }
}
