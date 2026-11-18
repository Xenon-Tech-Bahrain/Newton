/** Shared Newton types. Safe to import from client components. */

export type NewtonMessageRole = "user" | "assistant";

export type NewtonAttachment = {
  id: string;
  type: "image" | "document" | "web";
  name: string;
  size: number;
  mimeType: string;
  /** Image sources use `/api/newton/attachments/{id}`; web sources use the page URL. */
  url?: string;
  extractedText?: string;
  /** Canonical URL of a fetched web page. */
  sourceUrl?: string;
};

export type NewtonMessage = {
  id: string;
  role: NewtonMessageRole;
  content: string;
  model: string | null;
  totalTokens: number | null;
  createdAt: string;
  attachments: NewtonAttachment[];
};

export type NewtonThreadSummary = {
  id: string;
  title: string;
  model: string | null;
  updatedAt: string;
  lastMessageAt: string | null;
  messageCount: number;
};

export type NewtonUsage = {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type NewtonPublicLimits = {
  messagesPerDay: number;
  tokensPerDay: number;
  maxPromptChars: number;
};

export type NewtonStatus = "ready" | "disabled" | "unconfigured";

/* -------------------------------------------------------------------------- */
/* Teams and team chat                                                        */
/* -------------------------------------------------------------------------- */

export type NewtonTeamRole = "owner" | "admin" | "member";
export type NewtonTeamMemberStatus = "active" | "invited" | "removed";

export type NewtonTeamSummary = {
  id: string;
  name: string;
  role: NewtonTeamRole;
  memberCount: number;
  channelCount: number;
  createdAt: string;
};

export type NewtonTeamChannel = {
  id: string;
  teamId: string;
  name: string;
  description: string | null;
  createdAt: string;
  messageCount: number;
  lastMessageAt: string | null;
};

export type NewtonTeamMember = {
  id: string;
  teamId: string;
  accountId: string | null;
  email: string;
  name: string | null;
  role: NewtonTeamRole;
  status: NewtonTeamMemberStatus;
  joinedAt: string | null;
  createdAt: string;
};

export type NewtonChannelMessage = {
  id: string;
  channelId: string;
  teamId: string;
  authorAccountId: string;
  authorName: string;
  body: string;
  createdAt: string;
  deletedAt: string | null;
};

/* -------------------------------------------------------------------------- */
/* Moderation                                                                 */
/* -------------------------------------------------------------------------- */

export type NewtonModerationStateName =
  | "clear"
  | "warned"
  | "restricted"
  | "suspended"
  | "terminated";

export type NewtonModerationState = {
  state: NewtonModerationStateName;
  reason: string | null;
  until: string | null;
  updatedAt: string | null;
};

export type NewtonModerationActionName =
  | "warn"
  | "restrict"
  | "suspend"
  | "terminate"
  | "lift"
  | "hide"
  | "restore";

export type NewtonModerationAction = {
  id: string;
  accountId: string;
  messageId: string | null;
  action: NewtonModerationActionName;
  reason: string;
  stateAfter: NewtonModerationStateName;
  until: string | null;
  createdBy: string;
  createdAt: string;
};

export type NewtonModeratedMessage = {
  id: string;
  threadId: string;
  accountId: string;
  accountCode: string;
  accountEmail: string;
  accountName: string | null;
  content: string;
  createdAt: string;
  moderationStatus: "visible" | "hidden" | "removed";
  moderationState: NewtonModerationState;
};

/* -------------------------------------------------------------------------- */
/* Inbound email                                                              */
/* -------------------------------------------------------------------------- */

export type NewtonEmailThreadStatus = "open" | "replied" | "closed";
export type NewtonEmailDirection = "inbound" | "outbound";

export type NewtonEmailThreadSummary = {
  id: string;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  status: NewtonEmailThreadStatus;
  lastMessageAt: string;
  createdAt: string;
  messageCount: number;
};

export type NewtonEmailMessage = {
  id: string;
  threadId: string;
  direction: NewtonEmailDirection;
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  subject: string;
  body: string;
  autoReply: boolean;
  senderRole: string | null;
  sentBy: string | null;
  status: "received" | "sent" | "failed";
  providerMessageId: string | null;
  error: string | null;
  createdAt: string;
};

/* -------------------------------------------------------------------------- */
/* Documents and tasks                                                        */
/* -------------------------------------------------------------------------- */

export type NewtonDocument = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  teamId: string | null;
  teamName: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
};

export type NewtonTaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type NewtonTaskPriority = "low" | "normal" | "high";

export type NewtonTask = {
  id: string;
  title: string;
  details: string;
  status: NewtonTaskStatus;
  priority: NewtonTaskPriority;
  dueDate: string | null;
  teamId: string | null;
  teamName: string | null;
  assignedAccountId: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  createdBy: string;
  canEdit: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};
