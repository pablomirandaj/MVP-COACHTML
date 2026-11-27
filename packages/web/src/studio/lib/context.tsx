// Estado compartido de Pizarra Studio: anfitrión, plantilla, sección actual y pieza abierta.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Player } from "@fcs/engine";
import type { Fixture, Host, StudioItem, StudioKind } from "../ports";

export type Route = "home" | "board" | "setpieces" | "plans" | "library" | "roster";
export const ROUTES: Route[] = ["home", "board", "setpieces", "plans", "library", "roster"];
/** El hash es "#seccion" en la página de Claude y "#/studio/<equipo>/seccion" en la web con servidor. */
const fromHash = (prefix: string): Route => {
  const h = location.hash.replace(/^#/, "");
  const rest = h.startsWith(prefix) ? h.slice(prefix.length) : h.replace(/^\//, "");
  return (ROUTES as string[]).includes(rest) ? (rest as Route) : "home";
};

export interface Open { kind: StudioKind; item?: StudioItem; preset?: Record<string, unknown>; nonce: number }
interface Ctx {
  hashPrefix: string;
  host: Host; route: Route; go: (r: Route, open?: Omit<Open, "nonce">) => void; open: Open | null;
  roster: Player[]; setRoster: (p: Player[]) => void; rosterReady: boolean;
  next: Fixture | undefined; opponent: string | undefined; libraryVersion: number; bumpLibrary: () => void;
}
const StudioCtx = createContext<Ctx | null>(null);
export const useStudio = () => { const c = useContext(StudioCtx); if (!c) throw new Error("Fuera de Pizarra Studio"); return c; };

export function StudioProvider({ host, children, hashPrefix = "" }: { host: Host; children: ReactNode; hashPrefix?: string }) {
  const [route, setRoute] = useState<Route>(() => fromHash(hashPrefix));
  const [open, setOpen] = useState<Open | null>(null);
  const [roster, setRoster] = useState<Player[]>([]);
  const [rosterReady, setReady] = useState(false);
  const [libraryVersion, setLib] = useState(0);
  useEffect(() => { const on = () => setRoute(fromHash(hashPrefix)); addEventListener("hashchange", on); return () => removeEventListener("hashchange", on); }, [hashPrefix]);
  useEffect(() => { host.team.roster().then((r) => { setRoster(r); setReady(true); }).catch(() => setReady(true)); }, [host]);
  const next = useMemo(() => host.team.fixtures().filter((f) => !f.resultado).sort((a, b) => a.jornada - b.jornada)[0], [host]);
  const go = useCallback((r: Route, o?: Omit<Open, "nonce">) => {
    if (o) setOpen({ ...o, nonce: Date.now() });
    if (location.hash !== `#${hashPrefix}${r}`) location.hash = `${hashPrefix}${r}`;
    setRoute(r);
    window.scrollTo?.({ top: 0 });
  }, []);
  const value: Ctx = { host, route, go, hashPrefix, open, roster, setRoster, rosterReady, next, opponent: next?.rival, libraryVersion, bumpLibrary: () => setLib((v) => v + 1) };
  return <StudioCtx.Provider value={value}>{children}</StudioCtx.Provider>;
}
