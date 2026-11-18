import { requireVerifiedAccount } from "@/lib/account/auth";
import { TasksBoard } from "@/components/newton/tasks-board";
import { getTaskSummary, listTasks } from "@/lib/newton/tasks";
import { listTeamsForAccount } from "@/lib/newton/teams";

export const dynamic = "force-dynamic";

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white px-3 py-2 dark:border-white/10 dark:bg-ink-900">
      <p className="text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-white/35">
        {label}
      </p>
      <p className="mt-0.5 font-display text-xl font-semibold text-ink-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

export default async function NewtonTasksPage() {
  const session = await requireVerifiedAccount("/newton/app/tasks");
  const [tasks, teams, summary] = await Promise.all([
    listTasks(session.account.id),
    listTeamsForAccount(session.account.id, session.account.email),
    getTaskSummary(session.account.id),
  ]);

  return (
    <div className="space-y-4">
      <div className="mx-auto grid w-full max-w-7xl gap-3 px-4 pt-6 sm:grid-cols-4 sm:px-6">
        <SummaryCard label="Open" value={summary.open} />
        <SummaryCard label="Due in 7 days" value={summary.dueSoon} />
        <SummaryCard label="Assigned to you" value={summary.mine} />
        <SummaryCard label="Done this week" value={summary.doneThisWeek} />
      </div>
      <TasksBoard
        initialTasks={tasks}
        teams={teams.map((team) => ({ id: team.id, name: team.name }))}
        currentEmail={session.account.email}
      />
    </div>
  );
}
