CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid DEFAULT nullif(current_setting('app.club_id', true), '')::uuid NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"zip" text DEFAULT '' NOT NULL,
	"occupation" text DEFAULT '' NOT NULL,
	"business_phone" text DEFAULT '' NOT NULL,
	"spouse_name" text DEFAULT '' NOT NULL,
	"children" text DEFAULT '' NOT NULL,
	"boat_name" text DEFAULT '' NOT NULL,
	"boat_type" text DEFAULT '' NOT NULL,
	"boat_length" text DEFAULT '' NOT NULL,
	"boat_beam" text DEFAULT '' NOT NULL,
	"sponsor_name" text DEFAULT '' NOT NULL,
	"sponsor_phone" text DEFAULT '' NOT NULL,
	"sponsor_email" text DEFAULT '' NOT NULL,
	"sponsor_id" uuid,
	"sponsored_at" timestamp with time zone,
	"sponsor_how" text DEFAULT '' NOT NULL,
	"interests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"interests_other" text DEFAULT '' NOT NULL,
	"residency_certified" boolean DEFAULT false NOT NULL,
	"proof_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"paid_at" timestamp with time zone,
	"payment_note" text DEFAULT '' NOT NULL,
	"committee_at" timestamp with time zone,
	"board_at" timestamp with time zone,
	"vote_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"decision_note" text DEFAULT '' NOT NULL,
	"officer_notes" text DEFAULT '' NOT NULL,
	"member_id" uuid,
	"status_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "officers_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_sponsor_id_members_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "applications_token_idx" ON "applications" USING btree ("status_token");--> statement-breakpoint
CREATE INDEX "applications_status_idx" ON "applications" USING btree ("club_id","status");--> statement-breakpoint
CREATE POLICY "club_isolation" ON "applications" AS PERMISSIVE FOR ALL TO "dockside_app" USING (club_id = nullif(current_setting('app.club_id', true), '')::uuid) WITH CHECK (club_id = nullif(current_setting('app.club_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "applications" TO dockside_app;
