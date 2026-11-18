import { NextResponse } from "next/server";
import { requireApiAccount } from "@/lib/account/auth";
import { noStore, readJson } from "@/lib/account/http";
import { assertAriaAllowed } from "@/lib/newton/moderation";
import { newtonJsonError } from "@/lib/newton/http";
import { createThread, listThreads } from "@/lib/newton/service";
import { createThreadSchema } from "@/lib/newton/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireApiAccount(request);
    const threads = await listThreads(session.account.id);
    return noStore(NextResponse.json({ threads }));
  } catch (error) {
    return newtonJsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireApiAccount(request);
    await assertAriaAllowed(session.account.id);
    const input = createThreadSchema.parse(await readJson(request));
    const thread = await createThread(session.account.id, input.title);
    return noStore(NextResponse.json({ thread }, { status: 201 }));
  } catch (error) {
    return newtonJsonError(error);
  }
}
