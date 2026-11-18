"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Hash,
  Loader2,
  MessagesSquare,
  Plus,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { accountJsonHeaders } from "@/components/account/client";
import { cn } from "@/lib/utils";
import type {
  NewtonChannelMessage,
  NewtonTeamChannel,
  NewtonTeamSummary,
} from "@/lib/newton/types";

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    timeZone: "Asia/Bahrain",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error || "Something went wrong. Please try again.");
  }
  return data;
}

export function TeamChat({
  currentAccountId,
  initialTeams,
  initialTeamId,
  initialChannels,
  initialChannelId,
  initialMessages,
}: {
  currentAccountId: string;
  initialTeams: NewtonTeamSummary[];
  initialTeamId: string | null;
  initialChannels: NewtonTeamChannel[];
  initialChannelId: string | null;
  initialMessages: NewtonChannelMessage[];
}) {
  const [teams, setTeams] = useState(initialTeams);
  const [activeTeamId, setActiveTeamId] = useState(initialTeamId);
  const [channels, setChannels] = useState(initialChannels);
  const [activeChannelId, setActiveChannelId] = useState(initialChannelId);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [channelName, setChannelName] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeTeam = teams.find((team) => team.id === activeTeamId) ?? null;
  const activeChannel =
    channels.find((channel) => channel.id === activeChannelId) ?? null;
  const canManage = activeTeam?.role === "owner" || activeTeam?.role === "admin";

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, busy]);

  async function fetchMessages(channelId: string, quiet = false) {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(
        `/api/newton/channels/${channelId}/messages?limit=100`,
        { cache: "no-store" },
      );
      const data = await readJson<{ messages: NewtonChannelMessage[] }>(response);
      setMessages(data.messages);
    } catch (cause) {
      if (!quiet) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Messages could not be loaded.",
        );
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  async function openChannel(channelId: string) {
    setActiveChannelId(channelId);
    setMessages([]);
    setError(null);
    await fetchMessages(channelId);
    inputRef.current?.focus();
  }

  async function openTeam(teamId: string) {
    setActiveTeamId(teamId);
    setError(null);
    setLoading(true);
    setMessages([]);
    setChannels([]);
    setActiveChannelId(null);

    try {
      const response = await fetch(`/api/newton/teams/${teamId}`, {
        cache: "no-store",
      });
      const data = await readJson<{ channels: NewtonTeamChannel[] }>(response);
      setChannels(data.channels);

      const firstChannel = data.channels[0];
      if (firstChannel) {
        setActiveChannelId(firstChannel.id);
        await fetchMessages(firstChannel.id, true);
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "That team could not be opened.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!activeChannelId) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchMessages(activeChannelId, true);
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [activeChannelId]);

  async function send() {
    if (!activeChannelId || !draft.trim() || busy) return;

    const content = draft.trim();
    setBusy(true);
    setError(null);
    setDraft("");

    try {
      const response = await fetch(
        `/api/newton/channels/${activeChannelId}/messages`,
        {
          method: "POST",
          headers: accountJsonHeaders,
          body: JSON.stringify({ content }),
        },
      );
      const data = await readJson<{ message: NewtonChannelMessage }>(response);
      setMessages((previous) => [...previous, data.message]);
    } catch (cause) {
      setDraft(content);
      setError(
        cause instanceof Error ? cause.message : "Your message was not sent.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeMessage(messageId: string) {
    if (!activeChannelId) return;
    if (!window.confirm("Delete this message?")) return;

    try {
      const response = await fetch(
        `/api/newton/channels/${activeChannelId}/messages/${messageId}`,
        { method: "DELETE", headers: accountJsonHeaders },
      );
      await readJson(response);
      setMessages((previous) =>
        previous.map((message) =>
          message.id === messageId
            ? {
                ...message,
                body: "This message was deleted.",
                deletedAt: new Date().toISOString(),
              }
            : message,
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The message was not deleted.",
      );
    }
  }

  async function createChannel() {
    if (!activeTeamId || !channelName.trim()) return;

    try {
      const response = await fetch(`/api/newton/teams/${activeTeamId}/channels`, {
        method: "POST",
        headers: accountJsonHeaders,
        body: JSON.stringify({ name: channelName.trim() }),
      });
      const data = await readJson<{ channel: NewtonTeamChannel }>(response);
      setChannels((previous) => [...previous, data.channel]);
      setChannelName("");
      setShowChannelForm(false);
      await openChannel(data.channel.id);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The channel was not created.",
      );
    }
  }

  if (teams.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <div className="rounded-3xl border border-dashed border-ink-200 bg-white p-10 text-center dark:border-white/15 dark:bg-ink-900">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-sky/10 dark:text-sky">
            <MessagesSquare aria-hidden="true" className="h-6 w-6" />
          </span>
          <h1 className="mt-5 font-display text-2xl font-semibold text-ink-900 dark:text-white">
            Team chat starts with a team
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-500 dark:text-white/45">
            Create a team, invite colleagues and open your first channel. Chat is
            kept separate from Aria AI so both stay focused.
          </p>
          <Link href="/newton/app/teams" className="btn-primary btn-md mt-6">
            <Users aria-hidden="true" className="h-4 w-4" />
            Set up a team
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6 lg:py-6">
      <aside className="flex flex-col gap-3">
        <div className="rounded-2xl border border-ink-100 bg-white p-3 dark:border-white/10 dark:bg-ink-900">
          <label
            htmlFor="team-select"
            className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-ink-400 dark:text-white/30"
          >
            Team
          </label>
          <select
            id="team-select"
            value={activeTeamId ?? ""}
            onChange={(event) => void openTeam(event.target.value)}
            className="field mt-1.5"
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white p-2 dark:border-white/10 dark:bg-ink-900">
          <div className="flex items-center justify-between gap-2 px-2 pb-1 pt-1">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-ink-400 dark:text-white/30">
              Channels
            </p>
            {canManage ? (
              <button
                type="button"
                onClick={() => setShowChannelForm((value) => !value)}
                aria-label="Create channel"
                className="rounded-lg p-1 text-ink-400 transition hover:bg-ink-50 hover:text-ink-800 dark:text-white/35 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <Plus aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {showChannelForm ? (
            <div className="mb-2 flex gap-1.5 px-1">
              <input
                value={channelName}
                onChange={(event) => setChannelName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void createChannel();
                  }
                }}
                placeholder="new-channel"
                maxLength={60}
                className="field h-8 py-1 text-xs"
              />
              <button
                type="button"
                onClick={() => void createChannel()}
                disabled={!channelName.trim()}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-40 dark:bg-sky dark:text-ink-950"
                aria-label="Create channel"
              >
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          <div className="flex max-h-[16rem] gap-1 overflow-x-auto pb-1 lg:max-h-[26rem] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
            {channels.length === 0 ? (
              <p className="px-2 py-3 text-xs leading-5 text-ink-500 dark:text-white/40">
                No channels yet.
              </p>
            ) : (
              channels.map((channel) => {
                const active = channel.id === activeChannelId;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => void openChannel(channel.id)}
                    className={cn(
                      "flex min-w-[12rem] items-center gap-1.5 rounded-xl px-2 py-2 text-left text-xs font-semibold transition lg:min-w-0",
                      active
                        ? "bg-brand-50 text-brand-800 dark:bg-sky/10 dark:text-sky"
                        : "text-ink-600 hover:bg-ink-50 dark:text-white/55 dark:hover:bg-white/5 dark:hover:text-white",
                    )}
                  >
                    <Hash aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{channel.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <Link
          href="/newton/app/teams"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-ink-100 bg-white px-3 py-2 text-xs font-semibold text-ink-600 transition hover:border-brand-200 hover:text-brand-700 dark:border-white/10 dark:bg-ink-900 dark:text-white/55 dark:hover:text-white"
        >
          <Users aria-hidden="true" className="h-3.5 w-3.5" />
          Manage team & members
        </Link>
      </aside>

      <section className="flex min-h-[70vh] flex-col overflow-hidden rounded-3xl border border-ink-100 bg-white shadow-soft dark:border-white/10 dark:bg-ink-900 dark:shadow-none lg:h-[calc(100vh-11rem)]">
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3 dark:border-white/10 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink-900 dark:text-white">
              <Hash aria-hidden="true" className="h-4 w-4 text-brand-600 dark:text-sky" />
              <span className="truncate">
                {activeChannel?.name || "Select a channel"}
              </span>
            </div>
            {activeChannel?.description ? (
              <p className="mt-0.5 truncate text-[0.62rem] text-ink-400 dark:text-white/35">
                {activeChannel.description}
              </p>
            ) : null}
          </div>
          <span className="hidden shrink-0 text-[0.62rem] text-ink-400 dark:text-white/30 sm:inline">
            {activeTeam?.name} · {activeTeam?.memberCount} member
            {activeTeam?.memberCount === 1 ? "" : "s"}
          </span>
        </div>

        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6"
        >
          {loading && messages.length === 0 ? (
            <p className="flex items-center gap-2 text-xs text-ink-400 dark:text-white/35">
              <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              Loading messages…
            </p>
          ) : null}

          {!loading && messages.length === 0 ? (
            <div className="mx-auto flex h-full max-w-lg flex-col justify-center py-8 text-center">
              <Hash aria-hidden="true" className="mx-auto h-8 w-8 text-ink-300 dark:text-white/20" />
              <p className="mt-3 text-sm font-semibold text-ink-800 dark:text-white/80">
                {activeChannel
                  ? `This is the start of #${activeChannel.name}`
                  : "Choose a channel to start"}
              </p>
              <p className="mt-1 text-xs leading-5 text-ink-500 dark:text-white/45">
                Messages here are shared with everyone in {activeTeam?.name}.
              </p>
            </div>
          ) : null}

          {messages.map((message) => {
            const mine = message.authorAccountId === currentAccountId;
            const deleted = Boolean(message.deletedAt);
            return (
              <article
                key={message.id}
                className={cn(
                  "group max-w-[92%] rounded-2xl px-4 py-2.5 text-sm leading-6",
                  mine
                    ? "ml-auto rounded-br-md bg-brand-600 text-white"
                    : "mr-auto rounded-bl-md border border-ink-100 bg-mist text-ink-800 dark:border-white/10 dark:bg-white/5 dark:text-white/80",
                  deleted && "italic opacity-60",
                )}
              >
                <div
                  className={cn(
                    "flex items-center gap-2 text-[0.6rem]",
                    mine ? "text-white/70" : "text-ink-400 dark:text-white/30",
                  )}
                >
                  <span className="font-semibold">{message.authorName}</span>
                  <span>{formatTime(message.createdAt)}</span>
                  {!deleted && (mine || canManage) ? (
                    <button
                      type="button"
                      onClick={() => void removeMessage(message.id)}
                      aria-label="Delete message"
                      className={cn(
                        "ml-auto rounded p-0.5 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100",
                        mine
                          ? "hover:bg-white/15"
                          : "hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-400/10",
                      )}
                    >
                      <Trash2 aria-hidden="true" className="h-3 w-3" />
                    </button>
                  ) : null}
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words">{message.body}</p>
              </article>
            );
          })}
        </div>

        <div className="border-t border-ink-100 px-4 py-3 dark:border-white/10 sm:px-6">
          {error ? (
            <p
              role="alert"
              className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium leading-5 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300"
            >
              {error}
            </p>
          ) : null}

          {activeChannel ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
              className="flex items-end gap-2"
            >
              <label htmlFor="team-message" className="sr-only">
                Message {activeChannel.name}
              </label>
              <textarea
                id="team-message"
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    void send();
                  }
                }}
                rows={2}
                maxLength={4000}
                disabled={busy}
                placeholder={`Message #${activeChannel.name}…`}
                className="field min-h-[3.25rem] flex-1 resize-none py-2.5 leading-6"
              />
              <button
                type="submit"
                disabled={!draft.trim() || busy}
                aria-label="Send message"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-soft transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-sky dark:text-ink-950 dark:hover:bg-white"
              >
                {busy ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <Send aria-hidden="true" className="h-4 w-4" />
                )}
              </button>
            </form>
          ) : (
            <p className="text-xs text-ink-400 dark:text-white/30">
              Select a channel in the sidebar.
            </p>
          )}
          <p className="mt-1.5 text-[0.6rem] text-ink-400 dark:text-white/30">
            Enter to send · Shift + Enter for a new line · Messages are visible to
            the whole team.
          </p>
        </div>
      </section>
    </div>
  );
}
