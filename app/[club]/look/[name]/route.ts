import { getClub } from "@/lib/core/clubs";
import { lookCookie, looksFor } from "@/lib/core/looks";

// Remembers which candidate look this phone wants to see, then goes back to
// the page the person was on. Demo clubs only.
export async function GET(req: Request, ctx: RouteContext<"/[club]/look/[name]">) {
  const { club: slug, name } = await ctx.params;
  const club = await getClub(slug);
  const ok = club && looksFor(club).some((l) => l.label.toLowerCase() === name);
  const ref = req.headers.get("referer");
  let back = `/${slug}/this-week`;
  try {
    const u = ref ? new URL(ref) : null;
    if (u && u.host === new URL(req.url).host && u.pathname.startsWith(`/${slug}`) && !u.pathname.includes("/look/")) back = u.pathname + u.search;
  } catch {}
  const headers = new Headers({ location: back, "cache-control": "no-store" });
  if (ok) headers.append("set-cookie", `${lookCookie(slug)}=${name}; Path=/; Max-Age=2592000; SameSite=Lax`);
  return new Response(null, { status: 303, headers });
}
