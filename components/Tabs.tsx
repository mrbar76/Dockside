"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Tabs({ items }: { items: { href: string; label: string; wideOnly?: boolean }[] }) {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label="Sections">
      {items.map((it) => (
        <Link key={it.href} href={it.href} className={it.wideOnly ? "wide-only" : undefined}
          aria-current={path === it.href || path.startsWith(it.href + "/") ? "page" : undefined}>
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
