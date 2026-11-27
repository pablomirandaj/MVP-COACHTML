import { useEffect, useMemo, useState } from "react";
import { ApiError, get, post, type Me } from "./lib/api";
import { useRoute } from "./lib/router";
import { Auth } from "./pages/Auth";
import { CornerWizard } from "./pages/CornerWizard";
import { Match } from "./pages/Match";
import { PlayEditor } from "./pages/PlayEditor";
import { SceneEditor } from "./pages/SceneEditor";
import { Talk } from "./pages/Talk";
import { createServerHost } from "./studio/hosts/server";
import { Studio } from "./studio/Studio";
import { TeamHome } from "./pages/TeamHome";
import { Teams } from "./pages/Teams";

export function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const route = useRoute();
  const load = () => get<Me>("/me").then(setMe).catch((e) => { if (e instanceof ApiError && e.status === 401) setMe(null); else throw e; });
  useEffect(() => { load(); }, []);
  const studioTeam = route[0] === "studio" ? route[1] : undefined;
  const studioHost = useMemo(() => (studioTeam ? createServerHost(studioTeam) : null), [studioTeam]);
  if (me === undefined) return <p className="muted center">Cargando…</p>;
  if (me === null) return <Auth onDone={load} />;

  const [a, b, c] = route;
  // Pizarra Studio ocupa toda la pantalla con su propia navegación (#/studio/<equipo>/<sección>).
  if (studioHost && studioTeam) return <Studio host={studioHost} hashPrefix={`/studio/${studioTeam}/`} />;
  let page;
  if (a === "team" && b) page = <TeamHome teamId={b} tab={c ?? "calendar"} />;
  else if (a === "match" && b && c === "talk") page = <Talk matchId={b} />;
  else if (a === "match" && b && c === "new-corner") page = <CornerWizard matchId={b} />;
  else if (a === "match" && b && c === "new-scene") page = <SceneEditor matchId={b} />;
  else if (a === "match" && b) page = <Match matchId={b} />;
  else if (a === "play" && b) page = <PlayEditor playId={b} />;
  else if (a === "scene" && b) page = <SceneEditor sceneId={b} />;
  else page = <Teams me={me} reload={load} />;

  return (
    <>
      <header className="topbar">
        <a href="#/" className="brand">Coach Studio</a>
        <span className="muted small grow">{me.display_name}</span>
        <button className="link" onClick={async () => { await post("/auth/logout"); setMe(null); location.hash = ""; }}>Salir</button>
      </header>
      {page}
    </>
  );
}
