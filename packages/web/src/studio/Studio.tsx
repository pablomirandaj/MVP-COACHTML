// Pizarra Studio: la misma interfaz para la página de Claude y para la web con servidor; solo cambia el anfitrión.
import { Shell } from "./components/Shell";
import { StudioProvider, useStudio } from "./lib/context";
import { Board } from "./pages/Board";
import { Home } from "./pages/Home";
import { Library } from "./pages/Library";
import { Plans } from "./pages/Plans";
import { Roster } from "./pages/Roster";
import { SetPieces } from "./pages/SetPieces";
import type { Host } from "./ports";
import "./theme.css";

function Router() {
  const { route } = useStudio();
  switch (route) {
    case "board": return <Board />;
    case "setpieces": return <SetPieces />;
    case "plans": return <Plans />;
    case "library": return <Library />;
    case "roster": return <Roster />;
    default: return <Home />;
  }
}

export function Studio({ host }: { host: Host }) {
  return <StudioProvider host={host}><Shell><Router /></Shell></StudioProvider>;
}
