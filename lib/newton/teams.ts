import { newId } from "@/lib/admin/ids";
import { query, withTransaction } from "@/lib/db";
import { NewtonError } from "@/lib/newton/errors";
import type {
  NewtonChannelMessage,
  NewtonTeamChannel,
  NewtonTeamMember,
  NewtonTeamRole,
  NewtonTeamSummary,
} from "@/lib/newton/types";

type TeamRow = {
  id: string;
  name: string;
  role: NewtonTeamRole;
  created_at: string;
  member_count: number;
  channel_count: number;
};

type ChannelRow = {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  created_at: string;
  message_count: number;
  last_message_at: string | null;
};

type MemberRow = {
  id: string;
  team_id: string;
  account_id: string | null;
  email: string;
  name: string | null;
  role: NewtonTeamRole;
  status: "active" | "invited" | "removed";
  joined_at: string | null;
  created_at: string;
};

type MessageRow = {
  id: string;
  channel_id: string;
  team_id: string;
  account_id: string;
  author_name: string | null;
  author_email: string;
  content: string;
  created_at: string;
  deleted_at: string | null;
};

function toTeam(row: TeamRow): NewtonTeamSummary {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    memberCount: Number(row.member_count ?? 0),
    channelCount: Number(row.channel_count ?? 0),
    createdAt: row.created_at,
  };
}

function toChannel(row: ChannelRow): NewtonTeamChannel {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    messageCount: Number(row.message_count ?? 0),
    lastMessageAt: row.last_message_at,
  };
}

function toMember(row: MemberRow): NewtonTeamMember {
  return {
    id: row.id,
    teamId: row.team_id,
    accountId: row.account_id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    joinedAt: row.joined_at,
    createdAt: row.created_at,
  };
}

function toMessage(row: MessageRow): NewtonChannelMessage {
  return {
    id: row.id,
    channelId: row.channel_id,
    teamId: row.team_id,
    authorAccountId: row.account_id,
    authorName: row.author_name?.trim() || row.author_email,
    body: row.content,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

function cleanName(value: string, max: number, label: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (!name) {
    throw new NewtonError(`Give your ${label} a name.`, 422, "invalid_name");
  }
  if (name.length > max) {
    throw new NewtonError(
      `Keep the ${label} name under ${max} characters.`,
      422,
      "invalid_name",
    );
  }
  return name;
}

function normaliseChannelName(value: string) {
  const name = value
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[^a-z0-9-_ ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!name) {
    throw new NewtonError(
      "Use letters, numbers or dashes for the channel name.",
      422,
      "invalid_channel_name",
    );
  }
  if (name.length > 60) {
    throw new NewtonError(
      "Keep the channel name under 60 characters.",
      422,
      "invalid_channel_name",
    );
  }
  return name;
}

/**
 * Invitations are stored by email. The first time that email signs in with a
 * verified EcoAccount, the pending row is claimed. This keeps invites working
 * for people who have not created an account yet without storing a token that
 * could leak.
 */
export async function syncTeamInvitations(accountId: string, email: string) {
  await query(
    `update newton_team_members
        set account_id = $1,
            status = 'active',
            joined_at = coalesce(joined_at, now()),
            updated_at = now()
      where lower(email) = lower($2)
        and status = 'invited'
        and account_id is null`,
    [accountId, email],
  );
}

export async function listTeamsForAccount(
  accountId: string,
  email: string,
): Promise<NewtonTeamSummary[]> {
  await syncTeamInvitations(accountId, email);

  const result = await query<TeamRow>(
    `select t.id,
            t.name,
            m.role,
            t.created_at,
            (select count(*)::int
               from newton_team_members x
              where x.team_id = t.id and x.status = 'active') as member_count,
            (select count(*)::int
               from newton_channels c
              where c.team_id = t.id and c.archived_at is null) as channel_count
       from newton_teams t
       join newton_team_members m on m.team_id = t.id
      where m.account_id = $1
        and m.status = 'active'
        and t.archived_at is null
      order by t.created_at desc`,
    [accountId],
  );

  return result.rows.map(toTeam);
}

export async function createTeam(
  accountId: string,
  email: string,
  nameInput: string,
): Promise<NewtonTeamSummary> {
  const name = cleanName(nameInput, 80, "team");

  return withTransaction(async (client) => {
    const teamId = newId();
    const channelId = newId();

    await client.query(
      `insert into newton_teams (id, name, created_by)
       values ($1, $2, $3)`,
      [teamId, name, accountId],
    );

    await client.query(
      `insert into newton_team_members
         (id, team_id, account_id, email, role, status, invited_by, joined_at)
       values ($1, $2, $3, $4, 'owner', 'active', $3, now())`,
      [newId(), teamId, accountId, email],
    );

    await client.query(
      `insert into newton_channels
         (id, team_id, name, description, created_by)
       values ($1, $2, 'general', 'Team-wide announcements and conversation', $3)`,
      [channelId, teamId, accountId],
    );

    return {
      id: teamId,
      name,
      role: "owner" as const,
      memberCount: 1,
      channelCount: 1,
      createdAt: new Date().toISOString(),
    };
  });
}

export async function getTeamAccess(teamId: string, accountId: string) {
  const result = await query<{ id: string; name: string; role: NewtonTeamRole }>(
    `select t.id, t.name, m.role
       from newton_teams t
       join newton_team_members m on m.team_id = t.id
      where t.id = $1
        and t.archived_at is null
        and m.account_id = $2
        and m.status = 'active'
      limit 1`,
    [teamId, accountId],
  );

  const row = result.rows[0];
  if (!row) {
    throw new NewtonError("That team was not found.", 404, "team_not_found");
  }
  return row;
}

function requireManager(role: NewtonTeamRole) {
  if (role !== "owner" && role !== "admin") {
    throw new NewtonError(
      "Only team owners and admins can do that.",
      403,
      "team_forbidden",
    );
  }
}

export async function renameTeam(
  teamId: string,
  accountId: string,
  nameInput: string,
) {
  const access = await getTeamAccess(teamId, accountId);
  requireManager(access.role);
  const name = cleanName(nameInput, 80, "team");

  const result = await query<{ id: string; name: string }>(
    `update newton_teams
        set name = $2, updated_at = now()
      where id = $1
      returning id, name`,
    [teamId, name],
  );

  return result.rows[0];
}

export async function listTeamMembers(
  teamId: string,
  accountId: string,
): Promise<NewtonTeamMember[]> {
  await getTeamAccess(teamId, accountId);

  const result = await query<MemberRow>(
    `select m.id, m.team_id, m.account_id, m.email, a.name,
            m.role, m.status, m.joined_at, m.created_at
       from newton_team_members m
       left join accounts a on a.id = m.account_id
      where m.team_id = $1
        and m.status <> 'removed'
      order by
        case m.role when 'owner' then 0 when 'admin' then 1 else 2 end,
        m.created_at asc`,
    [teamId],
  );

  return result.rows.map(toMember);
}

export async function listTeamChannels(
  teamId: string,
  accountId: string,
): Promise<NewtonTeamChannel[]> {
  await getTeamAccess(teamId, accountId);

  const result = await query<ChannelRow>(
    `select c.id,
            c.team_id,
            c.name,
            c.description,
            c.created_at,
            (select count(*)::int
               from newton_channel_messages msg
              where msg.channel_id = c.id and msg.deleted_at is null)
              as message_count,
            (select max(msg.created_at)
               from newton_channel_messages msg
              where msg.channel_id = c.id and msg.deleted_at is null)
              as last_message_at
       from newton_channels c
      where c.team_id = $1
        and c.archived_at is null
      order by c.created_at asc`,
    [teamId],
  );

  return result.rows.map(toChannel);
}

export async function createChannel(
  teamId: string,
  accountId: string,
  nameInput: string,
  description?: string,
) {
  const access = await getTeamAccess(teamId, accountId);
  requireManager(access.role);

  const name = normaliseChannelName(nameInput);
  const id = newId();

  try {
    const result = await query<ChannelRow>(
      `insert into newton_channels
         (id, team_id, name, description, created_by)
       values ($1, $2, $3, $4, $5)
       returning id, team_id, name, description, created_at,
                 0::int as message_count, null::timestamptz as last_message_at`,
      [id, teamId, name, description?.trim() || null, accountId],
    );
    return toChannel(result.rows[0]);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    ) {
      throw new NewtonError(
        "A channel with that name already exists.",
        409,
        "channel_exists",
      );
    }
    throw error;
  }
}

export async function inviteTeamMember(
  teamId: string,
  accountId: string,
  emailInput: string,
  role: "admin" | "member" = "member",
) {
  const access = await getTeamAccess(teamId, accountId);
  requireManager(access.role);
  if (access.role === "admin" && role === "admin") {
    throw new NewtonError(
      "Only the team owner can add another admin.",
      403,
      "team_forbidden",
    );
  }

  const email = emailInput.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    throw new NewtonError("Enter a valid email address.", 422, "invalid_email");
  }

  const existing = await query<{ id: string; status: string }>(
    `select id, status from newton_team_members
      where team_id = $1 and lower(email) = lower($2)
      limit 1`,
    [teamId, email],
  );
  const existingMember = existing.rows[0];
  if (existingMember && existingMember.status !== "removed") {
    throw new NewtonError(
      "That person is already on this team.",
      409,
      "member_exists",
    );
  }

  const account = await query<{ id: string; name: string | null }>(
    `select id, name from accounts
      where lower(email) = lower($1) and deleted_at is null
      limit 1`,
    [email],
  );
  const existingAccount = account.rows[0];
  const status = existingAccount ? "active" : "invited";

  if (existingMember) {
    await query(
      `update newton_team_members
          set account_id = $2,
              role = $3,
              status = $4,
              invited_by = $5,
              joined_at = case when $4 = 'active' then now() else null end,
              updated_at = now()
        where id = $1`,
      [
        existingMember.id,
        existingAccount?.id ?? null,
        role,
        status,
        accountId,
      ],
    );
  } else {
    await query(
      `insert into newton_team_members
         (id, team_id, account_id, email, role, status, invited_by, joined_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        newId(),
        teamId,
        existingAccount?.id ?? null,
        email,
        role,
        status,
        accountId,
        existingAccount ? new Date().toISOString() : null,
      ],
    );
  }

  return {
    email,
    role,
    status: existingAccount ? ("active" as const) : ("invited" as const),
    name: existingAccount?.name ?? null,
  };
}

export async function updateTeamMemberRole(
  teamId: string,
  accountId: string,
  memberId: string,
  role: "admin" | "member",
) {
  const access = await getTeamAccess(teamId, accountId);
  requireManager(access.role);

  const target = await query<{ id: string; role: NewtonTeamRole }>(
    `select id, role from newton_team_members
      where id = $1 and team_id = $2 and status <> 'removed'
      limit 1`,
    [memberId, teamId],
  );
  const member = target.rows[0];
  if (!member) {
    throw new NewtonError("That member was not found.", 404, "member_not_found");
  }
  if (member.role === "owner") {
    throw new NewtonError(
      "The team owner cannot be changed here.",
      403,
      "team_forbidden",
    );
  }
  if (access.role === "admin" && (member.role === "admin" || role === "admin")) {
    throw new NewtonError(
      "Only the team owner can manage admins.",
      403,
      "team_forbidden",
    );
  }

  await query(
    `update newton_team_members
        set role = $2, updated_at = now()
      where id = $1 and team_id = $3`,
    [memberId, role, teamId],
  );
}

export async function removeTeamMember(
  teamId: string,
  accountId: string,
  memberId: string,
) {
  const access = await getTeamAccess(teamId, accountId);
  requireManager(access.role);

  const target = await query<{
    id: string;
    role: NewtonTeamRole;
    account_id: string | null;
  }>(
    `select id, role, account_id from newton_team_members
      where id = $1 and team_id = $2 and status <> 'removed'
      limit 1`,
    [memberId, teamId],
  );
  const member = target.rows[0];
  if (!member) {
    throw new NewtonError("That member was not found.", 404, "member_not_found");
  }
  if (member.role === "owner") {
    throw new NewtonError(
      "The team owner cannot be removed.",
      403,
      "team_forbidden",
    );
  }
  if (access.role === "admin" && member.role === "admin") {
    throw new NewtonError(
      "Only the team owner can remove an admin.",
      403,
      "team_forbidden",
    );
  }

  await query(
    `update newton_team_members
        set status = 'removed', account_id = null, updated_at = now()
      where id = $1 and team_id = $2`,
    [memberId, teamId],
  );
}

async function getChannelAccess(channelId: string, accountId: string) {
  const result = await query<{
    id: string;
    team_id: string;
    role: NewtonTeamRole;
  }>(
    `select c.id, c.team_id, m.role
       from newton_channels c
       join newton_team_members m on m.team_id = c.team_id
       join newton_teams t on t.id = c.team_id
      where c.id = $1
        and c.archived_at is null
        and t.archived_at is null
        and m.account_id = $2
        and m.status = 'active'
      limit 1`,
    [channelId, accountId],
  );

  const row = result.rows[0];
  if (!row) {
    throw new NewtonError(
      "That channel was not found.",
      404,
      "channel_not_found",
    );
  }
  return row;
}

export async function listChannelMessages(
  channelId: string,
  accountId: string,
  limit = 100,
): Promise<NewtonChannelMessage[]> {
  await getChannelAccess(channelId, accountId);

  const result = await query<MessageRow>(
    `select msg.id,
            msg.channel_id,
            msg.team_id,
            msg.account_id,
            a.name as author_name,
            a.email as author_email,
            case
              when msg.deleted_at is null then msg.content
              else 'This message was deleted.'
            end as content,
            msg.created_at,
            msg.deleted_at
       from newton_channel_messages msg
       join accounts a on a.id = msg.account_id
      where msg.channel_id = $1
      order by msg.created_at desc
      limit $2`,
    [channelId, Math.min(Math.max(limit, 1), 200)],
  );

  return result.rows.map(toMessage).reverse();
}

export async function postChannelMessage(
  channelId: string,
  accountId: string,
  contentInput: string,
) {
  const access = await getChannelAccess(channelId, accountId);
  const content = contentInput.trim();
  if (!content) {
    throw new NewtonError("Write a message first.", 422, "empty_message");
  }
  if (content.length > 4000) {
    throw new NewtonError(
      "Keep messages under 4,000 characters.",
      422,
      "message_too_long",
    );
  }

  const id = newId();
  const result = await query<MessageRow>(
    `insert into newton_channel_messages
       (id, channel_id, team_id, account_id, content)
     values ($1, $2, $3, $4, $5)
     returning id, channel_id, team_id, account_id,
               null::text as author_name,
               ''::text as author_email,
               content, created_at, deleted_at`,
    [id, channelId, access.team_id, accountId, content],
  );

  const author = await query<{ name: string | null; email: string }>(
    `select name, email from accounts where id = $1 limit 1`,
    [accountId],
  );

  const row = result.rows[0];
  return toMessage({
    ...row,
    author_name: author.rows[0]?.name ?? null,
    author_email: author.rows[0]?.email ?? "",
  });
}

export async function deleteChannelMessage(
  channelId: string,
  messageId: string,
  accountId: string,
) {
  const access = await getChannelAccess(channelId, accountId);

  const target = await query<{ account_id: string }>(
    `select account_id from newton_channel_messages
      where id = $1 and channel_id = $2 and deleted_at is null
      limit 1`,
    [messageId, channelId],
  );
  const message = target.rows[0];
  if (!message) {
    throw new NewtonError("That message was not found.", 404, "message_not_found");
  }

  const canModerate = access.role === "owner" || access.role === "admin";
  if (message.account_id !== accountId && !canModerate) {
    throw new NewtonError(
      "You can only delete your own messages.",
      403,
      "message_forbidden",
    );
  }

  await query(
    `update newton_channel_messages
        set deleted_at = now(), deleted_by = $2
      where id = $1`,
    [messageId, accountId],
  );
}

export async function countTeamsForAccount(accountId: string) {
  const result = await query<{ count: number }>(
    `select count(distinct team_id)::int as count
       from newton_team_members
      where account_id = $1 and status = 'active'`,
    [accountId],
  );
  return Number(result.rows[0]?.count ?? 0);
}
