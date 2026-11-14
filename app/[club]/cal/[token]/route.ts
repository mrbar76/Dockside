import { getClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { eventsBetween, memberByFeedToken } from "@/lib/core/data";
import { buildCalendar } from "@/lib/core/ics";
import { addDays } from "@/lib/core/time";
import { origin } from "@/lib/core/viewer";

// Calendar subscription feed. The key in the address belongs to one member and
// can be cancelled from their Me page.
export async function GET(_req: Request, ctx: RouteContext<"/[club]/cal/[token]">) {
  const { club: slug, token } = await ctx.params;
  const club = await getClub(slug);
  if (!club) return new Response("Not found", { status: 404 });
  const now = new Date();
  const list = await withClub(club.id, async (tx) =>
    (await memberByFeedToken(tx, token.replace(/\.ics$/, ""))) ? eventsBetween(tx, addDays(now, -30), addDays(now, 365)) : null);
  if (!list) return new Response("Not found", { status: 404 });
  return new Response(buildCalendar(club, list, await origin()), {
    headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=900" },
  });
}
