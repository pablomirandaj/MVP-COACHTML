// El reproductor de la J5 dentro de la app: la misma función que el HTML exportado (createPlayer).
import { useEffect, useRef } from "react";
import { createPlayer } from "@fcs/render";
import type { Sequence } from "@fcs/engine";

export function PlayerView({ seq, autoplay = false }: { seq: Sequence | null; autoplay?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = seq ? JSON.stringify(seq) : "";
  useEffect(() => {
    if (!ref.current || !seq) return;
    const p = createPlayer(ref.current, seq, { autoplay, arrows: true });
    return () => p.destroy();
  }, [key, autoplay]);
  if (!seq) return <p className="st-muted">Aún no hay nada que ver.</p>;
  return <div className="st-player" ref={ref} />;
}
