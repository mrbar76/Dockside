// A club can live at its own web address. CLUB_HOSTS maps host names to club
// slugs ("mrbyc.org=mrbyc,harborpoint.club=harbor-point"); a request to that
// host is served from the club's section without the slug showing in the URL.
import { NextResponse, type NextRequest } from "next/server";

const map = new Map(
  (process.env.CLUB_HOSTS ?? "").split(",").map((p) => p.trim().split("=")).filter((p) => p.length === 2) as [string, string][],
);

export function proxy(req: NextRequest) {
  const slug = map.get((req.headers.get("host") ?? "").toLowerCase().replace(/:\d+$/, ""));
  const { pathname } = req.nextUrl;
  if (!slug || pathname.startsWith(`/${slug}/`) || pathname === `/${slug}`) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = `/${slug}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = { matcher: ["/((?!api|_next|sw.js|favicon.ico).*)"] };
