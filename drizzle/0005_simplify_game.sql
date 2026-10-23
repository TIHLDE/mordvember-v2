DROP TABLE "milestone_events" CASCADE;--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN "reveal_at";--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN "winner_consent";--> statement-breakpoint
ALTER TABLE "seasons" DROP COLUMN "signup_deadline";--> statement-breakpoint
ALTER TABLE "seasons" DROP COLUMN "ended_at";--> statement-breakpoint
ALTER TABLE "seasons" DROP COLUMN "winner_name";--> statement-breakpoint
ALTER TABLE "seasons" DROP COLUMN "summary";--> statement-breakpoint
ALTER TABLE "seasons" DROP COLUMN "data_deleted_at";--> statement-breakpoint
ALTER TABLE "seasons" DROP COLUMN "deletion_reminder_sent_at";--> statement-breakpoint
ALTER TABLE "seasons" DROP COLUMN "screen_token_hash";--> statement-breakpoint
ALTER TABLE "seasons" DROP COLUMN "screen_token_created_at";--> statement-breakpoint
DELETE FROM "staff" WHERE "role" = 'organizer';--> statement-breakpoint
ALTER TABLE "staff" DROP COLUMN "role";--> statement-breakpoint
DROP TYPE "public"."staff_role";