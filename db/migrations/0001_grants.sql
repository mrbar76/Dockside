-- The app runs every club request as dockside_app, a role that cannot sign in on
-- its own and only sees rows the club rule allows.
-- Lets the connecting user step down into the app role on hosts where that user is not a superuser.
GRANT dockside_app TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO dockside_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO dockside_app;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dockside_app;--> statement-breakpoint
-- Sign-in tables and the club list are not club-scoped: no access, and read-only.
REVOKE ALL ON "user", "session", "account", "verification" FROM dockside_app;--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON "clubs" FROM dockside_app;
