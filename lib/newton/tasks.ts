import { newId } from "@/lib/admin/ids";
import { query } from "@/lib/db";
import { NewtonError } from "@/lib/newton/errors";
import type {
  NewtonTask,
  NewtonTaskPriority,
  NewtonTaskStatus,
} from "@/lib/newton/types";

type TaskRow = {
  id: string;
  title: string;
  details: string;
  status: NewtonTaskStatus;
  priority: NewtonTaskPriority;
  due_date: string | null;
  team_id: string | null;
  team_name: string | null;
  assigned_account_id: string | null;
  assignee_name: string | null;
  assignee_email: string | null;
  created_by: string;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

const STATUSES: NewtonTaskStatus[] = ["todo", "in_progress", "blocked", "done"];
const PRIORITIES: NewtonTaskPriority[] = ["low", "normal", "high"];

function toTask(row: TaskRow): NewtonTask {
  return {
    id: row.id,
    title: row.title,
    details: row.details,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    teamId: row.team_id,
    teamName: row.team_name,
    assignedAccountId: row.assigned_account_id,
    assigneeName: row.assignee_name,
    assigneeEmail: row.assignee_email,
    createdBy: row.created_by,
    canEdit: Boolean(row.can_edit),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

function cleanTitle(value: string) {
  const title = value.trim().replace(/\s+/g, " ");
  if (!title) {
    throw new NewtonError("Give the task a title.", 422, "invalid_title");
  }
  if (title.length > 200) {
    throw new NewtonError(
      "Keep the task title under 200 characters.",
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
 * Tasks visible to an account: personal tasks it created or was assigned, plus
 * tasks on any team it belongs to.
 */
export async function listTasks(
  accountId: string,
  options: { teamId?: string | null; status?: NewtonTaskStatus | null } = {},
): Promise<NewtonTask[]> {
  const teamId = options.teamId ?? null;
  const status =
    options.status && STATUSES.includes(options.status) ? options.status : null;

  const result = await query<TaskRow>(
    `select k.id,
            k.title,
            k.details,
            k.status,
            k.priority,
            k.due_date::text as due_date,
            k.team_id,
            t.name as team_name,
            k.assigned_account_id,
            assignee.name as assignee_name,
            assignee.email as assignee_email,
            k.account_id as created_by,
            (
              k.account_id = $1
              or k.assigned_account_id = $1
              or exists (
                select 1 from newton_team_members m
                 where m.team_id = k.team_id
                   and m.account_id = $1
                   and m.status = 'active'
                   and m.role in ('owner', 'admin')
              )
            ) as can_edit,
            k.created_at,
            k.updated_at,
            k.completed_at
       from newton_tasks k
       left join newton_teams t on t.id = k.team_id
       left join accounts assignee on assignee.id = k.assigned_account_id
      where (
          (k.team_id is null and (k.account_id = $1 or k.assigned_account_id = $1))
          or exists (
            select 1 from newton_team_members m
             where m.team_id = k.team_id
               and m.account_id = $1
               and m.status = 'active'
          )
        )
        and ($2::uuid is null or k.team_id = $2::uuid)
        and ($3::text is null or k.status = $3)
      order by
        case k.status
          when 'todo' then 0
          when 'in_progress' then 1
          when 'blocked' then 2
          else 3
        end,
        k.due_date nulls last,
        k.created_at desc
      limit 300`,
    [accountId, teamId, status],
  );

  return result.rows.map(toTask);
}

export async function getTask(accountId: string, taskId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(taskId)) {
    throw new NewtonError("That task was not found.", 404, "task_not_found");
  }

  const result = await query<TaskRow>(
    `select k.id,
            k.title,
            k.details,
            k.status,
            k.priority,
            k.due_date::text as due_date,
            k.team_id,
            t.name as team_name,
            k.assigned_account_id,
            assignee.name as assignee_name,
            assignee.email as assignee_email,
            k.account_id as created_by,
            (
              k.account_id = $1
              or k.assigned_account_id = $1
              or exists (
                select 1 from newton_team_members m
                 where m.team_id = k.team_id
                   and m.account_id = $1
                   and m.status = 'active'
                   and m.role in ('owner', 'admin')
              )
            ) as can_edit,
            k.created_at,
            k.updated_at,
            k.completed_at
       from newton_tasks k
       left join newton_teams t on t.id = k.team_id
       left join accounts assignee on assignee.id = k.assigned_account_id
      where k.id = $2
        and (
          (k.team_id is null and (k.account_id = $1 or k.assigned_account_id = $1))
          or exists (
            select 1 from newton_team_members m
             where m.team_id = k.team_id
               and m.account_id = $1
               and m.status = 'active'
          )
        )
      limit 1`,
    [accountId, taskId],
  );

  const task = result.rows[0];
  if (!task) {
    throw new NewtonError("That task was not found.", 404, "task_not_found");
  }
  return toTask(task);
}

export async function createTask(
  accountId: string,
  input: {
    title: string;
    details?: string;
    teamId?: string | null;
    assignedEmail?: string | null;
    priority?: NewtonTaskPriority;
    dueDate?: string | null;
  },
): Promise<NewtonTask> {
  const title = cleanTitle(input.title);
  const teamId = input.teamId || null;
  if (teamId) await assertTeamMembership(teamId, accountId);

  let assignedAccountId: string | null = null;
  if (input.assignedEmail?.trim()) {
    const email = input.assignedEmail.trim().toLowerCase();
    const assignee = await query<{ id: string }>(
      `select id from accounts
        where lower(email) = lower($1) and deleted_at is null
        limit 1`,
      [email],
    );
    assignedAccountId = assignee.rows[0]?.id ?? null;

    if (teamId && assignedAccountId) {
      const membership = await query<{ id: string }>(
        `select id from newton_team_members
          where team_id = $1 and account_id = $2 and status = 'active'
          limit 1`,
        [teamId, assignedAccountId],
      );
      if (!membership.rows[0]) {
        throw new NewtonError(
          "That person is not on this team.",
          422,
          "assignee_not_member",
        );
      }
    }
  }

  const priority = PRIORITIES.includes(input.priority as NewtonTaskPriority)
    ? (input.priority as NewtonTaskPriority)
    : "normal";
  const dueDate = input.dueDate?.trim() || null;
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    throw new NewtonError("Enter a valid due date.", 422, "invalid_due_date");
  }

  const id = newId();
  await query(
    `insert into newton_tasks
       (id, account_id, team_id, assigned_account_id, title, details, priority, due_date)
     values ($1, $2, $3, $4, $5, $6, $7, $8::date)`,
    [
      id,
      accountId,
      teamId,
      assignedAccountId,
      title,
      (input.details ?? "").slice(0, 20_000),
      priority,
      dueDate,
    ],
  );

  return getTask(accountId, id);
}

export async function updateTask(
  accountId: string,
  taskId: string,
  input: {
    title?: string;
    details?: string;
    status?: NewtonTaskStatus;
    priority?: NewtonTaskPriority;
    dueDate?: string | null;
    assignedEmail?: string | null;
  },
): Promise<NewtonTask> {
  const existing = await getTask(accountId, taskId);
  if (!existing.canEdit) {
    throw new NewtonError(
      "Only the creator, the assignee or a team admin can change this task.",
      403,
      "task_forbidden",
    );
  }

  const title =
    input.title === undefined ? existing.title : cleanTitle(input.title);
  const details =
    input.details === undefined
      ? existing.details
      : input.details.slice(0, 20_000);
  const status =
    input.status && STATUSES.includes(input.status)
      ? input.status
      : existing.status;
  const priority =
    input.priority && PRIORITIES.includes(input.priority)
      ? input.priority
      : existing.priority;
  const dueDate =
    input.dueDate === undefined ? existing.dueDate : input.dueDate?.trim() || null;

  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    throw new NewtonError("Enter a valid due date.", 422, "invalid_due_date");
  }

  let assignedAccountId = existing.assignedAccountId;
  if (input.assignedEmail !== undefined) {
    if (!input.assignedEmail?.trim()) {
      assignedAccountId = null;
    } else {
      const assignee = await query<{ id: string }>(
        `select id from accounts
          where lower(email) = lower($1) and deleted_at is null
          limit 1`,
        [input.assignedEmail.trim()],
      );
      assignedAccountId = assignee.rows[0]?.id ?? null;
      if (!assignedAccountId) {
        throw new NewtonError(
          "No EcoAccount matches that email.",
          422,
          "assignee_not_found",
        );
      }
      if (existing.teamId) {
        const membership = await query<{ id: string }>(
          `select id from newton_team_members
            where team_id = $1 and account_id = $2 and status = 'active'
            limit 1`,
          [existing.teamId, assignedAccountId],
        );
        if (!membership.rows[0]) {
          throw new NewtonError(
            "That person is not on this team.",
            422,
            "assignee_not_member",
          );
        }
      }
    }
  }

  await query(
    `update newton_tasks
        set title = $2,
            details = $3,
            status = $4,
            priority = $5,
            due_date = $6::date,
            assigned_account_id = $7,
            completed_at = case when $4 = 'done' then coalesce(completed_at, now()) else null end,
            updated_at = now()
      where id = $1`,
    [
      taskId,
      title,
      details,
      status,
      priority,
      dueDate,
      assignedAccountId,
    ],
  );

  return getTask(accountId, taskId);
}

export async function deleteTask(accountId: string, taskId: string) {
  const existing = await getTask(accountId, taskId);
  if (!existing.canEdit) {
    throw new NewtonError(
      "Only the creator, the assignee or a team admin can delete this task.",
      403,
      "task_forbidden",
    );
  }

  await query(`delete from newton_tasks where id = $1`, [taskId]);
}

export async function getTaskSummary(accountId: string) {
  const result = await query<{
    open: number;
    due_soon: number;
    done_week: number;
    mine: number;
  }>(
    `select
       count(*) filter (where k.status <> 'done')::int as open,
       count(*) filter (
         where k.status <> 'done'
           and k.due_date is not null
           and k.due_date <= current_date + 7
       )::int as due_soon,
       count(*) filter (
         where k.status = 'done'
           and k.completed_at >= now() - interval '7 days'
       )::int as done_week,
       count(*) filter (
         where k.status <> 'done' and k.assigned_account_id = $1
       )::int as mine
     from newton_tasks k
     where (
       (k.team_id is null and (k.account_id = $1 or k.assigned_account_id = $1))
       or exists (
         select 1 from newton_team_members m
          where m.team_id = k.team_id
            and m.account_id = $1
            and m.status = 'active'
       )
     )`,
    [accountId],
  );

  const row = result.rows[0];
  return {
    open: Number(row?.open ?? 0),
    dueSoon: Number(row?.due_soon ?? 0),
    doneThisWeek: Number(row?.done_week ?? 0),
    mine: Number(row?.mine ?? 0),
  };
}

