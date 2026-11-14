// Plain text an officer typed, shown as paragraphs and lists. Blank lines
// start a new paragraph; lines starting with "- " become a list; web and
// email addresses become links. No HTML is ever passed through.
import type { ReactNode } from "react";

function linkify(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(https?:\/\/[^\s)]+|[^\s@()]+@[^\s@()]+\.[a-z]{2,})/gi;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const v = m[0];
    out.push(<a key={i++} href={v.includes("@") && !v.startsWith("http") ? `mailto:${v}` : v}>{v}</a>);
    last = m.index + v.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Prose({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="prose stack">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => l.startsWith("- ")))
          return <ul key={i} className="bullets">{lines.map((l, j) => <li key={j}>{linkify(l.slice(2))}</li>)}</ul>;
        return <p key={i}>{lines.flatMap((l, j) => (j ? [<br key={`b${j}`} />, ...linkify(l)] : linkify(l)))}</p>;
      })}
    </div>
  );
}
