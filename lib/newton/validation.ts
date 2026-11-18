import { z } from "zod";
import { ModelId } from "@/lib/newton/config";

export const createThreadSchema = z.object({
  title: z.string().trim().max(120).optional(),
});

export const renameThreadSchema = z.object({
  title: z.string().trim().min(1, "Give the chat a name.").max(120),
});

const attachmentSchema = z.object({
  id: z.string(),
  type: z.enum(["image", "document", "web"]),
  name: z.string().max(300),
  size: z.number(),
  mimeType: z.string(),
  url: z.string().max(2000).optional(),
  extractedText: z.string().max(200_000).optional(),
  sourceUrl: z.string().max(2000).optional(),
});

export const sendMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Write a message for Aria.")
    .max(8000, "Aria can read up to 8,000 characters per message."),
  model: z.string().optional(),
  attachments: z.array(attachmentSchema).optional().default([]),
});

export const teamNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give your team a name.")
    .max(80, "Keep the team name under 80 characters."),
});

export const inviteMemberSchema = z.object({
  email: z.string().trim().email().max(320),
  role: z.enum(["admin", "member"]).optional().default("member"),
});

export const memberRoleSchema = z.object({
  role: z.enum(["admin", "member"]),
});

export const createChannelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the channel a name.")
    .max(60, "Keep the channel name under 60 characters."),
  description: z.string().trim().max(280).optional(),
});

export const channelMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Write a message first.")
    .max(4000, "Keep messages under 4,000 characters."),
});

export const documentCreateSchema = z.object({
  title: z.string().trim().min(1, "Give the document a title.").max(200),
  body: z.string().max(200_000).optional().default(""),
  tags: z.array(z.string().max(24)).max(8).optional().default([]),
  teamId: z.string().uuid().nullable().optional(),
});

export const documentUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().max(200_000).optional(),
  tags: z.array(z.string().max(24)).max(8).optional(),
});

const taskStatusSchema = z.enum(["todo", "in_progress", "blocked", "done"]);
const taskPrioritySchema = z.enum(["low", "normal", "high"]);
const dueDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid due date.")
  .nullable()
  .optional();

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, "Give the task a title.").max(200),
  details: z.string().max(20_000).optional().default(""),
  teamId: z.string().uuid().nullable().optional(),
  assignedEmail: z.string().trim().email().max(320).nullable().optional(),
  priority: taskPrioritySchema.optional().default("normal"),
  dueDate: dueDateSchema,
});

export const taskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  details: z.string().max(20_000).optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  dueDate: dueDateSchema,
  assignedEmail: z.string().trim().email().max(320).nullable().optional(),
});

export const fetchUrlSchema = z.object({
  url: z.string().trim().min(4).max(2000),
});
