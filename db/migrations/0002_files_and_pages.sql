CREATE TABLE "club_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid DEFAULT nullif(current_setting('app.club_id', true), '')::uuid NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"photo_id" uuid,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "club_pages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid DEFAULT nullif(current_setting('app.club_id', true), '')::uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"size" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"members_only" boolean DEFAULT true NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "club_pages" ADD CONSTRAINT "club_pages_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_pages" ADD CONSTRAINT "club_pages_photo_id_files_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_pages" ADD CONSTRAINT "club_pages_updated_by_members_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_members_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "club_pages_key" ON "club_pages" USING btree ("club_id","key");--> statement-breakpoint
CREATE POLICY "club_isolation" ON "club_pages" AS PERMISSIVE FOR ALL TO "dockside_app" USING (club_id = nullif(current_setting('app.club_id', true), '')::uuid) WITH CHECK (club_id = nullif(current_setting('app.club_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "club_isolation" ON "files" AS PERMISSIVE FOR ALL TO "dockside_app" USING (club_id = nullif(current_setting('app.club_id', true), '')::uuid) WITH CHECK (club_id = nullif(current_setting('app.club_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "files", "club_pages" TO dockside_app;
