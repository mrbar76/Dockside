// A club's burgee, drawn from three theme colors. "swoosh" is MRBYC's own mark:
// a yellow pennant with a blue band sweeping from the hoist to the fly.
export function Burgee({ colors, label, style = "pennant" }: { colors: [string, string, string]; label: string; style?: "pennant" | "swoosh" }) {
  const [field, device, stripe] = colors;
  if (style === "swoosh")
    return (
      <svg className="burgee" viewBox="0 0 64 40" {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true, focusable: "false" })}>
        <path d="M3 3 L61 22 L3 37 Z" fill={field} stroke={device} strokeWidth="2.6" strokeLinejoin="round" />
        <path d="M3 21 C 18 15, 30 10, 61 22 C 40 19, 22 23, 3 29 Z" fill={device} />
        <line x1="3" y1="1" x2="3" y2="40" stroke={stripe} strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg className="burgee" viewBox="0 0 60 40" {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true, focusable: "false" })}>
      <polygon points="1,1 59,20 1,39" fill={field} stroke="#000" strokeOpacity=".55" strokeWidth="1" strokeLinejoin="round" />
      <polygon points="1,1 9,3.6 9,36.4 1,39" fill={stripe} />
      <circle cx="24" cy="20" r="6.2" fill={device} />
    </svg>
  );
}
