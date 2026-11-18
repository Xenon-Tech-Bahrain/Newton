import { requireVerifiedAccount } from "@/lib/account/auth";
import { TeamManager } from "@/components/newton/team-manager";
import {
  listTeamChannels,
  listTeamMembers,
  listTeamsForAccount,
} from "@/lib/newton/teams";
import type { NewtonTeamChannel, NewtonTeamMember } from "@/lib/newton/types";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ team?: string }>;
};

export default async function NewtonTeamsPage({ searchParams }: PageProps) {
  const session = await requireVerifiedAccount("/newton/app/teams");
  const params = await searchParams;

  const teams = await listTeamsForAccount(
    session.account.id,
    session.account.email,
  );

  const activeTeam =
    teams.find((team) => team.id === params.team) ?? teams[0] ?? null;

  let members: NewtonTeamMember[] = [];
  let channels: NewtonTeamChannel[] = [];

  if (activeTeam) {
    [members, channels] = await Promise.all([
      listTeamMembers(activeTeam.id, session.account.id),
      listTeamChannels(activeTeam.id, session.account.id),
    ]);
  }

  return (
    <TeamManager
      initialTeams={teams}
      initialTeamId={activeTeam?.id ?? null}
      initialMembers={members}
      initialChannels={channels}
    />
  );
}
