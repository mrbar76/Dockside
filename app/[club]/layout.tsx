import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getClub, requireClub } from "@/lib/core/clubs";
import { themeVars } from "@/lib/core/theme";
import { getViewer } from "@/lib/core/viewer";
import { Burgee } from "@/components/Burgee";
import { FlagHoist } from "@/components/FlagHoist";
import { effectiveTheme, lookCookie, looksFor } from "@/lib/core/looks";
import { getStationPosition } from "@/lib/core/tides";
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
  const picked = club ? (await cookies()).get(lookCookie(club.slug))?.value : undefined;
  return { themeColor: club ? effectiveTheme(club, picked).colors.brand : undefined, width: "device-width", initialScale: 1 };
}

// Everything a club shows sits inside this frame. The frame reads the club's
// theme and sets it as CSS variables; no page below knows which club it is in.
export default async function ClubLayout({ children, params }: LayoutProps<"/[club]">) {
  const club = await requireClub((await params).club);
  const viewer = await getViewer(club.id);
  const base = `/${club.slug}`;
  const looks = looksFor(club);
  const picked = (await cookies()).get(lookCookie(club.slug))?.value;
  const theme = effectiveTheme(club, picked);
  const current = (looks.find((l) => l.label.toLowerCase() === picked) ?? looks[0])?.label;
  const position = await getStationPosition(club.settings.noaaStation);
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
    <div className="club" data-skin={theme.skin} style={themeVars(theme)}>
      {club.settings.demo && (
        <div className="demo-bar">
          <p>Demonstration with made-up people and events. Not the club&apos;s live site.</p>
          {looks.length > 1 && (
            <nav className="looks" aria-label="Try a look">
              <span>Try a look:</span>
              {looks.map((l) => (
                <a key={l.label} href={`${base}/look/${l.label.toLowerCase()}`} aria-current={l.label === current ? "true" : undefined}>{l.label}</a>
              ))}
            </nav>
          )}
        </div>
      )}
      <header>
        <div className="masthead">
          <Link href={base} aria-label={`${club.name} home`}><Burgee colors={theme.burgee} style={theme.burgeeStyle} label="" /></Link>
          <span className="name-block">
            <Link href={base} className="name">{club.name}</Link>
            {position && <span className="pos">{club.settings.place.split(",")[0]} {position}</span>}
          </span>
          <span className="who">
            {viewer ? <Link href={`${base}/me`}>{viewer.member.firstName}</Link> : <Link href={`${base}/sign-in`}>Sign in</Link>}
          </span>
        </div>
        <div className="neatline" aria-hidden="true" />
        {theme.hoist && <FlagHoist word={club.shortName} />}
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
