import { NextResponse } from "next/server";
import { requireApiAccount } from "@/lib/account/auth";
import { noStore, readJson } from "@/lib/account/http";
import { newtonJsonError } from "@/lib/newton/http";
import { listTeamsForAccount, createTeam } from "@/lib/newton/teams";
import { teamNameSchema } from "@/lib/newton/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireApiAccount(request);
    const teams = await listTeamsForAccount(
      session.account.id,
      session.account.email,
    );
    return noStore(NextResponse.json({ teams }));
  } catch (error) {
    return newtonJsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireApiAccount(request);
    const input = teamNameSchema.parse(await readJson(request));
    const team = await createTeam(
      session.account.id,
      session.account.email,
      input.name,
    );
    return noStore(NextResponse.json({ team }, { status: 201 }));
  } catch (error) {
    return newtonJsonError(error);
  }
}
