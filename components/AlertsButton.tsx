"use client";
import { useState } from "react";

const toKey = (b64: string) => {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

// Turns on alerts for this phone. On iPhone this only works after the club
// page has been added to the Home Screen and opened from that icon.
export function AlertsButton({ slug, publicKey }: { slug: string; publicKey: string | null }) {
  const [state, setState] = useState<"idle" | "working" | "on" | "blocked" | "unsupported" | "error">("idle");
  if (!publicKey) return <p className="muted small">Alerts are not switched on for this club yet.</p>;
  async function enable() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setState("unsupported");
    setState("working");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      if ((await Notification.requestPermission()) !== "granted") return setState("blocked");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey!) });
      const res = await fetch(`/${slug}/alerts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub) });
      setState(res.ok ? "on" : "error");
    } catch {
      setState("error");
    }
  }
  return (
    <div className="stack">
      <button type="button" className="btn quiet" onClick={enable} disabled={state === "working" || state === "on"}>
        {state === "on" ? "Alerts are on for this phone" : "Turn on alerts for this phone"}
      </button>
      {state === "blocked" && <p className="small">Alerts are blocked in this phone&apos;s settings. Allow notifications for this page, then try again.</p>}
      {state === "unsupported" && <p className="small">On iPhone, add this page to your Home Screen first, open it from the new icon, then turn alerts on.</p>}
      {state === "error" && <p className="small">That did not work. Check your connection and try again.</p>}
    </div>
  );
}
