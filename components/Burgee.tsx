// A club's pennant, drawn from three theme colors. A club with its own
// artwork replaces this one file's output; nothing else changes.
export function Burgee({ colors, label }: { colors: [string, string, string]; label: string }) {
  const [field, device, stripe] = colors;
  return (
    <svg className="burgee" viewBox="0 0 60 40" role="img" aria-label={label}>
      <polygon points="1,1 59,20 1,39" fill={field} stroke="#000" strokeOpacity=".55" strokeWidth="1" strokeLinejoin="round" />
      <polygon points="1,1 9,3.6 9,36.4 1,39" fill={stripe} />
      <circle cx="24" cy="20" r="6.2" fill={device} />
    </svg>
  );
}
