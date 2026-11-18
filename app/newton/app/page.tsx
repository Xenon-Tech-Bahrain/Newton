import Link from "next/link";
import {
  ArrowRight,
  Check,
  ClipboardList,
  Crown,
  FileText,
  Gauge,
  MessagesSquare,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import { requireVerifiedAccount } from "@/lib/account/auth";
import { newtonConfig } from "@/lib/newton/config";
import { listDocuments } from "@/lib/newton/documents";
import { getModerationState } from "@/lib/newton/moderation";
import { listNewtonPlans } from "@/lib/newton/plans";
import { getUsageToday, listThreads } from "@/lib/newton/service";
import { getTaskSummary } from "@/lib/newton/tasks";
import { listTeamsForAccount } from "@/lib/newton/teams";

export const dynamic = "force-dynamic";

export default async function NewtonWorkspacePage() {
  const session = await requireVerifiedAccount("/newton/app");
  const [teams, threads, usage, moderation, plans, documents, taskSummary] =
    await Promise.all([
      listTeamsForAccount(session.account.id, session.account.email),
      listThreads(session.account.id),
      getUsageToday(session.account.id),
      getModerationState(session.account.id),
      listNewtonPlans(),
      listDocuments(session.account.id),
      getTaskSummary(session.account.id),
    ]);

  const planKey = session.account.newton_plan || "free";
  const plan = plans.find((item) => item.key === planKey) ?? plans[0];
  const messagesPerDay = newtonConfig().limits.messagesPerDay;
  const firstName = session.account.name?.trim().split(/\s+/)[0] || "there";
  const blocked =
    moderation.state === "restricted" ||
    moderation.state === "suspended" ||
    moderation.state === "terminated";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <section className="overflow-hidden rounded-3xl bg-ink-gradient p-6 text-white shadow-card sm:p-8">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-sky">
          Newton · Team workspace
        </p>
        <h1 className="mt-2 max-w-2xl font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          Welcome back, {firstName}.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
          Chat with your team, manage who has access, and use Aria AI for
          documents and decisions — each in its own place.
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Link href="/newton/app/chat" className="btn-light btn-md">
            <MessagesSquare aria-hidden="true" className="h-4 w-4" />
            Open team chat
          </Link>
          <Link href="/newton/app/aria" className="btn-glass btn-md">
            <Sparkles aria-hidden="true" className="h-4 w-4" />
            Ask Aria
          </Link>
          <Link href="/newton/app/teams" className="btn-glass btn-md">
            <Users aria-hidden="true" className="h-4 w-4" />
            Manage teams
          </Link>
        </div>
      </section>

      {moderation.state !== "clear" ? (
        <section
          className={
            blocked
              ? "rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-400/30 dark:bg-rose-400/10"
              : "rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-400/30 dark:bg-amber-400/10"
          }
        >
          <div className="flex items-start gap-3">
            <ShieldAlert
              aria-hidden="true"
              className={
                blocked
                  ? "mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300"
                  : "mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300"
              }
            />
            <div>
              <p className="text-sm font-semibold text-ink-900 dark:text-white">
                {blocked
                  ? "Aria access is currently limited"
                  : "A moderation notice is on this account"}
              </p>
              <p className="mt-1 text-xs leading-5 text-ink-600 dark:text-white/55">
                {moderation.reason || "Contact Xenon Tech if you need details."}
                {moderation.until
                  ? ` This ends ${new Date(moderation.until).toLocaleString("en-GB", { timeZone: "Asia/Bahrain" })}.`
                  : ""}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link
          href="/newton/app/chat"
          className="group rounded-2xl border border-ink-100 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft dark:border-white/10 dark:bg-ink-900"
        >
          <MessagesSquare aria-hidden="true" className="h-5 w-5 text-brand-600 dark:text-sky" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-white/35">
            Team chat
          </p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink-900 dark:text-white">
            {teams.length}
          </p>
          <p className="mt-1 text-xs text-ink-500 dark:text-white/45">
            team{teams.length === 1 ? "" : "s"} you can open
          </p>
        </Link>

        <Link
          href="/newton/app/teams"
          className="group rounded-2xl border border-ink-100 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft dark:border-white/10 dark:bg-ink-900"
        >
          <Users aria-hidden="true" className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-white/35">
            People
          </p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink-900 dark:text-white">
            {teams.reduce((total, team) => total + team.memberCount, 0)}
          </p>
          <p className="mt-1 text-xs text-ink-500 dark:text-white/45">
            active team seat{teams.reduce((total, team) => total + team.memberCount, 0) === 1 ? "" : "s"}
          </p>
        </Link>

        <Link
          href="/newton/app/docs"
          className="group rounded-2xl border border-ink-100 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft dark:border-white/10 dark:bg-ink-900"
        >
          <FileText aria-hidden="true" className="h-5 w-5 text-brand-600 dark:text-sky" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-white/35">
            Documents
          </p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink-900 dark:text-white">
            {documents.length}
          </p>
          <p className="mt-1 text-xs text-ink-500 dark:text-white/45">
            plans, policies and notes
          </p>
        </Link>

        <Link
          href="/newton/app/tasks"
          className="group rounded-2xl border border-ink-100 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft dark:border-white/10 dark:bg-ink-900"
        >
          <ClipboardList aria-hidden="true" className="h-5 w-5 text-amber-600 dark:text-amber-300" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-white/35">
            Tasks
          </p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink-900 dark:text-white">
            {taskSummary.open}
          </p>
          <p className="mt-1 text-xs text-ink-500 dark:text-white/45">
            open{taskSummary.dueSoon > 0 ? ` · ${taskSummary.dueSoon} due this week` : ""}
          </p>
        </Link>

        <Link
          href="/newton/app/aria"
          className="group rounded-2xl border border-ink-100 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft dark:border-white/10 dark:bg-ink-900"
        >
          <Sparkles aria-hidden="true" className="h-5 w-5 text-brand-600 dark:text-sky" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-white/35">
            Aria chats
          </p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink-900 dark:text-white">
            {threads.length}
          </p>
          <p className="mt-1 text-xs text-ink-500 dark:text-white/45">
            {usage.requests} message{usage.requests === 1 ? "" : "s"} today
          </p>
        </Link>

        <div className="rounded-2xl border border-ink-100 bg-white p-5 dark:border-white/10 dark:bg-ink-900">
          <Crown aria-hidden="true" className="h-5 w-5 text-amber-600 dark:text-amber-300" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-white/35">
            Plan
          </p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink-900 dark:text-white">
            {plan?.label || "Free"}
          </p>
          <p className="mt-1 text-xs text-ink-500 dark:text-white/45">
            {plan && plan.usdPerMonth > 0
              ? `$${plan.usdPerMonth}/month · ${plan.commercial ? "commercial use" : "non-commercial"}`
              : plan?.commercial
                ? "Custom pricing"
                : "Non-commercial use"}
          </p>
          <Link
            href="/newton/pricing"
            className="mt-3 inline-flex items-center gap-1 text-[0.68rem] font-semibold text-brand-700 hover:text-brand-800 dark:text-sky dark:hover:text-white"
          >
            View plans
            <ArrowRight aria-hidden="true" className="h-3 w-3" />
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-ink-100 bg-white p-5 dark:border-white/10 dark:bg-ink-900">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-ink-900 dark:text-white">
              Your teams
            </h2>
            <Link
              href="/newton/app/teams"
              className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-sky dark:hover:text-white"
            >
              Manage
            </Link>
          </div>

          {teams.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-ink-200 bg-mist/60 p-6 text-center dark:border-white/15 dark:bg-white/[0.02]">
              <p className="text-sm font-semibold text-ink-800 dark:text-white/80">
                No teams yet
              </p>
              <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-ink-500 dark:text-white/45">
                Create a team to start channels, invite colleagues and chat
                where the work happens.
              </p>
              <Link href="/newton/app/teams" className="btn-primary btn-md mt-4">
                Create your first team
              </Link>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-ink-50 dark:divide-white/5">
              {teams.map((team) => (
                <li
                  key={team.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/newton/app/chat?team=${team.id}`}
                      className="block truncate text-sm font-semibold text-ink-800 hover:text-brand-700 dark:text-white/80 dark:hover:text-sky"
                    >
                      {team.name}
                    </Link>
                    <p className="mt-0.5 text-[0.62rem] text-ink-400 dark:text-white/30">
                      {team.memberCount} member{team.memberCount === 1 ? "" : "s"} ·{" "}
                      {team.channelCount} channel{team.channelCount === 1 ? "" : "s"} ·{" "}
                      {team.role}
                    </p>
                  </div>
                  <Link
                    href={`/newton/app/chat?team=${team.id}`}
                    className="inline-flex items-center gap-1 text-[0.68rem] font-semibold text-brand-700 hover:text-brand-800 dark:text-sky dark:hover:text-white"
                  >
                    Open
                    <ArrowRight aria-hidden="true" className="h-3 w-3" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-ink-100 bg-white p-5 dark:border-white/10 dark:bg-ink-900">
          <div className="flex items-center gap-2">
            <Gauge aria-hidden="true" className="h-4 w-4 text-brand-600 dark:text-sky" />
            <h2 className="font-display text-lg font-semibold text-ink-900 dark:text-white">
              Today&apos;s Aria usage
            </h2>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <p className="font-display text-3xl font-semibold text-ink-900 dark:text-white">
              {usage.requests}
            </p>
            <p className="text-xs text-ink-400 dark:text-white/35">
              messages today
            </p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-brand-500 dark:bg-sky"
              style={{
                width: `${Math.min(100, Math.round((usage.requests / Math.max(1, messagesPerDay)) * 100))}%`,
              }}
            />
          </div>
          <ul className="mt-5 space-y-2.5 text-xs text-ink-600 dark:text-white/55">
            {[
              "Chat is separate from Aria",
              "Teams and roles are managed by owners",
              "Aria is moderated for safety",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
