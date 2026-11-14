// Candidate looks for a club, to try side by side before the club picks one.
// Only demo clubs offer the switch; a live club has one look, stored with it.
// Every MRBYC look is built on the club's real burgee: royal blue #253D95 and
// yellow #F8D50D, sampled from the burgee on its current website.
import type { Club } from "../db/schema";
import type { Theme } from "./theme";

const BLUE = "#253D95";
const YELLOW = "#F8D50D";
const caslon = "'Libre Caslon Text', Georgia, serif";
const atkinson = "'Atkinson Hyperlegible Next Variable', system-ui, sans-serif";

export const LOOKS: Record<string, { label: string; blurb: string; theme: Theme }[]> = {
  mrbyc: [
    {
      label: "Chart",
      blurb: "The harbor as a paper chart: buff land, shoal-blue water, magenta for what a skipper must not miss.",
      theme: {
        skin: "chart",
        colors: {
          bg: "#FBFAF4", surface: "#FFFFFF", ink: "#1B2B5E", muted: "#4D5B78", line: "#8FA7BF",
          brand: BLUE, onBrand: "#FFFFFF", accent: "#A3195B", onAccent: "#FFFFFF", wash: "#D4E6EF", wash2: "#F1E6BE",
        },
        fonts: { display: caslon, body: atkinson },
        radius: "2px",
        burgee: [YELLOW, BLUE, BLUE],
        burgeeStyle: "swoosh",
      },
    },
    {
      label: "Burgee",
      blurb: "The club's own blue and yellow, full strength, with MRBYC flown in signal flags.",
      theme: {
        skin: "burgee",
        colors: {
          bg: "#FFFFFF", surface: "#FFFFFF", ink: "#101C45", muted: "#44507A", line: "#C9D0E6",
          brand: BLUE, onBrand: "#FFFFFF", accent: BLUE, onAccent: "#FFFFFF", wash: "#FFF3B0", wash2: "#E8ECF7",
        },
        fonts: { display: "'Young Serif', Georgia, serif", body: atkinson },
        radius: "8px",
        burgee: [YELLOW, BLUE, BLUE],
        burgeeStyle: "swoosh",
        hoist: true,
      },
    },
    {
      label: "Log",
      blurb: "The week as a ship's log: ruled lines, a red margin, entries typed in, the urgent ones highlighted.",
      theme: {
        skin: "log",
        colors: {
          bg: "#FBF8EF", surface: "#FFFDF7", ink: "#1F2A44", muted: "#59617A", line: "#BFD0E0",
          brand: BLUE, onBrand: "#FFFFFF", accent: "#B3261E", onAccent: "#FFFFFF", wash: "#FBE98A", wash2: "#EEF3F8",
        },
        fonts: { display: "'Zilla Slab', Georgia, serif", body: atkinson, mono: "'Courier Prime', 'Courier New', monospace" },
        radius: "0px",
        burgee: [YELLOW, BLUE, BLUE],
        burgeeStyle: "swoosh",
      },
    },
  ],
};

export const looksFor = (club: Pick<Club, "slug" | "settings">) => (club.settings.demo ? LOOKS[club.slug] ?? [] : []);
export const lookCookie = (slug: string) => `look_${slug}`;

// The look to draw: the one picked on this phone, else the first candidate,
// else the look stored with the club.
export function effectiveTheme(club: Club, picked?: string): Theme {
  const looks = looksFor(club);
  if (looks.length === 0) return club.theme;
  return (looks.find((l) => l.label.toLowerCase() === picked) ?? looks[0]).theme;
}
