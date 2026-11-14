import { getClub } from "@/lib/core/clubs";
import { effectiveTheme } from "@/lib/core/looks";

// What makes the club page installable as a phone icon, in the club's colors.
export async function GET(_req: Request, ctx: RouteContext<"/[club]/manifest.webmanifest">) {
  const club = await getClub((await ctx.params).club);
  if (!club) return new Response("Not found", { status: 404 });
  const base = `/${club.slug}`;
  return Response.json(
    {
      name: club.name, short_name: club.shortName, description: club.tagline,
      id: `${base}/`, start_url: `${base}/this-week`, scope: `${base}/`, display: "standalone",
      background_color: effectiveTheme(club).colors.bg, theme_color: effectiveTheme(club).colors.brand,
      icons: [192, 512].map((n) => ({ src: `${base}/icon/${n}`, sizes: `${n}x${n}`, type: "image/png", purpose: "any maskable" })),
    },
    { headers: { "content-type": "application/manifest+json" } },
  );
}
