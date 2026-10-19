ALTER TABLE "sessions" ADD COLUMN "photon_access_token" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "photon_refresh_token" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "photon_token_expires_at" timestamp with time zone;