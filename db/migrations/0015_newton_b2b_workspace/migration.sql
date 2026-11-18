-- Newton B2B workspace: teams, team chat, inbound email, Aria moderation
-- and admin-editable pricing plans.
--
-- Everything is additive and idempotent. Existing Aria threads/messages keep
-- working unchanged; moderation columns are added with safe defaults.

-- ---------------------------------------------------------------------------
-- Teams and membership
-- ---------------------------------------------------------------------------

create table if not exists newton_teams (
  id uuid primary key,
  name text not null,
  created_by uuid not null references accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (length(name) between 1 and 80)
);

create index if not exists newton_teams_created_by_idx
  on newton_teams (created_by, created_at desc);

create table if not exists newton_team_members (
  id uuid primary key,
  team_id uuid not null references newton_teams(id) on delete cascade,
  account_id uuid references accounts(id) on delete cascade,
  email text not null,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member')),
  status text not null default 'invited'
    check (status in ('active', 'invited', 'removed')),
  invited_by uuid references accounts(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists newton_team_members_team_email_idx
  on newton_team_members (team_id, lower(email));
create index if not exists newton_team_members_account_idx
  on newton_team_members (account_id, status);
create index if not exists newton_team_members_team_idx
  on newton_team_members (team_id, status);

create table if not exists newton_channels (
  id uuid primary key,
  team_id uuid not null references newton_teams(id) on delete cascade,
  name text not null,
  description text,
  created_by uuid not null references accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  check (length(name) between 1 and 60)
);

create unique index if not exists newton_channels_team_name_idx
  on newton_channels (team_id, lower(name))
  where archived_at is null;
create index if not exists newton_channels_team_idx
  on newton_channels (team_id, created_at);

create table if not exists newton_channel_messages (
  id uuid primary key,
  channel_id uuid not null references newton_channels(id) on delete cascade,
  team_id uuid not null references newton_teams(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references accounts(id) on delete set null,
  check (length(content) between 1 and 4000)
);

create index if not exists newton_channel_messages_channel_idx
  on newton_channel_messages (channel_id, created_at desc);
create index if not exists newton_channel_messages_team_idx
  on newton_channel_messages (team_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Inbound email + admin replies
-- ---------------------------------------------------------------------------

create table if not exists newton_email_threads (
  id uuid primary key,
  thread_key text not null unique,
  from_email text not null,
  from_name text,
  subject text not null,
  status text not null default 'open'
    check (status in ('open', 'replied', 'closed')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists newton_email_threads_status_idx
  on newton_email_threads (status, last_message_at desc);

create table if not exists newton_email_messages (
  id uuid primary key,
  thread_id uuid not null references newton_email_threads(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  from_email text not null,
  from_name text,
  to_email text not null,
  subject text not null,
  body text not null,
  auto_reply boolean not null default false,
  sender_role text,
  sent_by text,
  status text not null default 'received'
    check (status in ('received', 'sent', 'failed')),
  provider_message_id text,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists newton_email_messages_thread_idx
  on newton_email_messages (thread_id, created_at);
create index if not exists newton_email_messages_status_idx
  on newton_email_messages (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Aria moderation
-- ---------------------------------------------------------------------------

-- Per-account moderation state. Kept separate from accounts so normal customer
-- edits never clear a moderation decision.
create table if not exists newton_moderation_state (
  account_id uuid primary key references accounts(id) on delete cascade,
  state text not null default 'clear'
    check (state in ('clear', 'warned', 'restricted', 'suspended', 'terminated')),
  reason text,
  until timestamptz,
  updated_by text,
  updated_at timestamptz not null default now()
);

create index if not exists newton_moderation_state_state_idx
  on newton_moderation_state (state, updated_at desc);

create table if not exists newton_moderation_actions (
  id uuid primary key,
  account_id uuid not null references accounts(id) on delete cascade,
  message_id uuid references newton_messages(id) on delete set null,
  action text not null
    check (action in ('warn', 'restrict', 'suspend', 'terminate', 'lift', 'hide', 'restore')),
  reason text not null,
  state_after text not null,
  until timestamptz,
  created_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists newton_moderation_actions_account_idx
  on newton_moderation_actions (account_id, created_at desc);
create index if not exists newton_moderation_actions_created_idx
  on newton_moderation_actions (created_at desc);

alter table newton_messages
  add column if not exists moderation_status text not null default 'visible';
alter table newton_messages
  add column if not exists moderated_at timestamptz;
alter table newton_messages
  add column if not exists moderated_by text;

create index if not exists newton_messages_moderation_idx
  on newton_messages (moderation_status, created_at desc);

-- ---------------------------------------------------------------------------
-- Admin-editable pricing plans
-- ---------------------------------------------------------------------------

create table if not exists newton_plans (
  key text primary key
    check (key in ('free', 'pro', 'max', 'enterprise')),
  label text not null,
  description text not null default '',
  usd_per_month numeric(10, 2) not null default 0,
  bhd_per_month numeric(10, 3),
  commercial boolean not null default false,
  features jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  active boolean not null default true,
  updated_by text,
  updated_at timestamptz not null default now()
);

insert into newton_plans
  (key, label, description, usd_per_month, bhd_per_month, commercial, features, sort_order)
values
  (
    'free',
    'Free',
    'Personal, non-commercial evaluation of Aria AI. Not for business or client work.',
    0,
    null,
    false,
    '["Aria AI chat (non-commercial only)","Team chat and documents","Limited daily messages"]'::jsonb,
    0
  ),
  (
    'pro',
    'Pro',
    'Commercial access for small teams and individual professionals.',
    35,
    13.160,
    true,
    '["Commercial use of Newton","Team chat and documents","Higher daily limits","Email support"]'::jsonb,
    1
  ),
  (
    'max',
    'Max',
    'Higher usage limits and priority support for growing teams.',
    50,
    18.800,
    true,
    '["Commercial use of Newton","Team chat and documents","Highest daily limits","Priority email support"]'::jsonb,
    2
  ),
  (
    'enterprise',
    'Enterprise',
    'Custom pricing, dedicated support and deployment terms for larger organisations.',
    0,
    null,
    true,
    '["Commercial use of Newton","Custom usage limits","Dedicated support","Custom terms by negotiation"]'::jsonb,
    3
  )
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Least-privilege runtime roles
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'newton_app') then
    grant select, insert, update, delete on table
      newton_teams,
      newton_team_members,
      newton_channels,
      newton_channel_messages,
      newton_email_threads,
      newton_email_messages,
      newton_moderation_state,
      newton_moderation_actions,
      newton_plans
    to newton_app;
  end if;

  if exists (select 1 from pg_roles where rolname = 'xenon_app') then
    grant select, insert, update, delete on table
      newton_teams,
      newton_team_members,
      newton_channels,
      newton_channel_messages,
      newton_email_threads,
      newton_email_messages,
      newton_moderation_state,
      newton_moderation_actions,
      newton_plans
    to xenon_app;
  end if;
end
$$;
