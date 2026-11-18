"use client";

import { useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CircleDot,
  ListTodo,
  Loader2,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import { accountJsonHeaders } from "@/components/account/client";
import { cn } from "@/lib/utils";
import type {
  NewtonTask,
  NewtonTaskPriority,
  NewtonTaskStatus,
} from "@/lib/newton/types";

type TeamOption = { id: string; name: string };

const COLUMNS: { status: NewtonTaskStatus; label: string }[] = [
  { status: "todo", label: "To do" },
  { status: "in_progress", label: "In progress" },
  { status: "blocked", label: "Blocked" },
  { status: "done", label: "Done" },
];

const PRIORITY_TONE: Record<NewtonTaskPriority, string> = {
  high: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300",
  normal:
    "border-ink-200 bg-ink-50 text-ink-600 dark:border-white/15 dark:bg-white/5 dark:text-white/50",
  low: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300",
};

function formatDue(value: string | null) {
  if (!value) return null;
  const today = new Date();
  const date = new Date(`${value}T00:00:00`);
  const label = date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
  const overdue =
    date.getTime() <
    new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return { label, overdue };
}

export function TasksBoard({
  initialTasks,
  teams,
  currentEmail,
}: {
  initialTasks: NewtonTask[];
  teams: TeamOption[];
  currentEmail: string;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [teamFilter, setTeamFilter] = useState("");
  const [open, setOpen] = useState(initialTasks.length === 0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [teamId, setTeamId] = useState("");
  const [assignedEmail, setAssignedEmail] = useState("");
  const [priority, setPriority] = useState<NewtonTaskPriority>("normal");
  const [dueDate, setDueDate] = useState("");

  const visible = teamFilter
    ? tasks.filter((task) => task.teamId === teamFilter)
    : tasks;

  async function createTask() {
    if (saving) return;
    if (!title.trim()) {
      setError("Give the task a title.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/newton/tasks", {
        method: "POST",
        headers: accountJsonHeaders,
        body: JSON.stringify({
          title,
          details,
          teamId: teamId || null,
          assignedEmail: assignedEmail.trim() || null,
          priority,
          dueDate: dueDate || null,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        task?: NewtonTask;
        error?: string;
      };
      if (!response.ok || !data.task) {
        throw new Error(data.error || "The task could not be created.");
      }
      setTasks((previous) => [data.task as NewtonTask, ...previous]);
      setTitle("");
      setDetails("");
      setAssignedEmail("");
      setDueDate("");
      setPriority("normal");
      setOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The task could not be created.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function patchTask(id: string, patch: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/newton/tasks/${id}`, {
        method: "PATCH",
        headers: accountJsonHeaders,
        body: JSON.stringify(patch),
      });
      const data = (await response.json().catch(() => ({}))) as {
        task?: NewtonTask;
        error?: string;
      };
      if (!response.ok || !data.task) {
        throw new Error(data.error || "The task could not be updated.");
      }
      setTasks((previous) =>
        previous.map((task) => (task.id === id ? (data.task as NewtonTask) : task)),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The task could not be updated.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function removeTask(id: string) {
    if (!window.confirm("Delete this task?")) return;
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/newton/tasks/${id}`, {
        method: "DELETE",
        headers: accountJsonHeaders,
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || "The task could not be deleted.");
      }
      setTasks((previous) => previous.filter((task) => task.id !== id));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The task could not be deleted.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-sky">
            Newton · Work
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em] text-ink-900 dark:text-white">
            Tasks
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500 dark:text-white/45">
            Track what your team owes, assign it to an EcoAccount and keep it
            next to the documents and chat where the work lives.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label htmlFor="task-team-filter" className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-white/35">
              Team
            </label>
            <select
              id="task-team-filter"
              value={teamFilter}
              onChange={(event) => setTeamFilter(event.target.value)}
              className="field h-9 py-1 text-xs"
            >
              <option value="">All teams and personal</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="btn-primary btn-md"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            New task
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      {open ? (
        <section className="rounded-2xl border border-ink-100 bg-white p-4 dark:border-white/10 dark:bg-ink-900">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="task-title" className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-white/35">
                Title
              </label>
              <input
                id="task-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                placeholder="What needs to happen?"
                className="field h-9 py-1 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="task-details" className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-white/35">
                Details
              </label>
              <textarea
                id="task-details"
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                rows={3}
                maxLength={20_000}
                placeholder="Context, links or acceptance notes"
                className="field w-full resize-y py-2 text-xs"
              />
            </div>
            <div>
              <label htmlFor="task-team" className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-white/35">
                Team
              </label>
              <select
                id="task-team"
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
                className="field h-9 py-1 text-xs"
              >
                <option value="">Just me</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="task-assignee" className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-white/35">
                Assign to (email, optional)
              </label>
              <input
                id="task-assignee"
                type="email"
                value={assignedEmail}
                onChange={(event) => setAssignedEmail(event.target.value)}
                placeholder={currentEmail}
                className="field h-9 py-1 text-xs"
              />
            </div>
            <div>
              <label htmlFor="task-priority" className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-white/35">
                Priority
              </label>
              <select
                id="task-priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value as NewtonTaskPriority)}
                className="field h-9 py-1 text-xs"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label htmlFor="task-due" className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-white/35">
                Due date
              </label>
              <input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="field h-9 py-1 text-xs"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-ink-200 px-3 py-2 text-xs font-semibold text-ink-600 transition hover:bg-ink-50 dark:border-white/15 dark:text-white/60 dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void createTask()}
              disabled={saving}
              className="btn-primary btn-sm"
            >
              {saving ? (
                <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              {saving ? "Creating" : "Create task"}
            </button>
          </div>
        </section>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-4">
        {COLUMNS.map((column) => {
          const items = visible.filter((task) => task.status === column.status);
          return (
            <section
              key={column.status}
              className="flex min-h-[12rem] flex-col rounded-2xl border border-ink-100 bg-mist/60 p-2.5 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <div className="flex items-center justify-between px-1 pb-2">
                <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-700 dark:text-white/70">
                  {column.status === "done" ? (
                    <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
                  ) : column.status === "blocked" ? (
                    <CircleDot aria-hidden="true" className="h-3.5 w-3.5 text-rose-600 dark:text-rose-300" />
                  ) : (
                    <ListTodo aria-hidden="true" className="h-3.5 w-3.5 text-ink-400 dark:text-white/35" />
                  )}
                  {column.label}
                </h2>
                <span className="text-[0.6rem] text-ink-400 dark:text-white/30">
                  {items.length}
                </span>
              </div>

              <div className="space-y-2">
                {items.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-ink-200 px-2 py-4 text-center text-[0.6rem] text-ink-400 dark:border-white/10 dark:text-white/25">
                    Nothing here
                  </p>
                ) : (
                  items.map((task) => {
                    const due = formatDue(task.dueDate);
                    const busy = busyId === task.id;
                    return (
                      <article
                        key={task.id}
                        className="rounded-xl border border-ink-100 bg-white p-2.5 shadow-soft dark:border-white/10 dark:bg-ink-900"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3
                            className={cn(
                              "text-xs font-semibold leading-5 text-ink-800 dark:text-white/80",
                              task.status === "done" && "line-through opacity-60",
                            )}
                          >
                            {task.title}
                          </h3>
                          {task.canEdit ? (
                            <button
                              type="button"
                              onClick={() => void removeTask(task.id)}
                              disabled={busy}
                              aria-label={`Delete task: ${task.title}`}
                              className="shrink-0 rounded-md p-0.5 text-ink-300 transition hover:text-rose-600 dark:text-white/25 dark:hover:text-rose-300"
                            >
                              <Trash2 aria-hidden="true" className="h-3 w-3" />
                            </button>
                          ) : null}
                        </div>

                        {task.details ? (
                          <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[0.62rem] leading-4 text-ink-500 dark:text-white/40">
                            {task.details}
                          </p>
                        ) : null}

                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.55rem]">
                          <span
                            className={cn(
                              "rounded-full border px-1.5 py-0.5 font-semibold capitalize",
                              PRIORITY_TONE[task.priority],
                            )}
                          >
                            {task.priority}
                          </span>
                          {task.teamName ? (
                            <span className="rounded-full bg-ink-100 px-1.5 py-0.5 font-medium text-ink-600 dark:bg-white/10 dark:text-white/50">
                              {task.teamName}
                            </span>
                          ) : null}
                          {due ? (
                            <span
                              className={cn(
                                "inline-flex items-center gap-0.5",
                                due.overdue && task.status !== "done"
                                  ? "font-semibold text-rose-600 dark:text-rose-300"
                                  : "text-ink-400 dark:text-white/30",
                              )}
                            >
                              <CalendarDays aria-hidden="true" className="h-3 w-3" />
                              {due.label}
                            </span>
                          ) : null}
                          {task.assigneeEmail ? (
                            <span className="inline-flex items-center gap-0.5 text-ink-400 dark:text-white/30">
                              <UserRound aria-hidden="true" className="h-3 w-3" />
                              {task.assigneeName || task.assigneeEmail}
                            </span>
                          ) : null}
                        </div>

                        {task.canEdit ? (
                          <div className="mt-2 flex items-center gap-1">
                            <label className="sr-only" htmlFor={`status-${task.id}`}>
                              Task status
                            </label>
                            <select
                              id={`status-${task.id}`}
                              value={task.status}
                              disabled={busy}
                              onChange={(event) =>
                                void patchTask(task.id, {
                                  status: event.target.value,
                                })
                              }
                              className="w-full rounded-lg border border-ink-200 bg-white px-1.5 py-1 text-[0.6rem] text-ink-600 dark:border-white/10 dark:bg-white/5 dark:text-white/55"
                            >
                              {COLUMNS.map((option) => (
                                <option key={option.status} value={option.status}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {busy ? (
                              <Loader2 aria-hidden="true" className="h-3 w-3 shrink-0 animate-spin text-ink-400" />
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-200 bg-white p-6 text-center dark:border-white/15 dark:bg-ink-900">
          <p className="text-sm font-semibold text-ink-800 dark:text-white/80">
            No tasks yet
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-ink-500 dark:text-white/45">
            Add the first task, assign it to a teammate, and use the board to see
            what is blocked before it becomes urgent.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="btn-primary btn-md mt-4"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Create a task
          </button>
        </div>
      ) : null}
    </div>
  );
}
