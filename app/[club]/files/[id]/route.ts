import { eq } from "drizzle-orm";
import { getClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { getViewer } from "@/lib/core/viewer";

// Serves an uploaded file. Members-only files need a signed-in member of this club.
export async function GET(_req: Request, ctx: RouteContext<"/[club]/files/[id]">) {
  const { club: slug, id } = await ctx.params;
  const club = await getClub(slug);
  if (!club || !/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const [file] = await withClub(club.id, (tx) => tx.select().from(files).where(eq(files.id, id)).limit(1));
  if (!file) return new Response("Not found", { status: 404 });
  if (file.membersOnly && !(await getViewer(club.id))) return new Response("Sign in to open this file.", { status: 401 });
  const safe = file.name.replace(/[^\w.\- ]+/g, "_");
  return new Response(new Uint8Array(file.data), {
    headers: {
      "content-type": file.type, "content-length": String(file.size),
      "content-disposition": `${file.type.startsWith("image/") || file.type === "application/pdf" ? "inline" : "attachment"}; filename="${safe}"`,
      "cache-control": file.membersOnly ? "private, no-store" : "public, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
}
