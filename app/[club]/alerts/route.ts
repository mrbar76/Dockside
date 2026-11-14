import { getClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { alertSubscriptions } from "@/lib/db/schema";
import { getViewer } from "@/lib/core/viewer";

// Registers this phone for alerts, for the signed-in member.
export async function POST(req: Request, ctx: RouteContext<"/[club]/alerts">) {
  const club = await getClub((await ctx.params).club);
  const viewer = club && (await getViewer(club.id));
  if (!club || !viewer) return new Response("Sign in first", { status: 401 });
  const sub = (await req.json().catch(() => null)) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null;
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys.auth) return new Response("Bad subscription", { status: 400 });
  await withClub(club.id, (tx) => tx.insert(alertSubscriptions)
    .values({ memberId: viewer.member.id, endpoint: sub.endpoint!, p256dh: sub.keys!.p256dh!, auth: sub.keys!.auth! }).onConflictDoNothing());
  return Response.json({ ok: true });
}
