// Carpeta del partido (formato de la J5): cabecera con escudo y foto, pestañas por jugada, el reproductor por pasos,
// la ficha de cada jugada (quién hace qué, el hueco, la clave, si sale mal) y las reglas que no cambian nunca.
// Un único archivo autónomo; el reproductor se incrusta con playerSource() (misma implementación que la app).
import type { Sequence, Sheet } from "@fcs/engine";
import { playerSource } from "./player/player";

export interface DossierPlay { label: string; eyebrow: string; seq: Sequence; sheet: Sheet }
export interface Dossier {
  club: string; category: string; match?: string; opponent?: string; title: string; kicker?: string;
  crest?: string; hero?: string; rules: string[]; plays: DossierPlay[];
}

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const safeImg = (s?: string) => (s && /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(s) ? s : "");

const CSS = `:root{--negro:#070B08;--carbon:#0F1712;--verde:#0E7A32;--flare:#35D45F;--oro:#D9A526;--hueso:#E8F1EA;--gris:#8FA396;--rojo:#D6263B;--pad:16px}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}html{-webkit-text-size-adjust:100%}
body{background:var(--negro);color:var(--hueso);font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.5;min-height:100vh}
.wrap{max-width:520px;margin:0 auto;padding-bottom:56px}
.hero{position:relative;padding:16px var(--pad) 14px;background-size:cover;background-position:50% 28%;border-bottom:1px solid rgba(217,165,38,.35)}
.crest{display:flex;align-items:center;gap:12px}.crest img{width:46px;height:auto;filter:drop-shadow(0 2px 6px rgba(0,0,0,.6))}
.club{font-family:Oswald,Inter,sans-serif;font-weight:600;font-size:12px;letter-spacing:.22em;color:var(--oro);text-transform:uppercase}
.cat{font-size:10.5px;letter-spacing:.1em;color:var(--gris);text-transform:uppercase}
.match{display:inline-flex;align-items:center;gap:8px;margin-top:14px;font-family:Oswald,Inter,sans-serif;font-weight:600;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#fff;background:rgba(14,122,50,.55);border:1px solid var(--flare);border-radius:3px;padding:5px 10px}
.match b{color:var(--oro);font-weight:600}
h1{font-family:Oswald,Inter,sans-serif;font-weight:700;font-size:clamp(26px,7.6vw,36px);line-height:.94;letter-spacing:-.01em;text-transform:uppercase;margin-top:10px}h1 em{font-style:normal;color:var(--flare)}
.kicker{margin-top:7px;font-size:13px;color:#C3D2C7;max-width:40ch}
.tabs{display:flex;gap:6px;padding:12px var(--pad) 0;overflow-x:auto;scrollbar-width:none}.tabs::-webkit-scrollbar{display:none}
.fcsd-tab{flex:0 0 auto;border:1px solid rgba(143,163,150,.32);background:transparent;color:var(--gris);font-family:Oswald,Inter,sans-serif;font-weight:600;font-size:12px;letter-spacing:.1em;text-transform:uppercase;padding:9px 13px;border-radius:3px;cursor:pointer}
.fcsd-tab[aria-selected="true"]{background:var(--verde);border-color:var(--flare);color:#fff}.fcsd-tab:focus-visible{outline:2px solid var(--oro);outline-offset:2px}
.stage{padding:14px var(--pad) 0}
.legend{display:flex;flex-wrap:wrap;gap:12px;padding:14px var(--pad) 0;font-size:11.5px;color:var(--gris)}
.legend i{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:5px;vertical-align:-1px}.legend .bar{width:18px;height:0;border-radius:0;vertical-align:3px}
.panel{padding:22px var(--pad) 0}.eyebrow{font-family:Oswald,Inter,sans-serif;font-size:11.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--oro)}
h2{font-family:Oswald,Inter,sans-serif;font-weight:700;font-size:23px;text-transform:uppercase;margin-top:3px;line-height:1.05}
h2 span{display:block;font-size:14px;font-weight:400;color:var(--gris);letter-spacing:.04em;text-transform:none;margin-top:3px}
.assign{margin-top:14px;border-top:1px solid rgba(143,163,150,.22)}.assign .row{display:flex;gap:10px;padding:9px 0;border-bottom:1px solid rgba(143,163,150,.13)}
.assign .who{flex:0 0 28%;font-family:Oswald,Inter,sans-serif;font-size:12.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--flare);line-height:1.3;overflow-wrap:anywhere}
.assign .what{flex:1;font-size:13.5px;color:#D2DFD5;min-width:0}
.notes{margin-top:16px;display:grid;gap:9px}.note{border-left:3px solid var(--verde);background:#0D140F;padding:10px 12px;border-radius:0 4px 4px 0}
.note.free{border-left-color:var(--rojo)}.note.risk{border-left-color:var(--oro)}
.note b{font-family:Oswald,Inter,sans-serif;font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--gris);display:block;margin-bottom:2px}
.note.free b{color:#F09AA6}.note.risk b{color:#F0CE72}.note span{font-size:13.5px;color:#D8E4DB}
.fixed{margin:26px var(--pad) 0;border:1px solid rgba(217,165,38,.35);border-radius:6px;padding:15px 14px;background:#100D05}
.fixed h3{font-family:Oswald,Inter,sans-serif;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--oro);margin-bottom:9px}
.fixed ul{list-style:none;display:grid;gap:7px}.fixed li{font-size:13.5px;color:#E0E9E2;padding-left:16px;position:relative}
.fixed li::before{content:"";position:absolute;left:0;top:8px;width:6px;height:6px;background:var(--oro);border-radius:1px;transform:rotate(45deg)}
.foot{margin-top:30px;padding:16px var(--pad) 0;border-top:1px solid rgba(143,163,150,.18);font-size:11.5px;color:#6E8175;letter-spacing:.04em}`;

export function renderDossierHtml(d: Dossier): string {
  const plays = d.plays.filter((p) => p.seq.frames.length > 0);
  const hero = safeImg(d.hero), crest = safeImg(d.crest);
  const words = d.title.trim().split(/\s+/);
  const h1 = words.length > 1 ? `${esc(words.slice(0, -1).join(" "))}<br><em>${esc(words[words.length - 1])}</em>` : `<em>${esc(d.title)}</em>`;
  const kicker = d.kicker ?? `${plays.length} jugada${plays.length === 1 ? "" : "s"}. Quédate con tu <b>número</b>, con lo que haces y con el momento: el «AHORA» manda.`;
  const tabs = plays.length > 1 ? `<div class="tabs" role="tablist">${plays.map((p, i) => `<button type="button" class="fcsd-tab" role="tab" data-i="${i}" aria-selected="${i === 0}">${esc(p.label)}</button>`).join("")}</div>` : "";
  const panels = plays.map((p, i) => `<section class="panel fcsd-panel" data-i="${i}"${i ? " hidden" : ""}>
<div class="eyebrow">${esc(p.eyebrow)}</div><h2>${esc(p.label)}<span>${esc(p.sheet.subtitle)}</span></h2>
${p.sheet.table.length ? `<div class="assign">${p.sheet.table.map(([w, t]) => `<div class="row"><div class="who">${esc(w)}</div><div class="what">${esc(t)}</div></div>`).join("")}</div>` : ""}
<div class="notes"><div class="note free"><b>El hueco que atacamos</b><span>${esc(p.sheet.hueco)}</span></div><div class="note"><b>La clave</b><span>${esc(p.sheet.clave)}</span></div><div class="note risk"><b>Si sale mal</b><span>${esc(p.sheet.riesgo)}</span></div></div>
</section>`).join("\n");
  const data = JSON.stringify(plays.map((p) => p.seq)).replace(/</g, "\\u003c");
  const matchLine = [d.match, d.opponent ? `vs ${d.opponent}` : ""].filter(Boolean);
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(d.title)}${d.match ? ` · ${esc(d.match)}` : ""}${d.opponent ? ` vs ${esc(d.opponent)}` : ""}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Inter:wght@400;500;700&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body><div class="wrap">
<header class="hero"${hero ? ` style="background-image:linear-gradient(180deg,rgba(7,11,8,.30) 0%,rgba(7,11,8,.72) 62%,#070B08 100%),url('${hero}')"` : ""}>
<div class="crest">${crest ? `<img src="${crest}" alt="Escudo ${esc(d.club)}">` : ""}<div><div class="club">${esc(d.club)}</div><div class="cat">${esc(d.category)}</div></div></div>
${matchLine.length ? `<div class="match">${matchLine.map(esc).join(" <b>·</b> ")}</div>` : ""}
<h1>${h1}</h1><p class="kicker">${kicker}</p></header>
${tabs}
<div class="stage"><div id="fcsd-player"></div></div>
<div class="legend"><span><i style="background:#0E7A32;border:1px solid #35D45F"></i>Nosotros</span><span><i style="background:#2A0A10;border:1px solid #D6263B"></i>Ellos</span><span><i style="background:#F7D66B"></i>Balón</span><span><i class="bar" style="border-top:2px dashed #fff"></i>Desmarque</span><span><i class="bar" style="border-top:2px solid #35D45F"></i>Bloqueo</span><span><i class="bar" style="border-top:2px solid #D9A526"></i>Pase</span></div>
${panels}
${d.rules.length ? `<div class="fixed"><h3>Esto no cambia nunca</h3><ul>${d.rules.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></div>` : ""}
<p class="foot">${[d.club, "Cuerpo técnico", ...matchLine].map(esc).join(" · ")}</p>
</div>
<script>
(function(){"use strict";
var SEQS=${data};
var createPlayer=${playerSource()};
var root=document.getElementById("fcsd-player"),player=null;
function show(i){if(player)player.destroy();player=createPlayer(root,SEQS[i],{autoplay:true});
document.querySelectorAll(".fcsd-tab").forEach(function(b,j){b.setAttribute("aria-selected",String(j===i));});
document.querySelectorAll(".fcsd-panel").forEach(function(p,j){p.hidden=j!==i;});}
document.querySelectorAll(".fcsd-tab").forEach(function(b){b.addEventListener("click",function(){show(Number(b.getAttribute("data-i")));});});
if(SEQS.length)show(0);
})();
</script></body></html>`;
}
