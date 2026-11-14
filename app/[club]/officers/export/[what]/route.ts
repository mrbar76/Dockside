import { getClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { getViewer } from "@/lib/core/viewer";
import { TABLES, rowsOf, toCsv } from "@/lib/core/export";
import { auditLog } from "@/lib/db/schema";

// /officers/export/members.csv, or /officers/export/everything.json
export async function GET(_req: Request, ctx: RouteContext<"/[club]/officers/export/[what]">) {
  const { club: slug, what } = await ctx.params;
  const club = await getClub(slug);
  if (!club) return new Response("Not found", { status: 404 });
  const viewer = await getViewer(club.id);
  if (!viewer?.isOfficer) return new Response("Officers only.", { status: 403 });
  const [key, ext] = what.split(".");
  const day = new Date().toISOString().slice(0, 10);
  const headers = (type: string, name: string) => ({
    "content-type": type, "content-disposition": `attachment; filename="${slug}-${name}-${day}.${ext}"`, "cache-control": "no-store",
  });
  if (key === "everything" && ext === "json") {
    const out = await withClub(club.id, async (tx) => {
      const all: Record<string, unknown> = { club: { name: club.name, slug: club.slug, exportedAt: new Date().toISOString() } };
      for (const k of Object.keys(TABLES)) all[k] = await rowsOf(tx, k);
      await tx.insert(auditLog).values({ actorId: viewer.member.id, action: "export", detail: { what } });
      return all;
    });
    return new Response(JSON.stringify(out, null, 2), { headers: headers("application/json", "everything") });
  }
  if (ext !== "csv" || !TABLES[key]) return new Response("Not found", { status: 404 });
  const rows = await withClub(club.id, async (tx) => {
    const r = await rowsOf(tx, key);
    await tx.insert(auditLog).values({ actorId: viewer.member.id, action: "export", detail: { what } });
    return r ?? [];
  });
  return new Response("﻿" + toCsv(rows), { headers: headers("text/csv; charset=utf-8", key) });
}
