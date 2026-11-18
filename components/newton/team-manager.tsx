"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Hash,
  Loader2,
  MessagesSquare,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { accountJsonHeaders } from "@/components/account/client";
import { cn } from "@/lib/utils";
import type {
  NewtonTeamChannel,
  NewtonTeamMember,
  NewtonTeamSummary,
} from "@/lib/newton/types";

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error || "Something went wrong. Please try again.");
  }
  return data;
}

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    timeZone: "Asia/Bahrain",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function TeamManager({
  initialTeams,
  initialTeamId,
  initialMembers,
  initialChannels,
}: {
  initialTeams: NewtonTeamSummary[];
  initialTeamId: string | null;
  initialMembers: NewtonTeamMember[];
  initialChannels: NewtonTeamChannel[];
}) {
  const [teams, setTeams] = useState(initialTeams);
  const [activeTeamId, setActiveTeamId] = useState(initialTeamId);
  const [members, setMembers] = useState(initialMembers);
  const [channels, setChannels] = useState(initialChannels);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const [newTeamName, setNewTeamName] = useState("");
  const [showTeamForm, setShowTeamForm] = useState(initialTeams.length === 0);

  const [teamName, setTeamName] = useState(
    initialTeams.find((team) => team.id === initialTeamId)?.name ?? "",
  );

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");

  const [channelName, setChannelName] = useState("");
  const [channelDescription, setChannelDescription] = useState("");

  const activeTeam = teams.find((team) => team.id === activeTeamId) ?? null;
  const canManage = activeTeam?.role === "owner" || activeTeam?.role === "admin";

  function clearNotices() {
    setError(null);
    setMessage(null);
  }

  async function loadTeam(teamId: string) {
    setLoading(true);
    clearNotices();
    setActiveTeamId(teamId);
    setMembers([]);
    setChannels([]);

    try {
      const response = await fetch(`/api/newton/teams/${teamId}`, {
        cache: "no-store",
      });
      const data = await readJson<{
        members: NewtonTeamMember[];
        channels: NewtonTeamChannel[];
      }>(response);
      setMembers(data.members);
      setChannels(data.channels);
      setTeamName(teams.find((team) => team.id === teamId)?.name ?? "");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "That team could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function createTeam() {
    if (!newTeamName.trim() || busy) return;
    setBusy(true);
    clearNotices();

    try {
      const response = await fetch("/api/newton/teams", {
        method: "POST",
        headers: accountJsonHeaders,
        body: JSON.stringify({ name: newTeamName.trim() }),
      });
      const data = await readJson<{ team: NewtonTeamSummary }>(response);
      setTeams((previous) => [data.team, ...previous]);
      setNewTeamName("");
      setShowTeamForm(false);
      setMessage("Team created. Invite your colleagues next.");
      await loadTeam(data.team.id);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The team was not created.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function renameTeam() {
    if (!activeTeamId || !teamName.trim() || busy) return;
    setBusy(true);
    clearNotices();

    try {
      const response = await fetch(`/api/newton/teams/${activeTeamId}`, {
        method: "PATCH",
        headers: accountJsonHeaders,
        body: JSON.stringify({ name: teamName.trim() }),
      });
      const data = await readJson<{ team: { id: string; name: string } }>(
        response,
      );
      setTeams((previous) =>
        previous.map((team) =>
          team.id === data.team.id ? { ...team, name: data.team.name } : team,
        ),
      );
      setMessage("Team name updated.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The team was not renamed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function inviteMember() {
    if (!activeTeamId || !inviteEmail.trim() || busy) return;
    setBusy(true);
    clearNotices();

    try {
      const response = await fetch(
        `/api/newton/teams/${activeTeamId}/members`,
        {
          method: "POST",
          headers: accountJsonHeaders,
          body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
        },
      );
      const data = await readJson<{
        member: { email: string; status: string };
      }>(response);
      setInviteEmail("");
      setMessage(
        data.member.status === "active"
          ? "Member added to the team."
          : "Invitation saved. It activates the first time they sign in with a verified EcoAccount.",
      );
      const refreshed = await fetch(`/api/newton/teams/${activeTeamId}`, {
        cache: "no-store",
      });
      const detail = await readJson<{
        members: NewtonTeamMember[];
        channels: NewtonTeamChannel[];
      }>(refreshed);
      setMembers(detail.members);
      setChannels(detail.channels);
      setTeams((previous) =>
        previous.map((team) =>
          team.id === activeTeamId
            ? { ...team, memberCount: detail.members.filter((m) => m.status === "active").length }
            : team,
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The invitation was not saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function updateRole(memberId: string, role: "admin" | "member") {
    if (!activeTeamId || busy) return;
    setBusy(true);
    clearNotices();

    try {
      const response = await fetch(
        `/api/newton/teams/${activeTeamId}/members/${memberId}`,
        {
          method: "PATCH",
          headers: accountJsonHeaders,
          body: JSON.stringify({ role }),
        },
      );
      await readJson(response);
      setMembers((previous) =>
        previous.map((member) =>
          member.id === memberId ? { ...member, role } : member,
        ),
      );
      setMessage("Member role updated.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The role was not updated.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(memberId: string) {
    if (!activeTeamId || busy) return;
    if (!window.confirm("Remove this person from the team?")) return;
    setBusy(true);
    clearNotices();

    try {
      const response = await fetch(
        `/api/newton/teams/${activeTeamId}/members/${memberId}`,
        { method: "DELETE", headers: accountJsonHeaders },
      );
      await readJson(response);
      setMembers((previous) =>
        previous.filter((member) => member.id !== memberId),
      );
      setMessage("Member removed from the team.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The member was not removed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createChannel() {
    if (!activeTeamId || !channelName.trim() || busy) return;
    setBusy(true);
    clearNotices();

    try {
      const response = await fetch(
        `/api/newton/teams/${activeTeamId}/channels`,
        {
          method: "POST",
          headers: accountJsonHeaders,
          body: JSON.stringify({
            name: channelName.trim(),
            description: channelDescription.trim() || undefined,
          }),
        },
      );
      const data = await readJson<{ channel: NewtonTeamChannel }>(response);
      setChannels((previous) => [...previous, data.channel]);
      setChannelName("");
      setChannelDescription("");
      setMessage(`#${data.channel.name} created.`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The channel was not created.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-ink-900 dark:text-white sm:text-3xl">
            Teams
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-500 dark:text-white/45">
            Create teams, invite colleagues and decide who can manage members
            and channels. Team chat lives separately from Aria AI.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowTeamForm((value) => !value)}
            className="btn-primary btn-md"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            New team
          </button>
          {activeTeamId ? (
            <Link
              href={`/newton/app/chat?team=${activeTeamId}`}
              className="btn-light btn-md"
            >
              <MessagesSquare aria-hidden="true" className="h-4 w-4" />
              Open chat
            </Link>
          ) : null}
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium leading-5 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium leading-5 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200">
          {message}
        </p>
      ) : null}

      {showTeamForm ? (
        <section className="rounded-2xl border border-ink-100 bg-white p-4 dark:border-white/10 dark:bg-ink-900">
          <h2 className="text-sm font-semibold text-ink-900 dark:text-white">
            Create a team
          </h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void createTeam();
            }}
            className="mt-3 flex flex-col gap-2 sm:flex-row"
          >
            <input
              value={newTeamName}
              onChange={(event) => setNewTeamName(event.target.value)}
              placeholder="e.g. Xenon Operations"
              maxLength={80}
              className="field flex-1"
              aria-label="Team name"
            />
            <button
              type="submit"
              disabled={!newTeamName.trim() || busy}
              className="btn-primary btn-md shrink-0"
            >
              {busy ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Plus aria-hidden="true" className="h-4 w-4" />
              )}
              Create team
            </button>
          </form>
          <p className="mt-2 text-[0.62rem] leading-5 text-ink-400 dark:text-white/30">
            Every new team starts with a #general channel and you as the owner.
          </p>
        </section>
      ) : null}

      {teams.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-ink-200 bg-white p-10 text-center dark:border-white/15 dark:bg-ink-900">
          <Users
            aria-hidden="true"
            className="mx-auto h-8 w-8 text-ink-300 dark:text-white/20"
          />
          <p className="mt-3 text-sm font-semibold text-ink-800 dark:text-white/80">
            No teams yet
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-ink-500 dark:text-white/45">
            Create your first team above, then invite people by email. Invited
            addresses activate automatically when they sign in.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-6">
          <aside className="space-y-2">
            <p className="px-1 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-ink-400 dark:text-white/30">
              Your teams
            </p>
            {teams.map((team) => {
              const active = team.id === activeTeamId;
              return (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => void loadTeam(team.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition",
                    active
                      ? "border-brand-200 bg-brand-50 dark:border-sky/30 dark:bg-sky/10"
                      : "border-ink-100 bg-white hover:border-brand-200 dark:border-white/10 dark:bg-ink-900 dark:hover:border-sky/30",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold",
                      active
                        ? "bg-brand-600 text-white dark:bg-sky dark:text-ink-950"
                        : "bg-mist text-ink-500 dark:bg-white/10 dark:text-white/50",
                    )}
                  >
                    {team.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink-900 dark:text-white">
                      {team.name}
                    </span>
                    <span className="mt-0.5 block text-[0.6rem] text-ink-400 dark:text-white/30">
                      {team.memberCount} member
                      {team.memberCount === 1 ? "" : "s"} · {team.role}
                    </span>
                  </span>
                </button>
              );
            })}
          </aside>

          {activeTeam ? (
            <div className="space-y-4">
              <section className="rounded-2xl border border-ink-100 bg-white p-4 dark:border-white/10 dark:bg-ink-900">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex-1">
                    <label
                      htmlFor="team-name"
                      className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-ink-400 dark:text-white/30"
                    >
                      Team name
                    </label>
                    <input
                      id="team-name"
                      value={teamName}
                      onChange={(event) => setTeamName(event.target.value)}
                      maxLength={80}
                      disabled={!canManage}
                      className="field mt-1.5"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void renameTeam()}
                    disabled={
                      !canManage ||
                      busy ||
                      !teamName.trim() ||
                      teamName.trim() === activeTeam.name
                    }
                    className="btn-light btn-md shrink-0"
                  >
                    Save name
                  </button>
                </div>
              </section>

              <section className="rounded-2xl border border-ink-100 bg-white dark:border-white/10 dark:bg-ink-900">
                <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <Users
                      aria-hidden="true"
                      className="h-4 w-4 text-brand-600 dark:text-sky"
                    />
                    <h2 className="text-sm font-semibold text-ink-900 dark:text-white">
                      Members
                    </h2>
                  </div>
                  <span className="text-[0.62rem] text-ink-400 dark:text-white/30">
                    {members.filter((member) => member.status === "active").length}{" "}
                    active
                  </span>
                </div>

                {canManage ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void inviteMember();
                    }}
                    className="flex flex-col gap-2 border-b border-ink-100 px-4 py-3 dark:border-white/10 sm:flex-row"
                  >
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      placeholder="colleague@company.com"
                      className="field flex-1"
                      aria-label="Member email"
                    />
                    <select
                      value={inviteRole}
                      onChange={(event) =>
                        setInviteRole(event.target.value as "member" | "admin")
                      }
                      className="field sm:w-36"
                      aria-label="Member role"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      type="submit"
                      disabled={!inviteEmail.trim() || busy}
                      className="btn-primary btn-md shrink-0"
                    >
                      <UserPlus aria-hidden="true" className="h-4 w-4" />
                      Invite
                    </button>
                  </form>
                ) : null}

                <ul className="divide-y divide-ink-50 dark:divide-white/5">
                  {loading && members.length === 0 ? (
                    <li className="flex items-center gap-2 px-4 py-4 text-xs text-ink-400 dark:text-white/35">
                      <Loader2
                        aria-hidden="true"
                        className="h-3.5 w-3.5 animate-spin"
                      />
                      Loading members…
                    </li>
                  ) : null}

                  {members.map((member) => (
                    <li
                      key={member.id}
                      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-900 dark:text-white">
                          {member.name || member.email}
                        </p>
                        <p className="mt-0.5 truncate text-[0.62rem] text-ink-400 dark:text-white/30">
                          {member.email}
                          {member.status === "invited" ? " · invitation pending" : ""}
                          {member.joinedAt
                            ? ` · joined ${formatDate(member.joinedAt)}`
                            : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.1em]",
                            member.role === "owner"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200"
                              : member.role === "admin"
                                ? "bg-brand-50 text-brand-700 dark:bg-sky/10 dark:text-sky"
                                : "bg-ink-50 text-ink-500 dark:bg-white/5 dark:text-white/45",
                          )}
                        >
                          {member.role === "owner" ? (
                            <ShieldCheck aria-hidden="true" className="h-3 w-3" />
                          ) : null}
                          {member.role}
                        </span>

                        {canManage &&
                        member.role !== "owner" &&
                        member.status !== "removed" ? (
                          <>
                            <select
                              value={member.role}
                              onChange={(event) =>
                                void updateRole(
                                  member.id,
                                  event.target.value as "admin" | "member",
                                )
                              }
                              disabled={busy}
                              aria-label={`Role for ${member.email}`}
                              className="field h-8 w-24 py-1 text-xs"
                            >
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => void removeMember(member.id)}
                              disabled={busy}
                              aria-label={`Remove ${member.email}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition hover:bg-rose-50 hover:text-rose-600 dark:text-white/35 dark:hover:bg-rose-400/10 dark:hover:text-rose-300"
                            >
                              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-2xl border border-ink-100 bg-white dark:border-white/10 dark:bg-ink-900">
                <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <Hash
                      aria-hidden="true"
                      className="h-4 w-4 text-brand-600 dark:text-sky"
                    />
                    <h2 className="text-sm font-semibold text-ink-900 dark:text-white">
                      Channels
                    </h2>
                  </div>
                  <Link
                    href={`/newton/app/chat?team=${activeTeam.id}`}
                    className="inline-flex items-center gap-1 text-[0.68rem] font-semibold text-brand-700 hover:text-brand-800 dark:text-sky dark:hover:text-white"
                  >
                    Open chat
                    <ArrowRight aria-hidden="true" className="h-3 w-3" />
                  </Link>
                </div>

                {canManage ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void createChannel();
                    }}
                    className="flex flex-col gap-2 border-b border-ink-100 px-4 py-3 dark:border-white/10 sm:flex-row"
                  >
                    <input
                      value={channelName}
                      onChange={(event) => setChannelName(event.target.value)}
                      placeholder="channel-name"
                      maxLength={60}
                      className="field sm:w-48"
                      aria-label="Channel name"
                    />
                    <input
                      value={channelDescription}
                      onChange={(event) =>
                        setChannelDescription(event.target.value)
                      }
                      placeholder="What is this channel for? (optional)"
                      maxLength={280}
                      className="field flex-1"
                      aria-label="Channel description"
                    />
                    <button
                      type="submit"
                      disabled={!channelName.trim() || busy}
                      className="btn-light btn-md shrink-0"
                    >
                      <Plus aria-hidden="true" className="h-4 w-4" />
                      Add
                    </button>
                  </form>
                ) : null}

                <ul className="divide-y divide-ink-50 dark:divide-white/5">
                  {channels.length === 0 ? (
                    <li className="px-4 py-4 text-xs text-ink-400 dark:text-white/35">
                      No channels yet.
                    </li>
                  ) : (
                    channels.map((channel) => (
                      <li
                        key={channel.id}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/newton/app/chat?team=${activeTeam.id}&channel=${channel.id}`}
                            className="truncate text-sm font-semibold text-ink-900 hover:text-brand-700 dark:text-white dark:hover:text-sky"
                          >
                            #{channel.name}
                          </Link>
                          {channel.description ? (
                            <p className="mt-0.5 truncate text-[0.62rem] text-ink-400 dark:text-white/30">
                              {channel.description}
                            </p>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-[0.62rem] text-ink-400 dark:text-white/30">
                          {channel.messageCount} message
                          {channel.messageCount === 1 ? "" : "s"}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </section>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
