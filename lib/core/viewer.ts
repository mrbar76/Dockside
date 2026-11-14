import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "../auth";
import { withClub } from "../db";
import { members, type Club, type Member } from "../db/schema";

export type Viewer = { member: Member; profiles: Member[]; isOfficer: boolean };

// Who is looking, for this club. A couple sharing one email address signs in
// once and picks whose profile to use.
export const getViewer = cache(async (clubId: string): Promise<Viewer | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const email = session.user.email.toLowerCase();
  const profiles = await withClub(clubId, (tx) =>
    tx.select().from(members).where(and(eq(members.email, email), eq(members.active, true))).orderBy(members.firstName),
  );
  if (profiles.length === 0) return null;
  const chosen = (await cookies()).get(`profile_${clubId}`)?.value;
  const member = profiles.find((p) => p.id === chosen) ?? profiles[0];
  return { member, profiles, isOfficer: member.role === "officer" };
});

export async function requireViewer(club: Club, back: string): Promise<Viewer> {
  const viewer = await getViewer(club.id);
  if (!viewer) redirect(`/${club.slug}/sign-in?next=${encodeURIComponent(back)}`);
  return viewer;
}

export async function requireOfficer(club: Club, back: string): Promise<Viewer> {
  const viewer = await requireViewer(club, back);
  if (!viewer.isOfficer) redirect(`/${club.slug}/this-week`);
  return viewer;
}

export async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
