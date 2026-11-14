import { ImageResponse } from "next/og";
import { getClub } from "@/lib/core/clubs";

// Phone icon, drawn from the club's burgee colors.
export async function GET(_req: Request, ctx: RouteContext<"/[club]/icon/[size]">) {
  const { club: slug, size } = await ctx.params;
  const club = await getClub(slug);
  if (!club) return new Response("Not found", { status: 404 });
  const n = [180, 192, 512].includes(Number(size)) ? Number(size) : 192;
  const [field, device, stripe] = club.theme.burgee;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: field, borderBottom: `${Math.round(n * 0.1)}px solid ${stripe}`, color: device, fontSize: Math.round(n * 0.27), fontWeight: 700 }}>
        {club.shortName.slice(0, 5)}
      </div>
    ),
    { width: n, height: n },
  );
}
