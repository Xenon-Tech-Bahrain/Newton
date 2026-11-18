import { NextResponse } from "next/server";
import { requireApiAccount } from "@/lib/account/auth";
import { noStore, readJson } from "@/lib/account/http";
import {
  createDocument,
  listDocuments,
} from "@/lib/newton/documents";
import { newtonJsonError } from "@/lib/newton/http";
import { documentCreateSchema } from "@/lib/newton/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireApiAccount(request);
    const url = new URL(request.url);
    const documents = await listDocuments(session.account.id, {
      teamId: url.searchParams.get("team"),
      search: url.searchParams.get("q") ?? undefined,
    });
    return noStore(NextResponse.json({ documents }));
  } catch (error) {
    return newtonJsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireApiAccount(request);
    const input = documentCreateSchema.parse(await readJson(request));
    const document = await createDocument(session.account.id, input);
    return noStore(NextResponse.json({ document }, { status: 201 }));
  } catch (error) {
    return newtonJsonError(error);
  }
}
