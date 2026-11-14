import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { getClub, requireClub } from "@/lib/core/clubs";
import { themeVars } from "@/lib/core/theme";
import { getViewer } from "@/lib/core/viewer";
import { Burgee } from "@/components/Burgee";
import { Tabs } from "@/components/Tabs";

export async function generateMetadata({ params }: LayoutProps<"/[club]">): Promise<Metadata> {
  const club = await getClub((await params).club);
  if (!club) return {};
  return {
    title: { default: club.name, template: `%s, ${club.shortName}` },
    description: club.tagline,
    manifest: `/${club.slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: club.shortName, statusBarStyle: "default" },
    icons: { icon: `/${club.slug}/icon/192`, apple: `/${club.slug}/icon/180` },
  };
}

export async function generateViewport({ params }: LayoutProps<"/[club]">): Promise<Viewport> {
  const club = await getClub((await params).club);
  return { themeColor: club?.theme.colors.brand, width: "device-width", initialScale: 1 };
}

// Everything a club shows sits inside this frame. The frame reads the club's
// theme and sets it as CSS variables; no page below knows which club it is in.
export default async function ClubLayout({ children, params }: LayoutProps<"/[club]">) {
  const club = await requireClub((await params).club);
  const viewer = await getViewer(club.id);
  const base = `/${club.slug}`;
  const tabs = [
    { href: `${base}/this-week`, label: "This week" },
    { href: `${base}/calendar`, label: "Calendar" },
    { href: `${base}/rides`, label: "Rides" },
    { href: `${base}/news`, label: "News" },
    { href: `${base}/directory`, label: "Directory", wideOnly: true },
    { href: `${base}/documents`, label: "Documents", wideOnly: true },
    ...(viewer?.isOfficer ? [{ href: `${base}/officers`, label: "Officers", wideOnly: true }] : []),
    { href: `${base}/me`, label: "Me" },
  ];
  return (
    <div className="club" data-skin={club.theme.skin} style={themeVars(club.theme)}>
      {club.settings.demo && <p className="demo-bar">Demonstration with made-up people and events. Not the club&apos;s live site.</p>}
      <header>
        <div className="masthead">
          <Link href={base} aria-label={`${club.name} home`}><Burgee colors={club.theme.burgee} label="" /></Link>
          <Link href={base} className="name">{club.name}</Link>
          <span className="who">
            {viewer ? <Link href={`${base}/me`}>{viewer.member.firstName}</Link> : <Link href={`${base}/sign-in`}>Sign in</Link>}
          </span>
        </div>
        <Tabs items={tabs} />
      </header>
      <main className="club-body">{children}</main>
      <footer className="foot">
        {club.name}, {club.settings.place}.{" "}
        {club.settings.contactEmail && <a href={`mailto:${club.settings.contactEmail}`}>{club.settings.contactEmail}</a>}
      </footer>
    </div>
  );
}
