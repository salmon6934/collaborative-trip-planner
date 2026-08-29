ALTER TABLE "activity_blocks" ADD COLUMN "last_edited_by" uuid;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "cover_image_url" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "timezone" text;--> statement-breakpoint
ALTER TABLE "activity_blocks" ADD CONSTRAINT "activity_blocks_last_edited_by_users_id_fk" FOREIGN KEY ("last_edited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;