import { requireVerifiedAccount } from "@/lib/account/auth";
import { TeamChat } from "@/components/newton/team-chat";
import {
  listChannelMessages,
  listTeamChannels,
  listTeamsForAccount,
} from "@/lib/newton/teams";
import type {
  NewtonChannelMessage,
  NewtonTeamChannel,
} from "@/lib/newton/types";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ team?: string; channel?: string }>;
};

export default async function NewtonChatPage({ searchParams }: PageProps) {
  const session = await requireVerifiedAccount("/newton/app/chat");
  const params = await searchParams;

  const teams = await listTeamsForAccount(
    session.account.id,
    session.account.email,
  );

  const activeTeam =
    teams.find((team) => team.id === params.team) ?? teams[0] ?? null;

  let channels: NewtonTeamChannel[] = [];
  let messages: NewtonChannelMessage[] = [];
  let activeChannelId: string | null = null;

  if (activeTeam) {
    channels = await listTeamChannels(activeTeam.id, session.account.id);
    const activeChannel =
      channels.find((channel) => channel.id === params.channel) ??
      channels[0] ??
      null;

    if (activeChannel) {
      activeChannelId = activeChannel.id;
      messages = await listChannelMessages(
        activeChannel.id,
        session.account.id,
        100,
      );
    }
  }

  return (
    <TeamChat
      currentAccountId={session.account.id}
      initialTeams={teams}
      initialTeamId={activeTeam?.id ?? null}
      initialChannels={channels}
      initialChannelId={activeChannelId}
      initialMessages={messages}
    />
  );
}
