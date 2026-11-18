import { NextResponse } from "next/server";
import { requireApiAccount } from "@/lib/account/auth";
import { noStore, readJson } from "@/lib/account/http";
import { checkRateLimit } from "@/lib/admin/rate-limit";
import { NewtonError } from "@/lib/newton/errors";
import { newtonJsonError } from "@/lib/newton/http";
import { fetchUrlSchema } from "@/lib/newton/validation";
import { fetchWebPage } from "@/lib/newton/web-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Fetches a single public page for the signed-in user and returns readable
 * text. Rate limited per account because each call leaves the network.
 */
export async function POST(request: Request) {
  try {
    const session = await requireApiAccount(request);
    const limit = await checkRateLimit(
      `newton:fetch:${session.account.id}`,
      10,
      10 * 60 * 1000,
    );
    if (!limit.allowed) {
      throw new NewtonError(
        `You are fetching pages too often. Try again in ${Math.max(1, limit.retryAfterSeconds)} seconds.`,
        429,
        "fetch_rate_limited",
      );
    }

    const input = fetchUrlSchema.parse(await readJson(request));
    const page = await fetchWebPage(input.url);

    return noStore(NextResponse.json({ page }));
  } catch (error) {
    return newtonJsonError(error);
  }
}
