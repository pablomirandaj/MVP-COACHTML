// SVG estático (sin JavaScript) para la charla en PDF y las miniaturas (docs/20 §5).
import type { Pt, Tracks } from "@fcs/engine";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const C = { g1: "#3a7d45", g2: "#357240", pl: "#f2f5f0", own: "#1e5bd8", opp: "#6b7280", press: "#ffd54a", cover: "#7fdcff" };

function pitchSvg(L: number, W: number, x0: number, x1: number): string {
  const s = `fill="none" stroke="${C.pl}" stroke-width="0.3"`;
  let out = `<rect x="${x0}" y="-3" width="${x1 - x0}" height="${W + 6}" fill="${C.g2}"/>`;
  for (let i = 0; i < 12; i += 2) out += `<rect x="${(i * L) / 12}" y="0" width="${L / 12}" height="${W}" fill="${C.g1}"/>`;
  out += `<path d="M0 0H${L}V${W}H0Z" ${s}/><path d="M${L / 2} 0V${W}" ${s}/><circle cx="${L / 2}" cy="${W / 2}" r="9.15" ${s}/>`;
  for (const g of [0, 1]) {
    const gx = g ? L : 0, d = g ? -1 : 1;
    out += `<path d="M${gx} ${W / 2 - 20.16}h${16.5 * d}v40.32h${-16.5 * d}" ${s}/><path d="M${gx} ${W / 2 - 9.16}h${5.5 * d}v18.32h${-5.5 * d}" ${s}/>`;
    out += `<rect x="${g ? L : -1.6}" y="${W / 2 - 3.66}" width="1.6" height="7.32" ${s}/>`;
  }
  return out;
}

const defs = `<defs><marker id="sa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#fff"/></marker>
<marker id="sp" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.press}"/></marker></defs>`;

function actorSvg(x: number, y: number, team: "OWN" | "OPP", label: string, proposal: boolean): string {
  if (team === "OWN")
    return `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)})"><circle r="1.4" fill="${C.own}" stroke="#fff" stroke-width="0.25"${proposal ? ' stroke-dasharray="0.6 0.4"' : ""}/>` +
      `<text text-anchor="middle" dominant-baseline="central" font-size="${label.length > 2 ? 1 : 1.3}" font-weight="700" fill="#fff" font-family="sans-serif">${esc(label)}</text></g>`;
  return `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)})"><rect x="-1.1" y="-1.1" width="2.2" height="2.2" rx="0.35" fill="${C.opp}" stroke="#e5e7eb" stroke-width="0.15"/>` +
    (label ? `<text text-anchor="middle" dominant-baseline="central" font-size="0.8" fill="#fff" font-family="sans-serif">${esc(label)}</text>` : "") + `</g>`;
}

/** Un fotograma de unas pistas (jugada o escena) como SVG estático con sus flechas. */
export function tracksFrameSvg(tracks: Tracks, t: number, opts: { paths?: boolean } = {}): string {
  const L = tracks.pitch.length_m, W = tracks.pitch.width_m;
  const x0 = tracks.view === "HALF_ATT" ? L / 2 - 2 : -3, x1 = L + 3;
  const i = Math.max(0, Math.min(tracks.frames.length - 1, Math.round((t - tracks.t0) * tracks.fps)));
  const f = tracks.frames[i];
  let body = pitchSvg(L, W, x0, x1);
  if (opts.paths !== false) for (const p of tracks.paths) {
    if (p.from !== undefined && t < p.from) continue;
    const d = "M" + p.pts.map((q) => `${(q[0] * L).toFixed(2)} ${(q[1] * W).toFixed(2)}`).join(" L");
    if (p.kind === "ball") body += `<path d="${d}" stroke="#fff" stroke-width="0.2" fill="none" stroke-dasharray="0.5 0.6"/>`;
    else if (p.kind === "press") body += `<path d="${d}" stroke="${C.press}" stroke-width="0.45" fill="none" marker-end="url(#sp)"/>`;
    else if (p.kind === "cover") body += `<path d="${d}" stroke="${C.cover}" stroke-width="0.35" fill="none" stroke-dasharray="1 0.7"/>`;
    else body += `<path d="${d}" stroke="#fff" stroke-width="0.3" fill="none"${p.proposal ? ' stroke-dasharray="1.2 0.8"' : ""}${p.kind === "run" ? ' marker-end="url(#sa)"' : ""}/>`;
  }
  tracks.actors.forEach((a, k) => { body += actorSvg(f[2 * k] * L, f[2 * k + 1] * W, a.team, a.label, a.proposal); });
  const b = f.length - 3;
  body += `<circle cx="${(f[b] * L).toFixed(2)}" cy="${(f[b + 1] * W).toFixed(2)}" r="0.6" fill="#fff" stroke="#111" stroke-width="0.15"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} -3 ${x1 - x0} ${W + 6}" role="img" aria-label="${esc(tracks.title)}">${defs}${body}</svg>`;
}

/** Alineación en campo completo (ataque a la derecha) con dorsal y nombre bajo cada jugador. */
export function lineupSvg(positions: Record<string, Pt>, players: Record<string, { label: string; name: string } | undefined>, pitch = { length_m: 105, width_m: 68 }): string {
  const L = pitch.length_m, W = pitch.width_m;
  let body = pitchSvg(L, W, -3, L + 3);
  for (const [slot, p] of Object.entries(positions)) {
    const pl = players[slot];
    const x = p.u * L, y = p.v * W;
    body += actorSvg(x, y, "OWN", pl?.label ?? "", !pl);
    if (pl) body += `<text x="${x.toFixed(2)}" y="${(y + 3).toFixed(2)}" text-anchor="middle" font-size="1.7" fill="#fff" font-family="sans-serif" font-weight="600">${esc(pl.name)}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 ${L + 6} ${W + 6}" role="img" aria-label="Alineación">${body}</svg>`;
}
