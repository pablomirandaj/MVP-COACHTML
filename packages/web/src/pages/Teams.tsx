import { useState } from "react";
import { post, type Me } from "../lib/api";
import { go } from "../lib/router";
import { ErrorBox, Section, useAction } from "../components/ui";

export function Teams({ me, reload }: { me: Me; reload: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Senior");
  const [season, setSeason] = useState(defaultSeason());
  const a = useAction();
  return (
    <main className="page">
      <h1>Hola, {me.display_name}</h1>
      {me.teams.length > 0 && (
        <Section title="Tus equipos">
          <ul className="list">
            {me.teams.map((t) => (
              <li key={t.id}><a href={`#/team/${t.id}`}><b>{t.name}</b> <span className="muted">· {t.category} · {t.season}</span></a></li>
            ))}
          </ul>
        </Section>
      )}
      <Section title={me.teams.length ? "Nuevo equipo" : "Crea tu equipo"}>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); a.run(async () => {
          const t = await post<{ id: string }>("/teams", { name, category, season_label: season });
          reload(); go(`/team/${t.id}/roster`);
        }); }}>
          <label>Nombre<input aria-label="Nombre" value={name} onChange={(e) => setName(e.target.value)} required placeholder="CD Ejemplo" /></label>
          <div className="grid2">
            <label>Categoría<input aria-label="Categoría" value={category} onChange={(e) => setCategory(e.target.value)} required /></label>
            <label>Temporada<input aria-label="Temporada" value={season} onChange={(e) => setSeason(e.target.value)} pattern="\d{4}/\d{2}" required /></label>
          </div>
          <ErrorBox error={a.error} />
          <button className="primary" disabled={a.busy}>Crear equipo</button>
        </form>
      </Section>
    </main>
  );
}

function defaultSeason() {
  const d = new Date(), y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}/${String((y + 1) % 100).padStart(2, "0")}`;
}
