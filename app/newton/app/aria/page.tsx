import { requireVerifiedAccount } from "@/lib/account/auth";
import { NewtonWorkspace } from "@/components/newton/chat-workspace";
import { newtonConfig } from "@/lib/newton/config";
import { getModerationState } from "@/lib/newton/moderation";
import { getUsageToday, listThreads } from "@/lib/newton/service";
import type { NewtonPublicLimits } from "@/lib/newton/types";

export const dynamic = "force-dynamic";

export default async function NewtonAriaPage() {
  const session = await requireVerifiedAccount("/newton/app/aria");
  const [threads, usage, moderation] = await Promise.all([
    listThreads(session.account.id),
    getUsageToday(session.account.id),
    getModerationState(session.account.id),
  ]);

  const config = newtonConfig();
  const limits: NewtonPublicLimits = {
    messagesPerDay: config.limits.messagesPerDay,
    tokensPerDay: config.limits.tokensPerDay,
    maxPromptChars: config.limits.maxPromptChars,
  };

  const firstName = session.account.name?.trim().split(/\s+/)[0] || "there";

  return (
    <NewtonWorkspace
      firstName={firstName}
      initialThreads={threads}
      initialUsage={usage}
      limits={limits}
      status={config.status}
      visionReady={config.visionEnabled}
      moderation={moderation}
    />
  );
}
