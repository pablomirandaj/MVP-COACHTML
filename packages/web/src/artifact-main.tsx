// Entrada de la página de Claude: el anfitrión usa las capacidades de la página (db, sample, downloads).
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createArtifactHost } from "./studio/hosts/artifact";
import { Studio } from "./studio/Studio";

createArtifactHost().then((host) => {
  createRoot(document.getElementById("root")!).render(<StrictMode><Studio host={host} /></StrictMode>);
});
