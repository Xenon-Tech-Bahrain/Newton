import { newtonConfig } from "@/lib/newton/config";
import { NewtonError } from "@/lib/newton/errors";
import type { ChatContentPart, ChatMessage } from "@/lib/newton/aria";

/**
 * Google Gemini transport for Aria.
 *
 * Text replies use Gemini 3.5 Flash Lite, and any message that carries an image
 * is answered by Gemini 3.5 Flash. This module converts our OpenAI-shaped
 * messages into Gemini's format and turns Gemini's stream back into the
 * OpenAI-shaped chunks that `readAriaStream` already understands, so the chat
 * route needs no special cases downstream.
 */

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

type GeminiChunk = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string; thought?: boolean }>;
      role?: string;
    };
    finishReason?: string | null;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { message?: string; status?: string };
};

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Gemini rejects inline data above roughly 20 MB per request. */
const MAX_TOTAL_IMAGE_BYTES = 14 * 1024 * 1024;

function dataUrlToInline(url: string): GeminiPart | null {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(url);
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  if (!mimeType.startsWith("image/")) return null;
  const data = match[2].replace(/\s+/g, "");
  return { inlineData: { mimeType, data } };
}

function toGemini(messages: ChatMessage[]) {
  const systemParts: string[] = [];
  const contents: GeminiContent[] = [];
  let imageBytes = 0;

  for (const message of messages) {
    if (message.role === "system") {
      if (typeof message.content === "string") systemParts.push(message.content);
      continue;
    }

    const role: "user" | "model" =
      message.role === "assistant" ? "model" : "user";
    const parts: GeminiPart[] = [];

    if (typeof message.content === "string") {
      if (message.content.trim()) parts.push({ text: message.content });
    } else {
      for (const part of message.content as ChatContentPart[]) {
        if (part.type === "text") {
          if (part.text.trim()) parts.push({ text: part.text });
          continue;
        }

        const inline = dataUrlToInline(part.image_url.url);
        if (!inline) continue;

        const size = Math.ceil(
          ((inline as { inlineData: { data: string } }).inlineData.data.length *
            3) /
            4,
        );
        if (imageBytes + size > MAX_TOTAL_IMAGE_BYTES) continue;
        imageBytes += size;
        parts.push(inline);
      }
    }

    if (parts.length === 0) continue;

    const previous = contents[contents.length - 1];
    if (previous && previous.role === role) {
      previous.parts.push(...parts);
    } else {
      contents.push({ role, parts });
    }
  }

  return { systemInstruction: systemParts.join(" ").trim(), contents };
}

function mapError(status: number, kind: "text" | "vision"): NewtonError {
  const subject = kind === "vision" ? "image" : "request";

  if (status === 400) {
    return new NewtonError(
      kind === "vision"
        ? "Aria could not read that image. Try a smaller or clearer image."
        : "Aria could not process that request. Try rephrasing it.",
      400,
      kind === "vision" ? "newton_vision_bad_request" : "newton_model_unavailable",
    );
  }
  if (status === 401 || status === 403) {
    return new NewtonError(
      kind === "vision"
        ? "Aria's image reader is not configured correctly. Please contact Xenon Tech."
        : "Aria is not configured correctly. Please contact Xenon Tech.",
      503,
      "newton_not_configured",
    );
  }
  if (status === 429) {
    return new NewtonError(
      kind === "vision"
        ? "Aria is handling a lot of image requests right now. Please try again in a moment."
        : "Aria is handling a lot of requests right now. Please try again in a moment.",
      429,
      "newton_busy",
    );
  }
  if (status === 503) {
    return new NewtonError(
      "Aria had a temporary problem. Please try again.",
      502,
      "newton_upstream_error",
    );
  }
  return new NewtonError(
    `Aria could not answer that ${subject} right now. Please try again.`,
    502,
    kind === "vision" ? "newton_vision_failed" : "newton_upstream_error",
  );
}

/**
 * Bridges Gemini's SSE stream to OpenAI-shaped chunks so the existing stream
 * reader (and the route's persistence logic) keeps working unchanged.
 */
function toOpenAiStream(body: ReadableStream<Uint8Array>) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const safeMessage = "Aria stopped unexpectedly. Please try again.";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = body.getReader();
      let buffer = "";
      let finishReason: string | null = null;
      let latestUsage: GeminiChunk["usageMetadata"] | null = null;

      const emit = (chunk: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
        );
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

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

            let chunk: GeminiChunk;
            try {
              chunk = JSON.parse(payload) as GeminiChunk;
            } catch {
              continue;
            }

            if (chunk.error) {
              emit({ error: { message: safeMessage } });
              return;
            }

            const candidate = chunk.candidates?.[0];
            const text =
              candidate?.content?.parts
                ?.filter((part) => !part.thought)
                .map((part) => part.text ?? "")
                .join("") ?? "";
            if (candidate?.finishReason) finishReason = candidate.finishReason;

            emit({
              choices: [
                {
                  delta: text ? { content: text } : {},
                  finish_reason: candidate?.finishReason ?? null,
                },
              ],
            });

            // Gemini repeats cumulative usage on every chunk; keep the latest.
            if (chunk.usageMetadata) latestUsage = chunk.usageMetadata;
          }
        }

        if (latestUsage) {
          emit({
            usage: {
              prompt_tokens: latestUsage.promptTokenCount ?? 0,
              completion_tokens: latestUsage.candidatesTokenCount ?? 0,
              total_tokens: latestUsage.totalTokenCount ?? 0,
            },
          });
        }

        emit({
          choices: [{ delta: {}, finish_reason: finishReason ?? "STOP" }],
        });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch {
        // Aborted by the client, or the upstream stream died mid-answer. The
        // route treats a short/empty answer as a normal failure.
      } finally {
        reader.cancel().catch(() => undefined);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
    cancel() {
      body.cancel().catch(() => undefined);
    },
  });
}

export function openGeminiChat({
  messages,
  signal,
  maxTokens,
  model,
  kind = "text",
}: {
  messages: ChatMessage[];
  signal?: AbortSignal;
  maxTokens: number;
  model?: string;
  kind?: "text" | "vision";
}) {
  const config = newtonConfig();
  if (!config.enabled) {
    throw new NewtonError(
      "Aria is not available right now.",
      503,
      "newton_not_configured",
    );
  }
  if (kind === "vision" && !config.visionEnabled) {
    throw new NewtonError(
      "Aria's image reader is not switched on yet. Please contact Xenon Tech.",
      503,
      "newton_vision_unconfigured",
    );
  }

  const { systemInstruction, contents } = toGemini(messages);
  if (contents.length === 0) {
    throw new NewtonError(
      kind === "vision"
        ? "Add a message alongside the image."
        : "Add a message before sending.",
      422,
      "newton_empty_message",
    );
  }

  const targetModel = model || (kind === "vision" ? config.visionModel : config.model);
  const url = `${ENDPOINT}/${encodeURIComponent(targetModel)}:streamGenerateContent?alt=sse`;

  return (async () => {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": config.geminiApiKey,
          accept: "text/event-stream",
        },
        body: JSON.stringify({
          ...(systemInstruction
            ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
            : {}),
          contents,
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: maxTokens,
            // Keep replies snappy. Any thinking parts are filtered out above,
            // so a low level is enough for answer quality.
            thinkingConfig: { thinkingLevel: "low" },
          },
        }),
        signal,
        cache: "no-store",
      });
    } catch {
      if (signal?.aborted) {
        throw new NewtonError("The reply was cancelled.", 499, "aborted");
      }
      throw new NewtonError(
        "Aria could not be reached. Please try again.",
        502,
        "newton_unreachable",
      );
    }

    if (!response.ok || !response.body) {
      const status = response.status;
      await response.body?.cancel().catch(() => undefined);
      throw mapError(status, kind);
    }

    return {
      response: new Response(toOpenAiStream(response.body), {
        headers: { "content-type": "text/event-stream; charset=utf-8" },
      }),
      model: targetModel,
    };
  })();
}

/** Image-bearing messages use the fuller vision model. */
export function openGeminiResponse({
  messages,
  signal,
  maxTokens,
}: {
  messages: ChatMessage[];
  signal?: AbortSignal;
  maxTokens: number;
}) {
  const config = newtonConfig();
  return openGeminiChat({
    messages,
    signal,
    maxTokens,
    model: config.visionModel,
    kind: "vision",
  });
}

