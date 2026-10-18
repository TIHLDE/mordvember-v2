import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { WeekRules } from "@/game/attendance";
import type { MilestoneRule } from "@/game/milestones";

const id = () => uuid("id").primaryKey().defaultRandom();
const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").notNull().defaultNow();

export const phaseEnum = pgEnum("phase", ["setup", "signup", "closed", "running", "ended"]);
export const staffRoleEnum = pgEnum("staff_role", ["gamemaster", "organizer"]);
export const playerStatusEnum = pgEnum("player_status", ["alive", "eliminated", "disqualified"]);
export const killStatusEnum = pgEnum("kill_status", ["pending", "escalated", "applied", "rejected", "undone"]);
export const reporterEnum = pgEnum("reporter", ["killer", "victim"]);
export const reviewDecisionEnum = pgEnum("review_decision", ["pending", "disqualified", "exception"]);
export const emailStatusEnum = pgEnum("email_status", ["pending", "sent", "failed"]);

export type SeasonSettings = {
  stats: { killsToday: boolean; sinceLastKill: boolean; topKillerToday: boolean };
  milestones: MilestoneRule[];
  defaultRules: WeekRules;
  office: { lat: number; lng: number; radiusMeters: number } | null;
  info: { rules: string; dates: string; startDate?: string | null };
};

export type SeasonSummary = { participants: number; kills: number; durationDays: number };

export const users = pgTable("users", {
  id: id(),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  photonImage: text("photon_image"),
  photonImageKey: text("photon_image_key"),
  studyProgram: text("study_program"),
  studyStartYear: integer("study_start_year"),
  classYear: integer("class_year"),
  createdAt: createdAt(),
  lastLoginAt: ts("last_login_at"),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  isKokLeader: boolean("is_kok_leader").notNull().default(false),
  isIndexLeader: boolean("is_index_leader").notNull().default(false),
  createdAt: createdAt(),
  expiresAt: ts("expires_at").notNull(),
});

export const seasons = pgTable("seasons", {
  id: id(),
  name: text("name").notNull(),
  phase: phaseEnum("phase").notNull().default("setup"),
  signupDeadline: ts("signup_deadline"),
  startedAt: ts("started_at"),
  endedAt: ts("ended_at"),
  winnerPlayerId: uuid("winner_player_id"),
  winnerName: text("winner_name"),
  settings: jsonb("settings").$type<SeasonSettings>().notNull(),
  summary: jsonb("summary").$type<SeasonSummary>(),
  dataDeletedAt: ts("data_deleted_at"),
  deletionReminderSentAt: ts("deletion_reminder_sent_at"),
  screenTokenHash: text("screen_token_hash"),
  screenTokenCreatedAt: ts("screen_token_created_at"),
  createdAt: createdAt(),
});

export const staff = pgTable(
  "staff",
  {
    id: id(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    role: staffRoleEnum("role").notNull(),
    addedBy: uuid("added_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("staff_season_username").on(t.seasonId, t.username)],
);

export const players = pgTable(
  "players",
  {
    id: id(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    studyProgram: text("study_program"),
    studyStartYear: integer("study_start_year"),
    imageKey: text("image_key"),
    useDefaultImage: boolean("use_default_image").notNull().default(true),
    imageRejectedReason: text("image_rejected_reason"),
    imageApprovedAt: ts("image_approved_at"),
    imageDeleted: boolean("image_deleted").notNull().default(false),
    status: playerStatusEnum("status").notNull().default("alive"),
    killCount: integer("kill_count").notNull().default(0),
    eliminatedAt: ts("eliminated_at"),
    revealAt: ts("reveal_at"),
    requirementsFromWeek: text("requirements_from_week"),
    consentAt: ts("consent_at").notNull(),
    winnerConsent: boolean("winner_consent").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("players_season_user").on(t.seasonId, t.userId), index("players_season").on(t.seasonId)],
);

export const circles = pgTable("circles", {
  seasonId: uuid("season_id")
    .primaryKey()
    .references(() => seasons.id, { onDelete: "cascade" }),
  ring: jsonb("ring").$type<string[]>().notNull(),
  version: integer("version").notNull().default(0),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const circleEvents = pgTable(
  "circle_events",
  {
    id: id(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    ringBefore: jsonb("ring_before").$type<string[]>().notNull(),
    ringAfter: jsonb("ring_after").$type<string[]>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("circle_events_season").on(t.seasonId, t.createdAt)],
);

export const kills = pgTable(
  "kills",
  {
    id: id(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    killerId: uuid("killer_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    victimId: uuid("victim_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    killedAt: ts("killed_at").notNull(),
    reportedBy: reporterEnum("reported_by").notNull(),
    reportedAt: ts("reported_at").notNull().defaultNow(),
    status: killStatusEnum("status").notNull().default("pending"),
    escalationReasons: jsonb("escalation_reasons").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    confirmedAt: ts("confirmed_at"),
    resolvedAt: ts("resolved_at"),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    resolutionNote: text("resolution_note"),
  },
  (t) => [index("kills_season").on(t.seasonId, t.status)],
);

export const checkins = pgTable(
  "checkins",
  {
    id: id(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    checkInAt: ts("check_in_at").notNull(),
    checkOutAt: ts("check_out_at"),
    autoClosed: boolean("auto_closed").notNull().default(false),
    approved: boolean("approved").notNull().default(false),
    rejected: boolean("rejected").notNull().default(false),
    flags: jsonb("flags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    distanceMeters: doublePrecision("distance_meters"),
    flagsReviewed: boolean("flags_reviewed").notNull().default(false),
    editedBy: uuid("edited_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("checkins_player").on(t.playerId, t.checkInAt), index("checkins_season").on(t.seasonId, t.checkInAt)],
);

export const weekRules = pgTable(
  "week_rules",
  {
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    weekStart: text("week_start").notNull(),
    rules: jsonb("rules").$type<WeekRules>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.seasonId, t.weekStart] })],
);

export const weeklyReviews = pgTable(
  "weekly_reviews",
  {
    id: id(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    weekStart: text("week_start").notNull(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    reasons: jsonb("reasons").$type<string[]>().notNull(),
    decision: reviewDecisionEnum("decision").notNull().default("pending"),
    decisionReason: text("decision_reason"),
    decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "set null" }),
    decidedAt: ts("decided_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("weekly_reviews_unique").on(t.seasonId, t.weekStart, t.playerId)],
);

export const milestoneEvents = pgTable(
  "milestone_events",
  {
    id: id(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    showAt: ts("show_at").notNull(),
    sendEmail: boolean("send_email").notNull(),
    emailedAt: ts("emailed_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("milestone_events_unique").on(t.seasonId, t.key)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    seasonId: uuid("season_id").references(() => seasons.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    href: text("href"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user").on(t.userId, t.createdAt)],
);

export const emailOutbox = pgTable("email_outbox", {
  id: id(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  content: jsonb("content").$type<EmailBlock[]>().notNull(),
  status: emailStatusEnum("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  claimedAt: ts("claimed_at"),
  createdAt: createdAt(),
  sentAt: ts("sent_at"),
});

export type EmailBlock =
  | { type: "title"; content: string }
  | { type: "text"; content: string }
  | { type: "button"; text: string; url: string };

export const emailTemplates = pgTable("email_templates", {
  key: text("key").primaryKey(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const questions = pgTable("questions", {
  id: id(),
  seasonId: uuid("season_id")
    .notNull()
    .references(() => seasons.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  answer: text("answer"),
  answeredBy: uuid("answered_by").references(() => users.id, { onDelete: "set null" }),
  answeredAt: ts("answered_at"),
  published: boolean("published").notNull().default(false),
  publicQuestion: text("public_question"),
  publicAnswer: text("public_answer"),
  createdAt: createdAt(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    seasonId: uuid("season_id").references(() => seasons.id, { onDelete: "set null" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_created").on(t.createdAt)],
);

export const emergencyAccess = pgTable("emergency_access", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  startedAt: ts("started_at").notNull().defaultNow(),
  expiresAt: ts("expires_at").notNull(),
  endedAt: ts("ended_at"),
});

export const jobRuns = pgTable("job_runs", {
  key: text("key").primaryKey(),
  ranAt: ts("ran_at").notNull().defaultNow(),
});
