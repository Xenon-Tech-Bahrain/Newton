-- Newton with Aria: the signed-in AI chat workspace.
--
-- Aria conversations belong to one EcoAccount. Threads and messages cascade
-- from the account row so a hard delete removes everything, while the account
-- deletion flow purges them explicitly because EcoAccount anonymises rather
-- than hard-deletes. Token accounting is kept per account per day so the
-- daily budget can be enforced and audited from the admin console.

create table if not exists newton_threads (
  id uuid primary key,
  account_id uuid not null references accounts(id) on delete cascade,
  title text,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  archived_at timestamptz
);

create index if not exists newton_threads_account_idx
  on newton_threads (account_id, updated_at desc);

create table if not exists newton_messages (
  id uuid primary key,
  thread_id uuid not null references newton_threads(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  model text,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  latency_ms integer,
  finish_reason text,
  created_at timestamptz not null default now()
);

create index if not exists newton_messages_thread_idx
  on newton_messages (thread_id, created_at);

create index if not exists newton_messages_account_idx
  on newton_messages (account_id, created_at desc);

create table if not exists newton_usage_daily (
  account_id uuid not null references accounts(id) on delete cascade,
  day date not null,
  requests integer not null default 0,
  prompt_tokens bigint not null default 0,
  completion_tokens bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (account_id, day)
);

create index if not exists newton_usage_daily_day_idx
  on newton_usage_daily (day);
