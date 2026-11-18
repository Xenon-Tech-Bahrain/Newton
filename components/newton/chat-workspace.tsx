"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  FileText,
  Globe,
  Image,
  Loader2,
  Mic,
  Plus,
  Sparkles,
  Square,
  StopCircle,
  Trash2,
  X,
} from "lucide-react";
import { accountJsonHeaders } from "@/components/account/client";
import { cn } from "@/lib/utils";
import type {
  NewtonAttachment,
  NewtonMessage,
  NewtonModerationState,
  NewtonPublicLimits,
  NewtonStatus,
  NewtonThreadSummary,
  NewtonUsage,
} from "@/lib/newton/types";
import { NEWTON_MODEL_LABEL } from "@/lib/newton/config";

type TokenUsage = {
  prompt: number;
  completion: number;
  total: number;
};

type StreamEvent =
  | { type: "meta"; threadId: string; model: string; title: string }
  | { type: "delta"; text: string }
  | {
      type: "done";
      messageId: string;
      title: string;
      model: string;
      usage: TokenUsage;
    }
  | { type: "error"; message: string };

const SUGGESTIONS = [
  "Draft a polite follow-up to a customer who has not replied.",
  "Turn these notes into a one-page plan.",
  "Compare two suppliers and list the trade-offs.",
  "Write a short job description for a repair technician.",
];

async function readEventStream(
  response: Response,
  onEvent: (event: StreamEvent) => void,
) {
  if (!response.body) {
    throw new Error("Aria returned an empty response. Please try again.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");

      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");

        const payload = block
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("");

        if (!payload) continue;

        let event: StreamEvent;
        try {
          event = JSON.parse(payload) as StreamEvent;
        } catch {
          continue;
        }

        onEvent(event);
      }
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
}

function shortDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isReadableTextFile(file: File) {
  return (
    /^text\//i.test(file.type) ||
    /^application\/(json|xml|csv|x-yaml|yaml)$/i.test(file.type) ||
    /\.(txt|md|markdown|csv|tsv|json|log|xml|yml|yaml)$/i.test(file.name)
  );
}

export function NewtonWorkspace({
  firstName,
  initialThreads,
  initialUsage,
  limits,
  status,
  visionReady = false,
  moderation,
}: {
  firstName: string;
  initialThreads: NewtonThreadSummary[];
  initialUsage: NewtonUsage;
  limits: NewtonPublicLimits;
  status: NewtonStatus;
  visionReady?: boolean;
  moderation?: NewtonModerationState;
}) {
  const [threads, setThreads] = useState(initialThreads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<NewtonMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [usage, setUsage] = useState(initialUsage);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<NewtonAttachment[]>([]);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [webUrl, setWebUrl] = useState("");
  const [webOpen, setWebOpen] = useState(false);
  const [fetchingPage, setFetchingPage] = useState(false);
  const [uploading, setUploading] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);

  const moderationBlocked =
    moderation?.state === "restricted" ||
    moderation?.state === "suspended" ||
    moderation?.state === "terminated";
  const ready = status === "ready" && !moderationBlocked;

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, streamingText, busy]);

  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
    };
  }, []);

  function resetToNewChat() {
    abortRef.current?.abort();
    setActiveId(null);
    setMessages([]);
    setStreamingText("");
    setError(null);
    setDraft("");
    setAttachments([]);
    setVoiceBlob(null);
    inputRef.current?.focus();
  }

  async function loadThread(id: string) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/newton/threads/${id}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as {
        thread?: NewtonThreadSummary;
        messages?: NewtonMessage[];
        error?: string;
      };

      if (!response.ok || !data.thread || !data.messages) {
        throw new Error(data.error || "That chat could not be loaded.");
      }

      setActiveId(data.thread.id);
      setMessages(data.messages);
      setThreads((previous) =>
        previous.map((thread) =>
          thread.id === data.thread?.id ? (data.thread as NewtonThreadSummary) : thread,
        ),
      );

      return data.messages;
    } finally {
      setLoading(false);
    }
  }

  async function startNewChat() {
    resetToNewChat();
  }

  async function removeThread(id: string) {
    if (!window.confirm("Delete this chat? This cannot be undone.")) return;

    try {
      const response = await fetch(`/api/newton/threads/${id}`, {
        method: "DELETE",
        headers: accountJsonHeaders,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || "The chat could not be deleted.");
      }

      setThreads((previous) => previous.filter((thread) => thread.id !== id));
      if (activeId === id) resetToNewChat();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The chat could not be deleted.",
      );
    }
  }

  async function reloadAfterFailure(threadId: string, content: string) {
    try {
      const latest = await loadThread(threadId);
      const persisted = latest.some(
        (message) => message.role === "user" && message.content === content,
      );
      if (!persisted) setDraft(content);
    } catch {
      setDraft(content);
    }
  }

  function addAttachment(file: File) {
    if (attachments.length >= 5) {
      setError("Maximum 5 attachments per message.");
      return;
    }

    const id = `att-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    if (file.type.startsWith("image/")) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Images must be 5 MB or smaller.");
        return;
      }

      setUploading((count) => count + 1);
      const form = new FormData();
      form.append("file", file);

      void fetch("/api/newton/attachments", {
        method: "POST",
        headers: { "x-xenon-csrf": "1" },
        body: form,
      })
        .then(async (response) => {
          const data = (await response.json().catch(() => ({}))) as {
            attachment?: {
              id: string;
              name: string;
              mimeType: string;
              size: number;
              url: string;
            };
            error?: string;
          };
          if (!response.ok || !data.attachment) {
            throw new Error(data.error || "That image could not be attached.");
          }
          const image = data.attachment;
          setAttachments((previous) => [
            ...previous,
            {
              id: image.id,
              type: "image",
              name: image.name,
              size: image.size,
              mimeType: image.mimeType,
              url: image.url,
            },
          ]);
        })
        .catch((cause: unknown) => {
          setError(
            cause instanceof Error
              ? cause.message
              : "That image could not be attached.",
          );
        })
        .finally(() => setUploading((count) => Math.max(0, count - 1)));

      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (!isReadableTextFile(file)) {
      setError(
        "Attach images, or text files such as .txt, .md, .csv, .json or .log. PDFs and Word files are not readable yet.",
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Text files must be 2 MB or smaller.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    void file
      .text()
      .then((text) => {
        setAttachments((previous) => [
          ...previous,
          {
            id,
            type: "document",
            name: file.name,
            size: file.size,
            mimeType: file.type || "text/plain",
            extractedText: text.slice(0, 60_000),
          },
        ]);
      })
      .catch(() => setError("That file could not be read."))
      .finally(() => {
        if (fileInputRef.current) fileInputRef.current.value = "";
      });
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function fetchPage() {
    const url = webUrl.trim();
    if (!url || fetchingPage) return;
    if (attachments.length >= 5) {
      setError("Maximum 5 attachments per message.");
      return;
    }

    setFetchingPage(true);
    setError(null);

    try {
      const response = await fetch("/api/newton/fetch-url", {
        method: "POST",
        headers: accountJsonHeaders,
        body: JSON.stringify({ url }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        page?: {
          finalUrl: string;
          title: string;
          text: string;
          truncated: boolean;
        };
        error?: string;
      };
      if (!response.ok || !data.page) {
        throw new Error(data.error || "That page could not be fetched.");
      }

      const page = data.page;
      setAttachments((previous) => [
        ...previous,
        {
          id: `web-${Date.now()}`,
          type: "web",
          name: page.title || new URL(page.finalUrl).hostname,
          size: page.text.length,
          mimeType: "text/html",
          url: page.finalUrl,
          sourceUrl: page.finalUrl,
          extractedText: page.text,
        },
      ]);
      setWebUrl("");
      setWebOpen(false);
      if (page.truncated) {
        setError(
          "That page was long, so Aria will read the first part of it.",
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "That page could not be fetched.",
      );
    } finally {
      setFetchingPage(false);
    }
  }

  async function startVoiceRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      voiceChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) voiceChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(voiceChunksRef.current, { type: "audio/webm" });
        setVoiceBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setVoiceRecording(true);
      setError(null);
    } catch {
      setError("Could not access the microphone. Please check your browser permissions.");
    }
  }

  function stopVoiceRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    setVoiceRecording(false);
  }

  async function send() {
    const content = draft.trim();
    if (!content && attachments.length === 0 && !voiceBlob) return;
    if (busy || !ready || uploading > 0) return;

    setBusy(true);
    setError(null);
    setDraft("");
    setStreamingText("");
    const currentAttachments = [...attachments];
    setAttachments([]);

    const voiceAttachment = voiceBlob;
    setVoiceBlob(null);
    setVoiceRecording(false);

    // If there's a voice blob, transcribe it via the browser (placeholder:
    // real speech-to-text needs an external service). We attach it as an
    // audio document reference.
    let voiceContent = "";
    if (voiceBlob) {
      voiceContent = `\n\n[Voice message attached - ${formatFileSize(voiceBlob.size)}]\n`;
    }

    const sendContent =
      content ||
      voiceContent.trim() ||
      (currentAttachments.length > 0
        ? "Please review the attached material and summarise what matters."
        : "");

    const optimistic: NewtonMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: sendContent,
      model: null,
      totalTokens: null,
      createdAt: new Date().toISOString(),
      attachments: [
        ...currentAttachments,
        ...(voiceBlob
          ? [{
              id: `att-voice-${Date.now()}`,
              type: "document" as const,
              name: "voice-message.webm",
              size: voiceBlob.size,
              mimeType: "audio/webm",
              url: URL.createObjectURL(voiceBlob),
            }]
          : []),
      ],
    };
    setMessages((previous) => [...previous, optimistic]);

    let threadId = activeId;

    try {
      if (!threadId) {
        const created = await fetch("/api/newton/threads", {
          method: "POST",
          headers: accountJsonHeaders,
          body: JSON.stringify({}),
        });
        const data = (await created.json().catch(() => ({}))) as {
          thread?: NewtonThreadSummary;
          error?: string;
        };

        if (!created.ok || !data.thread) {
          throw new Error(data.error || "A new chat could not be started.");
        }

        threadId = data.thread.id;
        setActiveId(threadId);
        setThreads((previous) => [data.thread as NewtonThreadSummary, ...previous]);
      }

      const controller = new AbortController();
      abortRef.current = controller;

      const response = await fetch(
        `/api/newton/threads/${threadId}/messages`,
        {
          method: "POST",
          headers: accountJsonHeaders,
          body: JSON.stringify({
            content: sendContent,
            attachments: currentAttachments.map((a) => ({
              id: a.id,
              type: a.type,
              name: a.name,
              size: a.size,
              mimeType: a.mimeType,
              url: a.url,
              extractedText: a.extractedText,
              sourceUrl: a.sourceUrl,
            })),
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || "Aria could not reply. Please try again.");
      }

      let reply = "";
      let finalTitle: string | null = null;

      await readEventStream(response, (event) => {
        if (event.type === "delta") {
          reply += event.text;
          setStreamingText(reply);
        } else if (event.type === "meta") {
          finalTitle = event.title;
        } else if (event.type === "done") {
          finalTitle = event.title;
          setUsage((previous) => ({
            requests: previous.requests + 1,
            promptTokens: previous.promptTokens + event.usage.prompt,
            completionTokens:
              previous.completionTokens + event.usage.completion,
            totalTokens: previous.totalTokens + event.usage.total,
          }));
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      });

      if (reply.trim()) {
        const finalReply = reply;
        setMessages((previous) => [
          ...previous,
          {
            id: `local-reply-${Date.now()}`,
            role: "assistant",
            content: finalReply,
            model: null,
            totalTokens: null,
            createdAt: new Date().toISOString(),
            attachments: [],
          },
        ]);
      }

      if (finalTitle && threadId) {
        const title = finalTitle;
        setThreads((previous) =>
          previous.map((thread) =>
            thread.id === threadId
              ? { ...thread, title, updatedAt: new Date().toISOString() }
              : thread,
          ),
        );
      }

      setStreamingText("");
      if (threadId) await loadThread(threadId);
    } catch (cause) {
      const aborted =
        cause instanceof DOMException && cause.name === "AbortError";

      if (threadId) {
        if (aborted) {
          await loadThread(threadId).catch(() => undefined);
        } else {
          await reloadAfterFailure(
            threadId,
            sendContent,
          );
        }
      } else {
        setDraft(content);
      }

      if (!aborted) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Something went wrong. Please try again.",
        );
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      setStreamingText("");
    }
  }

  function stop() {
    abortRef.current?.abort();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      setVoiceRecording(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  }

  async function exportConversation() {
    if (!activeId) return;
    const transcript = messages
      .map((m) => `${m.role === "user" ? "You" : "Aria"}: ${m.content}`)
      .join("\n\n");
    const blob = new Blob([transcript], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `newton-conversation-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const usedPercent = Math.min(
    100,
    Math.round((usage.requests / Math.max(1, limits.messagesPerDay)) * 100),
  );

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[290px_minmax(0,1fr)] lg:gap-6 lg:py-6">
      <aside className="flex flex-col gap-3">
        <button
          type="button"
          onClick={startNewChat}
          className="btn-primary btn-md w-full"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          New chat
        </button>

        <div className="rounded-2xl border border-ink-100 bg-white p-2 dark:border-white/10 dark:bg-ink-900">
          <p className="px-2 pb-1 pt-1 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-ink-400 dark:text-white/30">
            Chats
          </p>
          <div className="flex max-h-[16rem] gap-1.5 overflow-x-auto pb-1 lg:max-h-[24rem] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
            {threads.length === 0 ? (
              <p className="px-2 py-3 text-xs leading-5 text-ink-500 dark:text-white/40">
                No saved chats yet. Your first message starts one.
              </p>
            ) : (
              threads.map((thread) => {
                const active = thread.id === activeId;
                return (
                  <div
                    key={thread.id}
                    className={cn(
                      "flex min-w-[13rem] items-center gap-1 rounded-xl border px-2 py-2 transition lg:min-w-0",
                      active
                        ? "border-brand-200 bg-brand-50 dark:border-sky/25 dark:bg-sky/10"
                        : "border-transparent hover:bg-ink-50 dark:hover:bg-white/5",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => void loadThread(thread.id)}
                      className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                    >
                      <span
                        className={cn(
                          "block truncate text-xs font-semibold",
                          active
                            ? "text-brand-800 dark:text-sky"
                            : "text-ink-700 dark:text-white/70",
                        )}
                      >
                        {thread.title}
                      </span>
                      <span className="mt-0.5 block text-[0.58rem] text-ink-400 dark:text-white/30">
                        {thread.messageCount} message
                        {thread.messageCount === 1 ? "" : "s"}
                        {thread.lastMessageAt
                          ? ` · ${shortDate(thread.lastMessageAt)}`
                          : ""}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeThread(thread.id)}
                      aria-label={`Delete chat: ${thread.title}`}
                      className="rounded-lg p-1.5 text-ink-300 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 dark:text-white/25 dark:hover:bg-rose-400/10 dark:hover:text-rose-300"
                    >
                      <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white p-3 dark:border-white/10 dark:bg-ink-900">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-ink-400 dark:text-white/30">
            Today
          </p>
          <div className="mt-2 flex items-baseline justify-between text-xs">
            <span className="font-semibold text-ink-800 dark:text-white/80">
              {usage.requests} / {limits.messagesPerDay}
            </span>
            <span className="text-[0.62rem] text-ink-400 dark:text-white/35">
              messages
            </span>
          </div>
          <div
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-white/10"
            role="img"
            aria-label={`${usedPercent}% of today's message allowance used`}
          >
            <div
              className={cn(
                "h-full rounded-full transition-all",
                usedPercent > 85 ? "bg-rose-500" : "bg-brand-500",
              )}
              style={{ width: `${usedPercent}%` }}
            />
          </div>
          <p className="mt-2 text-[0.62rem] leading-4 text-ink-400 dark:text-white/35">
            {formatNumber(usage.totalTokens)} of{" "}
            {formatNumber(limits.tokensPerDay)} tokens
          </p>
        </div>
      </aside>

      <section className="flex min-h-[70vh] flex-col overflow-hidden rounded-3xl border border-ink-100 bg-white shadow-soft dark:border-white/10 dark:bg-ink-900 dark:shadow-none lg:h-[calc(100vh-10rem)]">
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3 dark:border-white/10 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink-900 dark:text-white">
              <Sparkles aria-hidden="true" className="h-4 w-4 text-brand-600 dark:text-sky" />
              Aria
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-[0.6rem] text-ink-400 dark:text-white/35">
                {NEWTON_MODEL_LABEL}
              </span>
            </div>
          </div>
          {busy ? (
            <span className="inline-flex items-center gap-1.5 text-[0.62rem] font-semibold text-brand-700 dark:text-sky">
              <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
              Working
            </span>
          ) : (
            <span className="text-[0.62rem] text-ink-400 dark:text-white/30">
              Private to your account
            </span>
          )}
        </div>

        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6"
        >
          {messages.length === 0 && !streamingText && !loading ? (
            <div className="mx-auto flex h-full max-w-xl flex-col justify-center gap-4 py-6">
              <div>
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-sky">
                  Newton · Team workspace
                </p>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em] text-ink-900 dark:text-white">
                  What&apos;s your team working on, {firstName}?
                </h2>
                <p className="mt-2 text-sm leading-6 text-ink-500 dark:text-white/45">
                  Write documents, chat with teammates, and let Aria AI draft
                  plans, summaries and decisions — all in one workspace.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setDraft(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="rounded-2xl border border-ink-100 bg-mist px-3 py-2.5 text-left text-xs leading-5 text-ink-600 transition hover:border-brand-200 hover:bg-brand-50 dark:border-white/10 dark:bg-white/5 dark:text-white/55 dark:hover:border-sky/30 dark:hover:bg-white/10"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {loading && messages.length === 0 ? (
            <p className="flex items-center gap-2 text-xs text-ink-400 dark:text-white/35">
              <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              Loading chat…
            </p>
          ) : null}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "max-w-[92%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-6",
                message.role === "user"
                  ? "ml-auto rounded-br-md bg-brand-600 text-white"
                  : "mr-auto rounded-bl-md border border-ink-100 bg-mist text-ink-800 dark:border-white/10 dark:bg-white/5 dark:text-white/80",
              )}
            >
              {message.content}
              {message.attachments && message.attachments.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {message.attachments.map((att) => {
                    if (att.type === "image" && att.url) {
                      return (
                        <a
                          key={att.id}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block overflow-hidden rounded-xl border border-white/25 bg-white/10 dark:border-white/10"
                          aria-label={`Open image ${att.name}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={att.url}
                            alt={att.name}
                            className="h-20 w-20 object-cover"
                          />
                        </a>
                      );
                    }
                    const isWeb = att.type === "web";
                    const label = (
                      <span className="inline-flex items-center gap-1">
                        {isWeb ? (
                          <Globe className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <FileText className="h-3 w-3" aria-hidden="true" />
                        )}
                        {att.name}
                      </span>
                    );
                    return (
                      <span
                        key={att.id}
                        className="inline-flex items-center rounded-xl border border-ink-200 bg-white/60 px-2.5 py-1.5 text-[0.6rem] leading-4 text-ink-600 dark:border-white/10 dark:bg-white/5 dark:text-white/45"
                      >
                        {isWeb && att.sourceUrl ? (
                          <a
                            href={att.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {label}
                          </a>
                        ) : (
                          label
                        )}
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))}

          {streamingText ? (
            <div className="mr-auto max-w-[92%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border border-ink-100 bg-mist px-4 py-2.5 text-sm leading-6 text-ink-800 dark:border-white/10 dark:bg-white/5 dark:text-white/80">
              {streamingText}
              <span
                aria-hidden="true"
                className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-brand-500 align-middle dark:bg-sky"
              />
            </div>
          ) : busy ? (
            <p className="mr-auto inline-flex items-center gap-2 rounded-2xl border border-ink-100 bg-mist px-4 py-2.5 text-xs text-ink-500 dark:border-white/10 dark:bg-white/5 dark:text-white/40">
              <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              Aria is thinking…
            </p>
          ) : null}
        </div>

        <div className="border-t border-ink-100 px-4 py-3 dark:border-white/10 sm:px-6">
          {moderation?.state === "warned" ? (
            <p className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium leading-5 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
              Moderation notice: {moderation.reason || "Please review the acceptable use policy."}
            </p>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium leading-5 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300"
            >
              {error}
            </p>
          ) : null}

          {!ready ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-400/30 dark:bg-amber-400/10">
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-200"
              />
              <p className="text-xs leading-5 text-amber-900 dark:text-amber-100/80">
                {moderationBlocked
                  ? `Aria access is ${moderation?.state} for this account.${
                      moderation?.reason ? ` ${moderation.reason}` : ""
                    }${
                      moderation?.until
                        ? ` This ends ${new Date(moderation.until).toLocaleString("en-GB", { timeZone: "Asia/Bahrain" })}.`
                        : ""
                    } Contact Xenon Tech if you think this is a mistake.`
                  : "Aria is not switched on for this deployment yet. Please contact Xenon Tech if this continues."}
              </p>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              {webOpen ? (
                <div className="mb-2 flex flex-col gap-2 rounded-xl border border-ink-200 bg-mist p-2 dark:border-white/10 dark:bg-white/5 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Globe
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-brand-600 dark:text-sky"
                    />
                    <label htmlFor="aria-web-url" className="sr-only">
                      Web page address
                    </label>
                    <input
                      id="aria-web-url"
                      type="url"
                      value={webUrl}
                      onChange={(event) => setWebUrl(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void fetchPage();
                        }
                      }}
                      placeholder="https://example.com/article"
                      disabled={fetchingPage}
                      className="field h-9 w-full py-1 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void fetchPage()}
                      disabled={fetchingPage || !webUrl.trim()}
                      className="btn-primary btn-sm"
                    >
                      {fetchingPage ? (
                        <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Globe aria-hidden="true" className="h-3.5 w-3.5" />
                      )}
                      {fetchingPage ? "Fetching" : "Fetch page"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setWebOpen(false);
                        setWebUrl("");
                      }}
                      aria-label="Close web fetch"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
                    >
                      <X aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : null}

              {(attachments.length > 0 || uploading > 0) ? (
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {uploading > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2 py-1 text-[0.58rem] text-ink-500 dark:border-white/10 dark:bg-white/5 dark:text-white/45">
                      <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
                      Uploading image…
                    </span>
                  ) : null}
                  {attachments.map((att) => (
                    <span
                      key={att.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white py-0.5 pl-1 pr-2 text-[0.55rem] leading-4 text-ink-600 dark:border-white/10 dark:bg-white/5 dark:text-white/50"
                    >
                      {att.type === "image" && att.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={att.url}
                          alt=""
                          className="h-6 w-6 rounded-full object-cover"
                        />
                      ) : att.type === "web" ? (
                        <Globe aria-hidden="true" className="h-3 w-3" />
                      ) : (
                        <FileText aria-hidden="true" className="h-3 w-3" />
                      )}
                      <span className="max-w-[10rem] truncate">{att.name}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(att.id)}
                        aria-label={`Remove ${att.name}`}
                        className="text-ink-300 hover:text-rose-500 dark:text-white/25 dark:hover:text-rose-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {attachments.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setAttachments([])}
                      className="text-[0.58rem] font-semibold text-ink-400 hover:text-ink-700 dark:text-white/35 dark:hover:text-white"
                    >
                      Clear all
                    </button>
                  ) : null}
                </div>
              ) : null}

              {!visionReady &&
              attachments.some((attachment) => attachment.type === "image") ? (
                <p className="mb-2 text-[0.58rem] leading-4 text-amber-700 dark:text-amber-300">
                  Image reading is switched off in this deployment. Aria can
                  still take the file, but it will ask you to describe what
                  matters.
                </p>
              ) : null}

              <div className="flex items-end gap-2">
                <div className="relative flex-1">
                  <label htmlFor="aria-message" className="sr-only">
                    Message Aria
                  </label>
                  <textarea
                    id="aria-message"
                    ref={inputRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={onKeyDown}
                    rows={2}
                    maxLength={limits.maxPromptChars}
                    disabled={busy}
                    placeholder="Ask Aria about a real task…"
                    className="field min-h-[3.25rem] w-full resize-none py-2.5 leading-6 pr-12"
                  />
                  <div className="absolute right-2 top-2 flex items-center gap-1.5">
                    {!busy && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            fileInputRef.current?.click();
                          }}
                          aria-label="Attach file"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition hover:bg-ink-50 hover:text-ink-700 dark:text-white/35 dark:hover:bg-white/10 dark:hover:text-white"
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/png,image/jpeg,image/webp,image/gif,.txt,.md,.markdown,.csv,.tsv,.json,.log,.xml,.yml,.yaml"
                            onChange={(event) => {
                              const files = event.target.files;
                              if (files) {
                                for (let i = 0; i < files.length; i++) {
                                  addAttachment(files[i]);
                                }
                              }
                            }}
                            className="sr-only"
                          />
                          <Image className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setWebOpen((open) => !open)}
                          aria-label="Fetch a web page for Aria"
                          aria-pressed={webOpen}
                          className={cn(
                            "inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition",
                            webOpen
                              ? "bg-brand-50 text-brand-700 dark:bg-sky/10 dark:text-sky"
                              : "hover:bg-ink-50 hover:text-ink-700 dark:text-white/35 dark:hover:bg-white/10 dark:hover:text-white",
                          )}
                        >
                          <Globe className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={voiceRecording ? stopVoiceRecording : startVoiceRecording}
                          aria-label={voiceRecording ? "Stop voice recording" : "Record voice message"}
                          className={cn(
                            "inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition",
                            voiceRecording
                              ? "bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-400/10 dark:text-rose-300 dark:hover:bg-rose-400/20"
                              : "hover:bg-ink-50 hover:text-ink-700 dark:text-white/35 dark:hover:bg-white/10 dark:hover:text-white",
                          )}
                        >
                          {voiceRecording ? (
                            <StopCircle className="h-4 w-4" />
                          ) : (
                            <Mic className="h-4 w-4" />
                          )}
                        </button>
                        {voiceBlob && (
                          <button
                            type="button"
                            onClick={() => setVoiceBlob(null)}
                            aria-label="Remove voice message"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition hover:bg-ink-50 hover:text-ink-700 dark:text-white/35 dark:hover:bg-white/10 dark:hover:text-white"
                          >
                            <Square className="h-4 w-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {busy ? (
                  <button
                    type="button"
                    onClick={stop}
                    aria-label="Stop Aria"
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 dark:border-white/15 dark:bg-white/5 dark:text-white/70 dark:hover:bg-rose-400/10 dark:hover:text-rose-200"
                  >
                    <Square aria-hidden="true" className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={
                      uploading > 0 ||
                      (!draft.trim() && attachments.length === 0 && !voiceBlob)
                    }
                    aria-label="Send message"
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-soft transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-sky dark:text-ink-950 dark:hover:bg-white"
                  >
                    <ArrowUp aria-hidden="true" className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[0.6rem] text-ink-400 dark:text-white/30">
                <span>Enter to send · Shift + Enter for a new line</span>
                {draft.length > limits.maxPromptChars * 0.85 ? (
                  <span>
                    {draft.length} / {limits.maxPromptChars}
                  </span>
                ) : null}
              </div>
              {activeId && (
                <button
                  type="button"
                  onClick={exportConversation}
                  className="mt-2 inline-flex items-center gap-1.5 text-[0.6rem] font-semibold text-brand-700 hover:text-brand-800 dark:text-sky dark:hover:text-white"
                >
                  <FileText className="h-3 w-3" />
                  Export conversation
                </button>
              )}
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
