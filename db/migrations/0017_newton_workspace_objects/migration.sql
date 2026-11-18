-- Newton B2B workspace objects: documents, tasks and stored Aria attachments.
--
-- Additive and idempotent. Documents and tasks belong either to a single
-- account (personal) or to a team (shared). Attachments keep the bytes that
-- Aria was shown out of the message JSON so reloading a conversation stays
-- cheap and the JSONB row never approaches the size limit.

create table if not exists newton_documents (
  id uuid primary key,
  account_id uuid not null references accounts(id) on delete cascade,
  team_id uuid references newton_teams(id) on delete cascade,
  title text not null,
  body text not null default '',
  tags text[] not null default '{}',
  created_by uuid not null references accounts(id) on delete cascade,
  updated_by uuid references accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (length(title) between 1 and 200),
  check (length(body) <= 200000)
);

create index if not exists newton_documents_account_idx
  on newton_documents (account_id, updated_at desc)
  where archived_at is null;
create index if not exists newton_documents_team_idx
  on newton_documents (team_id, updated_at desc)
  where archived_at is null;
create index if not exists newton_documents_search_idx
  on newton_documents using gin (to_tsvector('english', title || ' ' || body));

create table if not exists newton_tasks (
  id uuid primary key,
  account_id uuid not null references accounts(id) on delete cascade,
  team_id uuid references newton_teams(id) on delete cascade,
  assigned_account_id uuid references accounts(id) on delete set null,
  title text not null,
  details text not null default '',
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'blocked', 'done')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high')),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(title) between 1 and 200),
  check (length(details) <= 20000)
);

create index if not exists newton_tasks_account_idx
  on newton_tasks (account_id, status, due_date);
create index if not exists newton_tasks_team_idx
  on newton_tasks (team_id, status, due_date);
create index if not exists newton_tasks_assignee_idx
  on newton_tasks (assigned_account_id, status);

create table if not exists newton_attachment_files (
  id uuid primary key,
  account_id uuid not null references accounts(id) on delete cascade,
  name text not null,
  mime_type text not null,
  byte_size integer not null,
  data bytea not null,
  created_at timestamptz not null default now()
);

create index if not exists newton_attachment_files_account_idx
  on newton_attachment_files (account_id, created_at desc);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'newton_app') then
    grant select, insert, update, delete on table
      newton_documents,
      newton_tasks,
      newton_attachment_files
    to newton_app;
  end if;

  if exists (select 1 from pg_roles where rolname = 'xenon_app') then
    grant select, insert, update, delete on table
      newton_documents,
      newton_tasks,
      newton_attachment_files
    to xenon_app;
  end if;
end
$$;
