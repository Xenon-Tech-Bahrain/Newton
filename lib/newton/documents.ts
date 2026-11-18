import { newId } from "@/lib/admin/ids";
import { query } from "@/lib/db";
import { NewtonError } from "@/lib/newton/errors";
import type { NewtonDocument } from "@/lib/newton/types";

type DocumentRow = {
  id: string;
  title: string;
  body: string;
  tags: string[] | null;
  team_id: string | null;
  team_name: string | null;
  author_name: string | null;
  created_at: string;
  updated_at: string;
  can_edit: boolean;
};

function toDocument(row: DocumentRow): NewtonDocument {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    tags: row.tags ?? [],
    teamId: row.team_id,
    teamName: row.team_name,
    authorName: row.author_name?.trim() || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    canEdit: Boolean(row.can_edit),
  };
}

export function normaliseTags(tags: string[] | undefined) {
  if (!tags) return [];
  const cleaned = tags
    .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, "-"))
    .filter((tag) => /^[a-z0-9][a-z0-9-]{0,23}$/.test(tag));
  return Array.from(new Set(cleaned)).slice(0, 8);
}

function cleanTitle(value: string) {
  const title = value.trim().replace(/\s+/g, " ");
  if (!title) {
    throw new NewtonError("Give the document a title.", 422, "invalid_title");
  }
  if (title.length > 200) {
    throw new NewtonError(
      "Keep the title under 200 characters.",
      422,
      "invalid_title",
    );
  }
  return title;
}

async function assertTeamMembership(teamId: string, accountId: string) {
  const result = await query<{ role: string }>(
    `select m.role
       from newton_team_members m
       join newton_teams t on t.id = m.team_id
      where m.team_id = $1
        and m.account_id = $2
        and m.status = 'active'
        and t.archived_at is null
      limit 1`,
    [teamId, accountId],
  );

  if (!result.rows[0]) {
    throw new NewtonError("That team was not found.", 404, "team_not_found");
  }
  return result.rows[0].role;
}

/**
 * Documents visible to an account: its personal documents plus every document
 * shared with a team it belongs to. `can_edit` is computed in SQL so the client
 * never has to guess permissions.
 */
export async function listDocuments(
  accountId: string,
  options: { teamId?: string | null; search?: string } = {},
): Promise<NewtonDocument[]> {
  const search = options.search?.trim().slice(0, 120) || null;
  const teamId = options.teamId ?? null;

  const result = await query<DocumentRow>(
    `select d.id,
            d.title,
            d.body,
            d.tags,
            d.team_id,
            t.name as team_name,
            a.name as author_name,
            d.created_at,
            d.updated_at,
            (
              d.created_by = $1
              or d.account_id = $1
              or exists (
                select 1 from newton_team_members m
                 where m.team_id = d.team_id
                   and m.account_id = $1
                   and m.status = 'active'
                   and m.role in ('owner', 'admin')
              )
            ) as can_edit
       from newton_documents d
       left join newton_teams t on t.id = d.team_id
       left join accounts a on a.id = d.created_by
      where d.archived_at is null
        and (
          (d.team_id is null and d.account_id = $1)
          or exists (
            select 1 from newton_team_members m
             where m.team_id = d.team_id
               and m.account_id = $1
               and m.status = 'active'
          )
        )
        and ($2::uuid is null or d.team_id = $2::uuid)
        and (
          $3::text is null
          or d.title ilike '%' || $3 || '%'
          or d.body ilike '%' || $3 || '%'
          or exists (select 1 from unnest(d.tags) tag where tag ilike '%' || $3 || '%')
        )
      order by d.updated_at desc
      limit 200`,
    [accountId, teamId, search],
  );

  return result.rows.map(toDocument);
}

export async function getDocument(accountId: string, documentId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) {
    throw new NewtonError(
      "That document was not found.",
      404,
      "document_not_found",
    );
  }

  const result = await query<DocumentRow>(
    `select d.id,
            d.title,
            d.body,
            d.tags,
            d.team_id,
            t.name as team_name,
            a.name as author_name,
            d.created_at,
            d.updated_at,
            (
              d.created_by = $1
              or d.account_id = $1
              or exists (
                select 1 from newton_team_members m
                 where m.team_id = d.team_id
                   and m.account_id = $1
                   and m.status = 'active'
                   and m.role in ('owner', 'admin')
              )
            ) as can_edit
       from newton_documents d
       left join newton_teams t on t.id = d.team_id
       left join accounts a on a.id = d.created_by
      where d.id = $2
        and d.archived_at is null
        and (
          (d.team_id is null and d.account_id = $1)
          or exists (
            select 1 from newton_team_members m
             where m.team_id = d.team_id
               and m.account_id = $1
               and m.status = 'active'
          )
        )
      limit 1`,
    [accountId, documentId],
  );

  const document = result.rows[0];
  if (!document) {
    throw new NewtonError(
      "That document was not found.",
      404,
      "document_not_found",
    );
  }
  return toDocument(document);
}

export async function createDocument(
  accountId: string,
  input: {
    title: string;
    body?: string;
    tags?: string[];
    teamId?: string | null;
  },
): Promise<NewtonDocument> {
  const title = cleanTitle(input.title);
  const teamId = input.teamId || null;

  if (teamId) await assertTeamMembership(teamId, accountId);

  const id = newId();
  const result = await query<{ id: string }>(
    `insert into newton_documents
       (id, account_id, team_id, title, body, tags, created_by, updated_by)
     values ($1, $2, $3, $4, $5, $6, $2, $2)
     returning id`,
    [
      id,
      accountId,
      teamId,
      title,
      (input.body ?? "").slice(0, 200_000),
      normaliseTags(input.tags),
    ],
  );

  return getDocument(accountId, result.rows[0].id);
}

export async function updateDocument(
  accountId: string,
  documentId: string,
  input: {
    title?: string;
    body?: string;
    tags?: string[];
  },
): Promise<NewtonDocument> {
  const existing = await getDocument(accountId, documentId);
  if (!existing.canEdit) {
    throw new NewtonError(
      "Only the author, the document owner or a team admin can edit this document.",
      403,
      "document_forbidden",
    );
  }

  const title = input.title === undefined ? existing.title : cleanTitle(input.title);
  const body =
    input.body === undefined ? existing.body : input.body.slice(0, 200_000);
  const tags =
    input.tags === undefined ? existing.tags : normaliseTags(input.tags);

  await query(
    `update newton_documents
        set title = $2,
            body = $3,
            tags = $4,
            updated_by = $5,
            updated_at = now()
      where id = $1 and archived_at is null`,
    [documentId, title, body, tags, accountId],
  );

  return getDocument(accountId, documentId);
}

export async function archiveDocument(accountId: string, documentId: string) {
  const existing = await getDocument(accountId, documentId);
  if (!existing.canEdit) {
    throw new NewtonError(
      "Only the author, the document owner or a team admin can delete this document.",
      403,
      "document_forbidden",
    );
  }

  await query(
    `update newton_documents
        set archived_at = now(), updated_at = now()
      where id = $1`,
    [documentId],
  );
}
