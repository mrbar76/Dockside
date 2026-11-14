import type { Metadata } from "next";
import "@fontsource/libre-caslon-text/400.css";
import "@fontsource/libre-caslon-text/400-italic.css";
import "@fontsource-variable/atkinson-hyperlegible-next/wght.css";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource/young-serif/400.css";
import "@fontsource/zilla-slab/500.css";
import "@fontsource/zilla-slab/700.css";
import "@fontsource/courier-prime/400.css";
import "@fontsource/courier-prime/700.css";
import "./globals.css";
import "./skins.css";

export const metadata: Metadata = { title: "Dockside", description: "One shared core for member-run boat clubs." };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
