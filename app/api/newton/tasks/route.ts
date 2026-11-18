import { NextResponse } from "next/server";
import { requireApiAccount } from "@/lib/account/auth";
import { noStore, readJson } from "@/lib/account/http";
import { newtonJsonError } from "@/lib/newton/http";
import { createTask, listTasks } from "@/lib/newton/tasks";
import { taskCreateSchema } from "@/lib/newton/validation";
import type { NewtonTaskStatus } from "@/lib/newton/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireApiAccount(request);
    const url = new URL(request.url);
    const status = url.searchParams.get("status") as NewtonTaskStatus | null;
    const tasks = await listTasks(session.account.id, {
      teamId: url.searchParams.get("team"),
      status,
    });
    return noStore(NextResponse.json({ tasks }));
  } catch (error) {
    return newtonJsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireApiAccount(request);
    const input = taskCreateSchema.parse(await readJson(request));
    const task = await createTask(session.account.id, input);
    return noStore(NextResponse.json({ task }, { status: 201 }));
  } catch (error) {
    return newtonJsonError(error);
  }
}
