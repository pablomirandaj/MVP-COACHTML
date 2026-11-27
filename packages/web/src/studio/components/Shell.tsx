import type { ReactElement, ReactNode } from "react";
import { useStudio, type Route } from "../lib/context";
import { Icon } from "./Icons";

const NAV: { r: Route; label: string; icon: () => ReactElement }[] = [
  { r: "home", label: "Inicio", icon: Icon.home }, { r: "board", label: "Pizarra", icon: Icon.board },
  { r: "setpieces", label: "Balón parado", icon: Icon.setpiece }, { r: "plans", label: "Planes", icon: Icon.plans },
  { r: "library", label: "Biblioteca", icon: Icon.library }, { r: "roster", label: "Plantilla", icon: Icon.roster },
];

export function Shell({ children }: { children: ReactNode }) {
  const { route, go, host } = useStudio();
  const team = host.team.team();
  return (
    <div className="st-app">
      <nav className="st-nav" aria-label="Secciones">
        <div className="st-brand"><span className="st-crest">P</span><span>{team.short}</span></div>
        {NAV.map((n) => (
          <a key={n.r} href={`#${n.r}`} aria-current={route === n.r ? "page" : undefined} onClick={(e) => { e.preventDefault(); go(n.r); }}>
            <n.icon /><span>{n.label}</span>
          </a>
        ))}
      </nav>
      <main className="st-main">{children}</main>
    </div>
  );
}
