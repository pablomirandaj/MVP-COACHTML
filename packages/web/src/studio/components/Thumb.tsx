// Miniatura de una pieza: el último fotograma dibujado con el mismo renderizador que el HTML exportado.
import { useMemo } from "react";
import { tracksFrameSvg } from "@fcs/render";
import type { Tracks } from "@fcs/engine";

export function Thumb({ tracks }: { tracks: Tracks | null }) {
  const svg = useMemo(() => { try { return tracks ? tracksFrameSvg(tracks, tracks.t1, { paths: true }) : ""; } catch { return ""; } }, [tracks]);
  return <div className="thumb" role="img" aria-label={tracks?.title ?? "Sin vista previa"} dangerouslySetInnerHTML={{ __html: svg }} />;
}
