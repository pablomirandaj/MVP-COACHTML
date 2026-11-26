import { useEffect, useState } from "react";

/** Enrutador mínimo por hash: #/ruta/con/:parametros. */
export function useRoute(): string[] {
  const read = () => (location.hash.replace(/^#\/?/, "") || "").split("/").filter(Boolean).map(decodeURIComponent);
  const [parts, setParts] = useState(read);
  useEffect(() => {
    const on = () => { setParts(read()); window.scrollTo(0, 0); };
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return parts;
}

export const go = (path: string) => { location.hash = path.startsWith("#") ? path : `#${path}`; };
