// A club's look lives in data, not code. Three levels of difference:
//   1. tokens  - colors, type, corner radius (this file)
//   2. skin    - a named layout treatment in app/skins.css
//   3. custom  - a separate front end reading /api/v1 (same core underneath)
import type { CSSProperties } from "react";

export type Skin = "chart" | "signal" | "burgee" | "log";

export type Theme = {
  skin: Skin;
  colors: {
    bg: string; surface: string; ink: string; muted: string; line: string;
    brand: string; onBrand: string; accent: string; onAccent: string; wash: string; wash2: string;
  };
  fonts: { display: string; body: string; mono?: string };
  radius: string;
  burgee: [string, string, string]; // field, device, hoist stripe
  burgeeStyle?: "pennant" | "swoosh"; // swoosh: the club's own mark, a band sweeping to the fly
  hoist?: boolean; // string the club's initials in code flags under the masthead
};

export type ClubSettings = {
  place: string;
  noaaStation?: string;
  contactEmail?: string;
  demo?: boolean;
};

export function themeVars(t: Theme): CSSProperties {
  return {
    "--bg": t.colors.bg, "--surface": t.colors.surface, "--ink": t.colors.ink, "--muted": t.colors.muted,
    "--line": t.colors.line, "--brand": t.colors.brand, "--on-brand": t.colors.onBrand,
    "--accent": t.colors.accent, "--on-accent": t.colors.onAccent, "--wash": t.colors.wash, "--wash2": t.colors.wash2,
    "--font-display": t.fonts.display, "--font-body": t.fonts.body, "--font-mono": t.fonts.mono ?? "ui-monospace, monospace", "--radius": t.radius,
  } as CSSProperties;
}
