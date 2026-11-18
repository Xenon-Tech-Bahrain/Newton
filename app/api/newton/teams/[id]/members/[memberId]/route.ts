import { NextResponse } from "next/server";
import { requireApiAccount } from "@/lib/account/auth";
import { noStore, readJson } from "@/lib/account/http";
import { newtonJsonError } from "@/lib/newton/http";
import { removeTeamMember, updateTeamMemberRole } from "@/lib/newton/teams";
import { memberRoleSchema } from "@/lib/newton/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; memberId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireApiAccount(request);
    const { id, memberId } = await context.params;
    const input = memberRoleSchema.parse(await readJson(request));
    await updateTeamMemberRole(id, session.account.id, memberId, input.role);
    return noStore(NextResponse.json({ ok: true }));
  } catch (error) {
    return newtonJsonError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await requireApiAccount(request);
    const { id, memberId } = await context.params;
    await removeTeamMember(id, session.account.id, memberId);
    return noStore(NextResponse.json({ ok: true }));
  } catch (error) {
    return newtonJsonError(error);
  }
}
