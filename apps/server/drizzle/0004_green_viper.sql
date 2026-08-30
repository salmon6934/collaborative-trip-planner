CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"amount_minor" integer NOT NULL,
	"note" text,
	"settled_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Expense splits: migrate float `amount_owed` -> integer `owed_minor`, add `paid_minor`.
ALTER TABLE "expense_splits" ADD COLUMN "owed_minor" integer;--> statement-breakpoint
UPDATE "expense_splits" SET "owed_minor" = round("amount_owed" * 100);--> statement-breakpoint
ALTER TABLE "expense_splits" ALTER COLUMN "owed_minor" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "expense_splits" ADD COLUMN "paid_minor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Expenses: migrate float `amount` -> integer `amount_minor`, add soft-delete column.
ALTER TABLE "expenses" ADD COLUMN "amount_minor" integer;--> statement-breakpoint
UPDATE "expenses" SET "amount_minor" = round("amount" * 100);--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "amount_minor" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Drop the legacy per-split settled flag (replaced by the settlements table) and float money columns.
ALTER TABLE "expense_splits" DROP COLUMN "amount_owed";--> statement-breakpoint
ALTER TABLE "expense_splits" DROP COLUMN "is_settled";--> statement-breakpoint
ALTER TABLE "expenses" DROP COLUMN "amount";
