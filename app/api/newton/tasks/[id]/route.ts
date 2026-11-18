import { NextResponse } from "next/server";
import { requireApiAccount } from "@/lib/account/auth";
import { noStore, readJson } from "@/lib/account/http";
import { newtonJsonError } from "@/lib/newton/http";
import { deleteTask, getTask, updateTask } from "@/lib/newton/tasks";
import { taskUpdateSchema } from "@/lib/newton/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await requireApiAccount(request);
    const { id } = await context.params;
    const task = await getTask(session.account.id, id);
    return noStore(NextResponse.json({ task }));
  } catch (error) {
    return newtonJsonError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireApiAccount(request);
    const { id } = await context.params;
    const input = taskUpdateSchema.parse(await readJson(request));
    const task = await updateTask(session.account.id, id, input);
    return noStore(NextResponse.json({ task }));
  } catch (error) {
    return newtonJsonError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await requireApiAccount(request);
    const { id } = await context.params;
    await deleteTask(session.account.id, id);
    return noStore(NextResponse.json({ ok: true }));
  } catch (error) {
    return newtonJsonError(error);
  }
}
