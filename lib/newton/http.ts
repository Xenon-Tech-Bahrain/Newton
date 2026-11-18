import { NextResponse } from "next/server";
import { jsonError, noStore } from "@/lib/account/http";
import {
  NewtonError,
  NewtonNotConfiguredError,
} from "@/lib/newton/errors";

/**
 * Newton-specific error mapping. Falls back to the EcoAccount handler for
 * session, validation and database errors so both products behave the same.
 */
export function newtonJsonError(error: unknown) {
  if (error instanceof NewtonError) {
    return noStore(
      NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      ),
    );
  }

  if (error instanceof NewtonNotConfiguredError) {
    return noStore(
      NextResponse.json(
        {
          error:
            "Aria is not available yet. Please contact Xenon Tech if this continues.",
          code: "newton_not_configured",
        },
        { status: 503 },
      ),
    );
  }

  return jsonError(error);
}
