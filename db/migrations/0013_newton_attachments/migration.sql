-- Newton attachments: images and documents attached to chat messages.
-- Stored as JSONB on newton_messages so existing rows keep working.

alter table newton_messages add column if not exists attachments jsonb not null default '[]'::jsonb;

create index if not exists newton_messages_attachments_idx
  on newton_messages using gin(attachments);
