CREATE TABLE "dues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid DEFAULT nullif(current_setting('app.club_id', true), '')::uuid NOT NULL,
	"year" integer NOT NULL,
	"member_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"due_on" timestamp with time zone NOT NULL,
	"late_fee_pct" integer DEFAULT 0 NOT NULL,
	"lapse_on" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"paid_cents" integer,
	"paid_how" text,
	"reminded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dues" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid DEFAULT nullif(current_setting('app.club_id', true), '')::uuid NOT NULL,
	"member_id" uuid,
	"kind" text NOT NULL,
	"ref_id" uuid NOT NULL,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"fee_cents" integer DEFAULT 0 NOT NULL,
	"method" text NOT NULL,
	"demo" boolean DEFAULT false NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_signups" ADD COLUMN "counts" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "event_signups" ADD COLUMN "amount_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "event_signups" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_signups" ADD COLUMN "paid_how" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "prices" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "rsvp_by" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "members_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "dues" ADD CONSTRAINT "dues_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dues" ADD CONSTRAINT "dues_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_members_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dues_year_member" ON "dues" USING btree ("club_id","year","member_id");--> statement-breakpoint
CREATE INDEX "payments_created_idx" ON "payments" USING btree ("club_id","created_at");--> statement-breakpoint
CREATE POLICY "club_isolation" ON "dues" AS PERMISSIVE FOR ALL TO "dockside_app" USING (club_id = nullif(current_setting('app.club_id', true), '')::uuid) WITH CHECK (club_id = nullif(current_setting('app.club_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "club_isolation" ON "payments" AS PERMISSIVE FOR ALL TO "dockside_app" USING (club_id = nullif(current_setting('app.club_id', true), '')::uuid) WITH CHECK (club_id = nullif(current_setting('app.club_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "dues", "payments" TO dockside_app;
