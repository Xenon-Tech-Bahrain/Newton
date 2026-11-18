import { requireApiAccount } from "@/lib/account/auth";
import { readJson } from "@/lib/account/http";
import { NewtonError } from "@/lib/newton/errors";
import {
  ariaSystemPrompt,
  estimateTokens,
  openAriaResponse,
  readAriaStream,
  type ChatContentPart,
  type TokenUsage,
} from "@/lib/newton/aria";
import { newtonJsonError } from "@/lib/newton/http";
import {
  assertThreadOwned,
  buildChatHistory,
  enforceMessageQuota,
  recordTokenUsage,
  registerRequest,
  saveAssistantMessage,
  saveUserMessage,
  titleFromPrompt,
} from "@/lib/newton/service";
import { sendMessageSchema } from "@/lib/newton/validation";
import { newtonConfig } from "@/lib/newton/config";
import { assertAriaAllowed } from "@/lib/newton/moderation";
import { resolveImageAttachments } from "@/lib/newton/attachments";
import { openGeminiResponse } from "@/lib/newton/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

type IncomingAttachment = {
  id: string;
  type: "image" | "document" | "web";
  name: string;
  size: number;
  mimeType: string;
  url?: string;
  extractedText?: string;
  sourceUrl?: string;
};

function attachmentLabel(attachment: IncomingAttachment) {
  return attachment.name.replace(/[\r\n]+/g, " ").slice(0, 200);
}

async function buildUserContent(
  accountId: string,
  content: string,
  attachments: IncomingAttachment[],
  visionAvailable: boolean,
): Promise<string | ChatContentPart[]> {
  const text = content.trim();
  const parts: ChatContentPart[] = [];
  const imageAttachments = attachments.filter(
    (attachment) => attachment.type === "image",
  );
  const images = visionAvailable
    ? await resolveImageAttachments(accountId, attachments)
    : [];

  parts.push({
    type: "text",
    text:
      text ||
      (attachments.length > 0
        ? "Please review the attached material and summarise what matters."
        : ""),
  });

  if (!visionAvailable && imageAttachments.length > 0) {
    parts.push({
      type: "text",
      text: `\n\n[The user attached ${imageAttachments.length} image file(s), but image reading is not available in this deployment. Tell the user you cannot view the image and ask them to describe it or paste the important text.]`,
    });
  }

  for (const image of images) {
    parts.push({ type: "image_url", image_url: image });
  }

  for (const attachment of attachments) {
    if (attachment.type === "document" && attachment.extractedText) {
      parts.push({
        type: "text",
        text: `\n\n--- Attached document: ${attachmentLabel(attachment)} ---\n${attachment.extractedText.slice(0, 60_000)}\n--- End of document ---\n`,
      });
    } else if (attachment.type === "web" && attachment.extractedText) {
      parts.push({
        type: "text",
        text: `\n\n--- Web page: ${attachmentLabel(attachment)} (${attachment.sourceUrl || attachment.url || "unknown source"}) ---\n${attachment.extractedText.slice(0, 60_000)}\n--- End of web page ---\n`,
      });
    }
  }

  return parts.length === 1 ? parts[0].type === "text" ? parts[0].text : parts : parts;
}

/**
 * Only server-issued image references are persisted. Inline data URLs and
 * unknown links are dropped so the message row cannot be used to store
 * arbitrary payloads.
 */
function sanitiseAttachments(attachments: IncomingAttachment[]) {
  return attachments.slice(0, 8).map((attachment) => ({
    id: attachment.id.slice(0, 80),
    type: attachment.type,
    name: attachmentLabel(attachment),
    size: Math.max(0, Math.min(attachment.size, 10 * 1024 * 1024)),
    mimeType: attachment.mimeType.slice(0, 120),
    url:
      attachment.type === "image" &&
      /^\/api\/newton\/attachments\/[0-9a-f-]{36}$/i.test(attachment.url ?? "")
        ? attachment.url
        : attachment.type === "web"
          ? attachment.url?.slice(0, 2000)
          : undefined,
    extractedText: attachment.extractedText?.slice(0, 60_000),
    sourceUrl: attachment.sourceUrl?.slice(0, 2000),
  }));
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireApiAccount(request);
    const { id } = await context.params;
    const input = sendMessageSchema.parse(await readJson(request));
    const config = newtonConfig();

    if (!config.enabled) {
      throw new NewtonError(
        "Aria is not available right now. Please try again later.",
        503,
        "newton_not_configured",
      );
    }

    await assertAriaAllowed(session.account.id);
    await enforceMessageQuota(session.account.id);
    await assertThreadOwned(session.account.id, id);

    const history = await buildChatHistory({
      threadId: id,
      accountId: session.account.id,
      systemPrompt: ariaSystemPrompt(),
    });

    const hasImages = (input.attachments ?? []).some(
      (attachment) => attachment.type === "image",
    );
    const useVision = hasImages && config.visionEnabled;

    const userContent = await buildUserContent(
      session.account.id,
      input.content,
      input.attachments ?? [],
      useVision,
    );

    const { response, model } = useVision
      ? await openGeminiResponse({
          messages: [...history, { role: "user", content: userContent }],
          signal: request.signal,
          maxTokens: config.limits.maxCompletionTokens,
        })
      : await openAriaResponse({
          messages: [...history, { role: "user", content: userContent }],
          signal: request.signal,
          maxTokens: config.limits.maxCompletionTokens,
        });

    await saveUserMessage({
      threadId: id,
      accountId: session.account.id,
      content: input.content,
      attachments: sanitiseAttachments(input.attachments ?? []),
    });
    await registerRequest(session.account.id);

    const threadTitle = titleFromPrompt(input.content);
    const startedAt = Date.now();
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let text = "";
        let usage: TokenUsage | null = null;
        let finishReason: string | null = null;
        let failure: NewtonError | null = null;

        const send = (event: Record<string, unknown>) => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
            );
          } catch {
            // The client closed the tab mid-answer. Persistence still runs.
          }
        };

        send({ type: "meta", threadId: id, model, title: threadTitle });

        try {
          for await (const event of readAriaStream(response)) {
            if (event.type === "delta") {
              text += event.text;
              send({ type: "delta", text: event.text });
            } else if (event.type === "usage") {
              usage = event.usage;
            } else if (event.type === "finish") {
              finishReason = event.reason;
            }
          }
        } catch (error) {
          failure =
            error instanceof NewtonError
              ? error
              : new NewtonError(
                  "Aria stopped unexpectedly. Please try again.",
                  502,
                  "newton_upstream_error",
                );
        }

        const finalUsage: TokenUsage =
          usage && usage.total > 0
            ? usage
            : {
                prompt: estimateTokens(
                  [...history, { role: "user", content: userContent }]
                    .map((message) =>
                      typeof message.content === "string"
                        ? message.content
                        : message.content
                            .map((p) => (p.type === "text" ? p.text : ""))
                            .join(" "),
                    )
                    .join(" "),
                ),
                completion: estimateTokens(text),
                total: 0,
              };
        finalUsage.total = Math.max(
          finalUsage.total,
          finalUsage.prompt + finalUsage.completion,
        );

        await recordTokenUsage(session.account.id, finalUsage).catch(
          () => undefined,
        );

        if (text.trim()) {
          const saved = await saveAssistantMessage({
            threadId: id,
            accountId: session.account.id,
            content: text,
            model,
            usage: finalUsage,
            latencyMs: Date.now() - startedAt,
            finishReason: failure ? "error" : finishReason,
            titleIfEmpty: threadTitle,
          }).catch(() => null);

          if (saved) {
            send({
              type: "done",
              messageId: saved.id,
              title: threadTitle,
              model,
              usage: finalUsage,
            });
          } else {
            send({
              type: "error",
              message:
                "Aria replied but the message could not be saved. Please try again.",
            });
          }
        } else {
          send({
            type: "error",
            message:
              failure?.message ??
              "Aria did not return a reply. Please try again.",
          });
        }

        try {
          controller.close();
        } catch {
          // Already closed by the runtime.
        }
      },
      cancel() {
        response.body?.cancel().catch(() => undefined);
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "private, no-store, no-cache, no-transform, max-age=0",
        "x-accel-buffering": "no",
        "x-robots-tag": "noindex, nofollow",
      },
    });
  } catch (error) {
    return newtonJsonError(error);
  }
}
