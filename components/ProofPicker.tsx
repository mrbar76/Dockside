"use client";
// Phone photos of a utility bill are often 3 to 6 MB. Shrink pictures in the
// browser before they upload, so the form stays under the size limit on one
// bar of signal. PDFs pass through untouched.
import { useRef, useState } from "react";

const MAX_SIDE = 1800;

async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 900_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.82));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export function ProofPicker({ count }: { count: number }) {
  const ref = useRef<HTMLInputElement>(null);
  const [names, setNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  return (
    <label className="field">
      <span>Proofs of residency ({count})</span>
      <input
        ref={ref} name="proofs" type="file" multiple accept="image/*,application/pdf"
        onChange={async (e) => {
          const picked = [...(e.currentTarget.files ?? [])].slice(0, 4);
          setBusy(true);
          const out = await Promise.all(picked.map(shrink));
          const dt = new DataTransfer();
          out.forEach((f) => dt.items.add(f));
          if (ref.current) ref.current.files = dt.files;
          setNames(out.map((f) => `${f.name} (${Math.max(1, Math.round(f.size / 1024))} KB)`));
          setBusy(false);
        }}
      />
      <small>
        {busy ? "Getting your pictures ready…" : names.length ? names.join(", ") : `Photos or PDFs, for example a utility bill and a driver's license. Pick ${count} at once.`}
        {" "}Only the Membership Committee sees them, and they are deleted once your application is decided.
      </small>
    </label>
  );
}
