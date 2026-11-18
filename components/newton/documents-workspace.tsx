"use client";

import { useMemo, useState } from "react";
import {
  FilePlus2,
  FileText,
  Loader2,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { accountJsonHeaders } from "@/components/account/client";
import { cn } from "@/lib/utils";
import type { NewtonDocument } from "@/lib/newton/types";

type TeamOption = { id: string; name: string };

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function DocumentsWorkspace({
  initialDocuments,
  teams,
}: {
  initialDocuments: NewtonDocument[];
  teams: TeamOption[];
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialDocuments[0]?.id ?? null,
  );
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState(initialDocuments[0]?.title ?? "");
  const [body, setBody] = useState(initialDocuments[0]?.body ?? "");
  const [tags, setTags] = useState((initialDocuments[0]?.tags ?? []).join(", "));
  const [teamId, setTeamId] = useState<string | null>(
    initialDocuments[0]?.teamId ?? null,
  );
  const [creating, setCreating] = useState(!initialDocuments.length);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return documents;
    return documents.filter(
      (document) =>
        document.title.toLowerCase().includes(term) ||
        document.body.toLowerCase().includes(term) ||
        document.tags.some((tag) => tag.includes(term)),
    );
  }, [documents, search]);

  function selectDocument(document: NewtonDocument) {
    setSelectedId(document.id);
    setTitle(document.title);
    setBody(document.body);
    setTags(document.tags.join(", "));
    setTeamId(document.teamId);
    setCreating(false);
    setError(null);
    setNotice(null);
  }

  function startNew() {
    setSelectedId(null);
    setTitle("");
    setBody("");
    setTags("");
    setTeamId(null);
    setCreating(true);
    setError(null);
    setNotice(null);
  }

  function parseTags(value: string) {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  async function save() {
    if (busy) return;
    if (!title.trim()) {
      setError("Give the document a title.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        creating ? "/api/newton/documents" : `/api/newton/documents/${selectedId}`,
        {
          method: creating ? "POST" : "PATCH",
          headers: accountJsonHeaders,
          body: JSON.stringify(
            creating
              ? { title, body, tags: parseTags(tags), teamId }
              : { title, body, tags: parseTags(tags) },
          ),
        },
      );

      const data = (await response.json().catch(() => ({}))) as {
        document?: NewtonDocument;
        error?: string;
      };
      if (!response.ok || !data.document) {
        throw new Error(data.error || "The document could not be saved.");
      }

      const saved = data.document;
      setDocuments((previous) => {
        const exists = previous.some((item) => item.id === saved.id);
        return exists
          ? previous.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...previous];
      });
      setSelectedId(saved.id);
      setTitle(saved.title);
      setBody(saved.body);
      setTags(saved.tags.join(", "));
      setTeamId(saved.teamId);
      setCreating(false);
      setNotice("Saved.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The document could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!selectedId || busy) return;
    if (!window.confirm("Delete this document? This cannot be undone.")) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/newton/documents/${selectedId}`, {
        method: "DELETE",
        headers: accountJsonHeaders,
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || "The document could not be deleted.");
      }
      const remaining = documents.filter((item) => item.id !== selectedId);
      setDocuments(remaining);
      if (remaining[0]) {
        selectDocument(remaining[0]);
      } else {
        startNew();
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The document could not be deleted.",
      );
    } finally {
      setBusy(false);
    }
  }

  const selected = documents.find((item) => item.id === selectedId) ?? null;
  const readOnly = Boolean(selected && !selected.canEdit);

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-6 sm:px-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col rounded-2xl border border-ink-100 bg-white dark:border-white/10 dark:bg-ink-900">
        <div className="space-y-2 border-b border-ink-100 p-3 dark:border-white/10">
          <button type="button" onClick={startNew} className="btn-primary btn-sm w-full">
            <FilePlus2 aria-hidden="true" className="h-3.5 w-3.5" />
            New document
          </button>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400 dark:text-white/30"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search documents"
              className="field h-9 py-1 pl-8 text-xs"
            />
          </div>
        </div>
        <div className="max-h-[28rem] flex-1 overflow-y-auto p-2 lg:max-h-[calc(100vh-16rem)]">
          {filtered.length === 0 ? (
            <p className="px-2 py-4 text-xs leading-5 text-ink-500 dark:text-white/40">
              {documents.length === 0
                ? "No documents yet. Create one to capture a plan, policy or meeting note."
                : "No documents match that search."}
            </p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((document) => (
                <li key={document.id}>
                  <button
                    type="button"
                    onClick={() => selectDocument(document)}
                    className={cn(
                      "w-full rounded-xl px-2.5 py-2 text-left transition",
                      document.id === selectedId
                        ? "bg-brand-50 dark:bg-sky/10"
                        : "hover:bg-ink-50 dark:hover:bg-white/5",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <FileText
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0 text-ink-400 dark:text-white/30"
                      />
                      <span className="truncate text-xs font-semibold text-ink-800 dark:text-white/80">
                        {document.title}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[0.58rem] text-ink-400 dark:text-white/30">
                      {document.teamName ? `${document.teamName} · ` : "Personal · "}
                      {formatDate(document.updatedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col rounded-2xl border border-ink-100 bg-white dark:border-white/10 dark:bg-ink-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 p-3 dark:border-white/10">
          <div className="min-w-0">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-brand-700 dark:text-sky">
              {creating ? "New document" : selected?.teamName ? "Team document" : "Personal document"}
            </p>
            <p className="mt-0.5 truncate text-xs text-ink-500 dark:text-white/40">
              {selected?.canEdit === false
                ? "Read only — you can view this team document but not edit it."
                : "Documents are private to you or shared with one team."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!creating ? (
              <button
                type="button"
                onClick={() => void remove()}
                disabled={busy || readOnly}
                className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 px-3 py-1.5 text-[0.65rem] font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-40 dark:border-rose-400/30 dark:text-rose-300 dark:hover:bg-rose-400/10"
              >
                <Trash2 aria-hidden="true" className="h-3 w-3" />
                Delete
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy || readOnly}
              className="btn-primary btn-sm"
            >
              {busy ? (
                <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save aria-hidden="true" className="h-3.5 w-3.5" />
              )}
              {busy ? "Saving" : "Save"}
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-3 p-4">
          {error ? (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200">
              {notice}
            </p>
          ) : null}

          <div>
            <label htmlFor="doc-title" className="sr-only">
              Document title
            </label>
            <input
              id="doc-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              readOnly={readOnly}
              placeholder="Document title"
              className="w-full border-0 bg-transparent p-0 font-display text-2xl font-semibold tracking-[-0.02em] text-ink-900 outline-none placeholder:text-ink-300 focus:ring-0 dark:text-white dark:placeholder:text-white/20"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="doc-team" className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-white/35">
                Shared with
              </label>
              <select
                id="doc-team"
                value={teamId ?? ""}
                onChange={(event) => setTeamId(event.target.value || null)}
                disabled={!creating || readOnly}
                className="field h-9 py-1 text-xs disabled:opacity-60"
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
              <label htmlFor="doc-tags" className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-white/35">
                Tags (comma separated)
              </label>
              <input
                id="doc-tags"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                readOnly={readOnly}
                placeholder="policy, onboarding"
                className="field h-9 py-1 text-xs"
              />
            </div>
          </div>

          <div className="flex-1">
            <label htmlFor="doc-body" className="sr-only">
              Document body
            </label>
            <textarea
              id="doc-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              readOnly={readOnly}
              maxLength={200_000}
              rows={18}
              placeholder="Write the document here. Aria can help you draft sections — ask it in Aria AI and paste the result back."
              className="field min-h-[26rem] w-full resize-y py-3 font-mono text-[0.8rem] leading-6"
            />
          </div>
          <p className="text-[0.6rem] text-ink-400 dark:text-white/30">
            {body.length.toLocaleString("en-GB")} characters
            {selected ? ` · last saved ${formatDate(selected.updatedAt)}` : ""}
          </p>
        </div>
      </section>
    </div>
  );
}
