import { newId } from "@/lib/admin/ids";
import { query, withTransaction } from "@/lib/db";
import {
  NEWTON_PLANS,
  NEWTON_PLAN_KEYS,
  type NewtonPlan,
} from "@/lib/newton/config";

/**
 * Newton plans are editable from the admin console but keep a fixed set of
 * keys so an existing account assignment never points at a deleted plan.
 */
export type NewtonPlanRecord = {
  key: NewtonPlan;
  label: string;
  description: string;
  usdPerMonth: number;
  bhdPerMonth: number | null;
  commercial: boolean;
  features: string[];
  sortOrder: number;
  active: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

type PlanRow = {
  key: string;
  label: string;
  description: string;
  usd_per_month: string | number;
  bhd_per_month: string | number | null;
  commercial: boolean;
  features: unknown;
  sort_order: number;
  active: boolean;
  updated_at: string;
  updated_by: string | null;
};

const DEFAULT_DETAILS: Record<
  NewtonPlan,
  { description: string; features: string[]; sortOrder: number }
> = {
  free: {
    description:
      "Personal, non-commercial evaluation of Aria AI. Not for business or client work.",
    features: [
      "Aria AI chat (non-commercial only)",
      "Team chat and documents",
      "Limited daily messages",
    ],
    sortOrder: 0,
  },
  pro: {
    description:
      "Commercial access for small teams and individual professionals.",
    features: [
      "Commercial use of Newton",
      "Team chat and documents",
      "Higher daily limits",
      "Email support",
    ],
    sortOrder: 1,
  },
  max: {
    description: "Higher usage limits and priority support for growing teams.",
    features: [
      "Commercial use of Newton",
      "Team chat and documents",
      "Highest daily limits",
      "Priority email support",
    ],
    sortOrder: 2,
  },
  enterprise: {
    description:
      "Custom pricing, dedicated support and deployment terms for larger organisations.",
    features: [
      "Commercial use of Newton",
      "Custom usage limits",
      "Dedicated support",
      "Custom terms by negotiation",
    ],
    sortOrder: 3,
  },
};

export function defaultNewtonPlans(): NewtonPlanRecord[] {
  return NEWTON_PLAN_KEYS.map((key) => {
    const details = NEWTON_PLANS[key];
    const defaults = DEFAULT_DETAILS[key];
    return {
      key,
      label: details.label,
      description: defaults.description,
      usdPerMonth: details.usdPerMonth,
      bhdPerMonth: details.bhdPerMonth,
      commercial: details.commercial,
      features: defaults.features,
      sortOrder: defaults.sortOrder,
      active: true,
      updatedAt: null,
      updatedBy: null,
    };
  });
}

function parseFeatures(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toPlan(row: PlanRow): NewtonPlanRecord {
  return {
    key: row.key as NewtonPlan,
    label: row.label,
    description: row.description,
    usdPerMonth: Number(row.usd_per_month ?? 0),
    bhdPerMonth:
      row.bhd_per_month === null ? null : Number(row.bhd_per_month),
    commercial: Boolean(row.commercial),
    features: parseFeatures(row.features),
    sortOrder: Number(row.sort_order ?? 0),
    active: Boolean(row.active),
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

export async function listNewtonPlans(options?: {
  activeOnly?: boolean;
}): Promise<NewtonPlanRecord[]> {
  try {
    const result = await query<PlanRow>(
      `select key, label, description, usd_per_month, bhd_per_month,
              commercial, features, sort_order, active, updated_at, updated_by
         from newton_plans
        ${options?.activeOnly ? "where active = true" : ""}
        order by sort_order asc, key asc`,
    );

    if (result.rows.length === 0) return defaultNewtonPlans();
    return result.rows.map(toPlan);
  } catch {
    // The public pricing page must still render if the migration has not been
    // applied yet. The fallback mirrors the seeded values.
    return defaultNewtonPlans().filter(
      (plan) => !options?.activeOnly || plan.active,
    );
  }
}

export async function getNewtonPlan(
  key: NewtonPlan,
): Promise<NewtonPlanRecord | null> {
  try {
    const result = await query<PlanRow>(
      `select key, label, description, usd_per_month, bhd_per_month,
              commercial, features, sort_order, active, updated_at, updated_by
         from newton_plans
        where key = $1
        limit 1`,
      [key],
    );
    return result.rows[0] ? toPlan(result.rows[0]) : null;
  } catch {
    return defaultNewtonPlans().find((plan) => plan.key === key) ?? null;
  }
}

export type UpdateNewtonPlanInput = {
  label: string;
  description: string;
  usdPerMonth: number;
  bhdPerMonth: number | null;
  commercial: boolean;
  features: string[];
  active: boolean;
  sortOrder?: number;
};

export async function updateNewtonPlan(
  key: NewtonPlan,
  input: UpdateNewtonPlanInput,
  actor: string,
): Promise<NewtonPlanRecord> {
  return withTransaction(async (client) => {
    const result = await client.query<PlanRow>(
      `update newton_plans
          set label = $2,
              description = $3,
              usd_per_month = $4,
              bhd_per_month = $5,
              commercial = $6,
              features = $7::jsonb,
              active = $8,
              sort_order = coalesce($9, sort_order),
              updated_by = $10,
              updated_at = now()
        where key = $1
        returning key, label, description, usd_per_month, bhd_per_month,
                  commercial, features, sort_order, active, updated_at,
                  updated_by`,
      [
        key,
        input.label.trim(),
        input.description.trim(),
        input.usdPerMonth,
        input.bhdPerMonth,
        input.commercial,
        JSON.stringify(input.features),
        input.active,
        input.sortOrder ?? null,
        actor,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      const fallback = defaultNewtonPlans().find((plan) => plan.key === key);
      if (!fallback) throw new Error("Unknown Newton plan.");
      return fallback;
    }

    await client.query(
      `insert into audit_log (id, actor, action, entity_type, entity_id, details)
       values ($1, $2, 'newton_plan_updated', 'newton_plan', $3, $4::jsonb)`,
      [
        newId(),
        actor,
        key,
        JSON.stringify({
          label: input.label,
          usdPerMonth: input.usdPerMonth,
          bhdPerMonth: input.bhdPerMonth,
          commercial: input.commercial,
          active: input.active,
        }),
      ],
    );

    return toPlan(row);
  });
}
