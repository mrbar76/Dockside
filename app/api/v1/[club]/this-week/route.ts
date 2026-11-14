import { getClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { memberByLinkToken, thisWeek } from "@/lib/core/data";
import { getTides } from "@/lib/core/tides";

// The same week, as data. A club that wants a front end unlike any skin builds
// it against this and still shares the core. Public view by default; pass a
// member's personal link key as ?k= for their view. Never returns contact details.
export async function GET(req: Request, ctx: RouteContext<"/api/v1/[club]/this-week">) {
  const club = await getClub((await ctx.params).club);
  if (!club) return Response.json({ error: "No such club" }, { status: 404 });
  const key = new URL(req.url).searchParams.get("k");
  const now = new Date();
  const { member, data } = await withClub(club.id, async (tx) => {
    const member = key ? await memberByLinkToken(tx, key) : null;
    return { member, data: await thisWeek(tx, member, now) };
  });
  if (key && !member) return Response.json({ error: "Link not recognized" }, { status: 404 });
  const tides = await getTides(club.settings.noaaStation, now);
  return Response.json({
    club: { slug: club.slug, name: club.name, place: club.settings.place, timezone: club.timezone },
    events: data.events.map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt, endsAt: e.endsAt, location: e.location, going: data.counts.get(e.id) ?? 0, youAreGoing: data.going.has(e.id) })),
    notices: data.notices.map((n) => ({ id: n.id, title: n.title, body: n.body, urgent: n.urgent, publishedAt: n.publishedAt })),
    openSeats: member
      ? data.rides.map((r) => ({ id: r.offer.id, title: r.offer.title, departsAt: r.offer.departsAt, kind: r.offer.kind, seatsLeft: r.seatsLeft, with: r.owner.firstName, boat: r.owner.boatName }))
      : { count: data.rides.length },
    tides: tides.filter((t) => t.at > now).slice(0, 6),
  });
}
