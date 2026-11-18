/**
 * Newton / Aria configuration.
 *
 * The Google Gemini key is a server-only secret. Nothing in this module may be
 * imported from a client component: the model name and limits are fine to show,
 * the key never leaves the server.
 */

/** Text replies use Gemini 3.5 Flash Lite: fast, cheap and good with long context. */
const DEFAULT_MODEL = "gemini-3.5-flash-lite";

/**
 * Images need the fuller Gemini Flash model. Text replies stay on the lighter
 * model unless a message carries an image.
 */
const DEFAULT_VISION_MODEL = "gemini-3.5-flash";

/**
 * Aria is a single product identity on top of Gemini. Everywhere a human reads
 * the model name we show Xenon's branded label instead of the provider id.
 */
export const NEWTON_MODEL_LABEL = "Xenon-tech-BHR/Aria-newton-AI:3.5-flash-lite";

export const AVAILABLE_MODELS = [
  {
    id: "gemini-3.5-flash-lite",
    name: NEWTON_MODEL_LABEL,
    description: "Single model powering Newton for all B2B tasks",
  },
] as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"];

export function modelById(id: string) {
  return AVAILABLE_MODELS.find((m) => m.id === id);
}

function integerEnv(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), minimum), maximum);
}

export type NewtonLimits = {
  messagesPerDay: number;
  tokensPerDay: number;
  requestsPerMinute: number;
  maxPromptChars: number;
  maxHistoryMessages: number;
  maxCompletionTokens: number;
  maxThreadsPerAccount: number;
};

export function newtonLimits(): NewtonLimits {
  return {
    messagesPerDay: integerEnv("NEWTON_DAILY_MESSAGES", 80, 1, 2000),
    tokensPerDay: integerEnv("NEWTON_DAILY_TOKENS", 250_000, 1000, 20_000_000),
    requestsPerMinute: integerEnv("NEWTON_REQUESTS_PER_MINUTE", 6, 1, 60),
    maxPromptChars: 8000,
    maxHistoryMessages: 24,
    maxCompletionTokens: integerEnv("NEWTON_MAX_COMPLETION_TOKENS", 1200, 128, 8192),
    maxThreadsPerAccount: 200,
  };
}

export type NewtonPlan = "free" | "pro" | "max" | "enterprise";
export const NEWTON_PLAN_KEYS = ["free", "pro", "max", "enterprise"] as const;

export type NewtonPlanDetails = {
  label: string;
  usdPerMonth: number;
  bhdPerMonth: number | null;
  commercial: boolean;
};

export const NEWTON_PLANS: Record<
  NewtonPlan,
  { label: string; usdPerMonth: number; bhdPerMonth: number | null; commercial: boolean }
> = {
  free: {
    label: "Free",
    usdPerMonth: 0,
    bhdPerMonth: null,
    commercial: false,
  },
  pro: {
    label: "Pro",
    usdPerMonth: 35,
    bhdPerMonth: 13.16,
    commercial: true,
  },
  max: {
    label: "Max",
    usdPerMonth: 50,
    bhdPerMonth: 18.80,
    commercial: true,
  },
  enterprise: {
    label: "Enterprise",
    usdPerMonth: 0,
    bhdPerMonth: null,
    commercial: true,
  },
};

export function newtonConfig() {
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || "";
  const model = process.env.GEMINI_TEXT_MODEL?.trim() || DEFAULT_MODEL;
  const disabledByFlag = process.env.NEWTON_ENABLED?.trim() === "false";

  return {
    geminiApiKey,
    model,
    visionModel:
      process.env.NEWTON_VISION_MODEL?.trim() ||
      process.env.GEMINI_VISION_MODEL?.trim() ||
      DEFAULT_VISION_MODEL,
    limits: newtonLimits(),
    /** True when Aria can actually answer: a key is present and it is not off. */
    enabled: Boolean(geminiApiKey) && !disabledByFlag,
    /** True when images can be read: the vision provider is configured too. */
    visionEnabled: Boolean(geminiApiKey) && !disabledByFlag,
    /** Distinguishes "switched off" from "never configured" in the UI. */
    status: disabledByFlag
      ? ("disabled" as const)
      : geminiApiKey
        ? ("ready" as const)
        : ("unconfigured" as const),
  };
}

export function isNewtonConfigured() {
  return newtonConfig().enabled;
}
