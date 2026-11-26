// Exportador HTML autónomo (docs/32 §5): un único archivo con SVG y JavaScript en línea, sin dependencias
// externas ni conexión. Recibe pistas ya calculadas por @fcs/engine: aquí solo se dibuja e interpola.
import { CATALOG_VERSION, ENGINE_VERSION, canonicalHash, type Tracks } from "@fcs/engine";

export const EXPORTER_VERSION = "0.2.0";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface HtmlOptions {
  teamColor?: string; teamInk?: string; oppColor?: string;
  meta?: { team?: string; match?: string; opponent?: string };
}

export function renderTracksHtml(tracks: Tracks, opts: HtmlOptions = {}): string {
  const id = canonicalHash({ tracks, exporter: EXPORTER_VERSION }).slice(0, 12);
  const data = JSON.stringify(tracks).replace(/</g, "\\u003c");
  const team = opts.teamColor ?? "#1e5bd8", ink = opts.teamInk ?? "#ffffff", opp = opts.oppColor ?? "#6b7280";
  const steps = tracks.steps ?? [];
  const meta = [opts.meta?.team, opts.meta?.match, opts.meta?.opponent ? `contra ${opts.meta.opponent}` : ""].filter(Boolean).join(" · ");
  const stepList = steps.map((st, i) => `<li><button data-i="${i}"><b>Paso ${i + 1} de ${steps.length} — ${esc(st.title)}</b><span>${esc(st.implies)}</span></button></li>`).join("");
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(tracks.title)}</title>
<style>
:root{--bg:#f4f6f3;--surface:#fff;--text:#14201a;--muted:#5b6b62;--line:#d6ddd7;--g1:#3a7d45;--g2:#357240;--pl:#f2f5f0;--own:${team};--ink:${ink};--opp:${opp};--accent:${team};--press:#ffd54a;--cover:#7fdcff}
@media (prefers-color-scheme: dark){:root{--bg:#0f1512;--surface:#18211c;--text:#e8efe9;--muted:#9db0a5;--line:#2c3a32;--g1:#2f6b3a;--g2:#2a6034}}
*{box-sizing:border-box}html,body{margin:0}
body{background:var(--bg);color:var(--text);font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1180px;margin:0 auto;padding:16px}
.meta{color:var(--accent);font-weight:600;font-size:13px;letter-spacing:.04em;text-transform:uppercase;margin:0 0 4px}
.layout{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
@media (min-width:900px){.layout.has-steps{grid-template-columns:minmax(0,1fr) 340px;align-items:start}}
#steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
#steps button{display:flex;flex-direction:column;gap:4px;width:100%;text-align:left;border-radius:12px;padding:10px 12px;background:var(--surface)}
#steps b{font-size:14px}#steps span{color:var(--muted);font-size:13px}
#steps li[aria-current=step] button{border-color:var(--accent);box-shadow:inset 4px 0 0 var(--accent)}
.auto{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:13px}
h1{font-size:20px;margin:0 0 2px}
.sub{color:var(--muted);margin:0 0 12px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.pitchwrap{background:var(--g2)}
svg{display:block;width:100%;height:auto;max-height:78vh;touch-action:manipulation}
.controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:10px 12px;border-top:1px solid var(--line)}
.controls input[type=range]{flex:1;min-width:140px}
button,select{font:inherit;color:var(--text);background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:7px 12px;cursor:pointer}
button.primary{background:var(--accent);border-color:var(--accent);color:#fff;min-width:48px}
.markers{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 10px}
.markers button{font-size:13px;padding:4px 10px}
.note{margin:0 12px 12px;padding:10px 12px;border-radius:10px;background:color-mix(in srgb,var(--accent) 12%,transparent);min-height:20px}
.legend{display:flex;flex-wrap:wrap;gap:14px;color:var(--muted);font-size:13px;padding:10px 12px;border-top:1px solid var(--line)}
footer{color:var(--muted);font-size:12px;margin-top:10px}
</style>
</head>
<body>
<main>
${meta ? `<p class="meta">${esc(meta)}</p>` : ""}
<h1>${esc(tracks.title)}</h1>
${tracks.subtitle ? `<p class="sub">${esc(tracks.subtitle)}</p>` : '<p class="sub">Toca ▶ para reproducir. Puedes pausar y avanzar paso a paso.</p>'}
<div class="layout${steps.length ? " has-steps" : ""}">
<div class="card">
<div class="pitchwrap"><svg id="pitch" role="img" aria-label="${esc(tracks.title)}"></svg></div>
<div class="controls">
<button id="prev" aria-label="Paso anterior">◀</button>
<button class="primary" id="play" aria-label="Reproducir">▶</button>
<button id="next" aria-label="Paso siguiente">▶▶</button>
<select id="speed" aria-label="Velocidad"><option value="0.5">0,5×</option><option value="1" selected>1×</option><option value="2">2×</option></select>
<input type="range" id="scrub" min="0" max="1" step="0.001" value="0" aria-label="Tiempo">
</div>
${steps.length ? `<label class="auto" style="padding:0 12px 10px"><input type="checkbox" id="autopause" checked> Pausar en cada paso</label>` : '<div class="markers" id="markers"></div>'}
<p class="note" id="note" aria-live="polite"></p>
<div class="legend"><span id="dir"></span>${tracks.legend.map((l) => `<span>${esc(l)}</span>`).join("")}</div>
</div>
${steps.length ? `<ol id="steps" aria-label="Pasos">${stepList}</ol>` : ""}
</div>
<footer>Football Coach Studio · motor ${ENGINE_VERSION} · catálogo ${CATALOG_VERSION} · exportador ${EXPORTER_VERSION} · id ${id}</footer>
</main>
<script>
const D=${data};
const NS="http://www.w3.org/2000/svg",L=D.pitch.length_m,W=D.pitch.width_m;
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const el=(t,a,p)=>{const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e};
const svg=document.getElementById("pitch");
const x0=D.view==="HALF_ATT"?L/2-2:-3,x1=L+3;
// Capa de pantalla (recorte y fondo) y capa de campo (coordenadas en metros; se gira en vertical).
const cp=el("clipPath",{id:"vb"},el("defs",{},svg)),cr=el("rect",{},cp);
const sc=el("g",{"clip-path":"url(#vb)"},svg),bg=el("rect",{fill:css("--g2")},sc),root=el("g",{},sc);
const labels=[];
for(let i=0;i<12;i++)if(i%2===0)el("rect",{x:i*L/12,y:0,width:L/12,height:W,fill:css("--g1")},root);
const s={fill:"none",stroke:css("--pl"),"stroke-width":0.3};
const line=a=>el("path",Object.assign({d:a},s),root);
line("M0 0H"+L+"V"+W+"H0Z");line("M"+L/2+" 0V"+W);
el("circle",Object.assign({cx:L/2,cy:W/2,r:9.15},s),root);
for(const g of [0,1]){const gx=g?L:0,d=g?-1:1;
line("M"+gx+" "+(W/2-20.16)+"h"+(16.5*d)+"v40.32h"+(-16.5*d));
line("M"+gx+" "+(W/2-9.16)+"h"+(5.5*d)+"v18.32h"+(-5.5*d));
el("circle",{cx:gx+11*d,cy:W/2,r:0.3,fill:css("--pl")},root);
el("rect",{x:g?L:-1.6,y:W/2-3.66,width:1.6,height:7.32,fill:"none",stroke:css("--pl"),"stroke-width":0.35},root);}
const defs=el("defs",{},svg);
const arrow=(id,c)=>{const m=el("marker",{id,viewBox:"0 0 10 10",refX:"8",refY:"5",markerWidth:"5",markerHeight:"5",orient:"auto-start-reverse"},defs);el("path",{d:"M0,0 L10,5 L0,10 z",fill:c},m)};
arrow("ah","#fff");arrow("ahp",css("--press"));arrow("ahc",css("--cover"));
const P=p=>[p[0]*L,p[1]*W];
const gPaths=el("g",{},root),gAct=el("g",{},root);
const pathEls=[];
for(const p of D.paths){const pts=p.pts.map(P);const d="M"+pts.map(q=>q[0].toFixed(2)+" "+q[1].toFixed(2)).join(" L");
let e;
if(p.kind==="ball")e=el("path",{d,stroke:"#fff","stroke-width":0.2,fill:"none","stroke-dasharray":"0.5 0.6",opacity:0.85},gPaths);
else if(p.kind==="press")e=el("path",{d,stroke:css("--press"),"stroke-width":0.45,fill:"none","marker-end":"url(#ahp)"},gPaths);
else if(p.kind==="cover")e=el("path",{d,stroke:css("--cover"),"stroke-width":0.35,fill:"none","stroke-dasharray":"1 0.7","marker-end":"url(#ahc)"},gPaths);
else{e=el("path",{d,stroke:"#fff","stroke-width":0.3,fill:"none","stroke-dasharray":p.proposal?"1.2 0.8":"none","marker-end":p.kind==="run"?"url(#ah)":""},gPaths);
if(p.kind==="screen"){const a=pts[pts.length-2],b=pts[pts.length-1],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1,nx=-dy/l*1.2,ny=dx/l*1.2;el("line",{x1:b[0]+nx,y1:b[1]+ny,x2:b[0]-nx,y2:b[1]-ny,stroke:"#fff","stroke-width":0.6},gPaths)}}
pathEls.push({p,e});}
const nodes=D.actors.map(a=>{const g=el("g",{},gAct);
if(a.team==="OWN"){el("circle",{r:1.3,fill:css("--own"),stroke:css("--ink"),"stroke-width":0.3,"stroke-dasharray":a.proposal?"0.6 0.4":"none"},g);
const lab=el("g",{},g);labels.push(lab);const t=el("text",{"text-anchor":"middle","dominant-baseline":"central","font-size":a.label.length>2?0.95:1.25,"font-weight":700,fill:"#fff","font-family":"system-ui"},lab);t.textContent=a.label;}
else{el("rect",{x:-1.05,y:-1.05,width:2.1,height:2.1,rx:0.35,fill:css("--opp"),stroke:"#e5e7eb","stroke-width":0.15,opacity:0.92},g);
if(a.label){const lab=el("g",{},g);labels.push(lab);const t=el("text",{"text-anchor":"middle","dominant-baseline":"central","font-size":0.8,fill:"#fff","font-family":"system-ui"},lab);t.textContent=a.label;}}
el("title",{},g).textContent=a.title+(a.proposal?" (propuesta)":"");return g;});
const ball=el("circle",{r:0.55,fill:"#fff",stroke:"#111","stroke-width":0.15},root);
const scrub=document.getElementById("scrub"),noteEl=document.getElementById("note"),dur=D.t1-D.t0;
function render(t){const i=Math.max(0,Math.min(D.frames.length-1,Math.round((t-D.t0)*D.fps)));const f=D.frames[i];
nodes.forEach((g,k)=>g.setAttribute("transform","translate("+(f[2*k]*L).toFixed(2)+" "+(f[2*k+1]*W).toFixed(2)+") scale("+K+")"));
const b=f.length-3;ball.setAttribute("cx",f[b]*L);ball.setAttribute("cy",f[b+1]*W);ball.setAttribute("r",((0.55+0.35*f[b+2])*K).toFixed(2));
for(const pe of pathEls)if(pe.p.from!==undefined)pe.e.setAttribute("opacity",t>=pe.p.from?1:0.15);
const n=D.notes.filter(x=>x.t<=t+1e-6).pop();noteEl.textContent=n?n.text:"";
if(S.length){const ci=cur(t);if(ci!==CI){CI=ci;stepEls.forEach((li,k)=>{if(k===ci)li.setAttribute("aria-current","step");else li.removeAttribute("aria-current");});
const st=S[ci];if(st)noteEl.textContent=st.title+" — "+st.implies;}}
scrub.value=((t-D.t0)/dur).toFixed(3);}
// Vertical (ataque hacia arriba) en pantallas estrechas en vertical; horizontal (ataque a la derecha) en el resto.
let K=1;
function layout(){const v=innerWidth<innerHeight&&innerWidth<760;K=v?1.45:1;
const vb=v?[-3,L-x1,W+6,x1-x0]:[x0,-3,x1-x0,W+6];
svg.setAttribute("viewBox",vb.join(" "));
for(const r of [cr,bg]){r.setAttribute("x",vb[0]);r.setAttribute("y",vb[1]);r.setAttribute("width",vb[2]);r.setAttribute("height",vb[3]);}
root.setAttribute("transform",v?"matrix(0,-1,1,0,0,"+L+")":"");
for(const l of labels)l.setAttribute("transform",v?"rotate(90)":"");
document.getElementById("dir").textContent=v?"Atacamos hacia arriba ↑":"Atacamos hacia la derecha →";
document.body.dataset.orientation=v?"vertical":"horizontal";}
const S=D.steps||[];let CI=-2;const stepEls=[...document.querySelectorAll("#steps li")];
const cur=t=>{let k=-1;S.forEach((x,i)=>{if(x.t<=t+1e-6)k=i;});return k<0?0:k;};
let T=D.t0,playing=false,last=0;
layout();addEventListener("resize",()=>{layout();render(T);});
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const btn=document.getElementById("play");
const ap=document.getElementById("autopause");
const stop=()=>{playing=false;btn.textContent="▶";btn.setAttribute("aria-label","Reproducir");};
function loop(ts){if(!playing)return;const prev=T;T+=(ts-last)/1000*parseFloat(document.getElementById("speed").value);last=ts;
if(ap&&ap.checked){const hit=S.find(x=>x.t>prev+1e-6&&x.t<=T);if(hit){T=hit.t;stop();}}
if(T>D.t1){T=D.t1;stop();}render(T);if(playing)requestAnimationFrame(loop);}
const go=t=>{stop();T=t;render(T);};
document.getElementById("next").addEventListener("click",()=>{const n=S.find(x=>x.t>T+1e-3)||D.markers.find(x=>x.t>T+1e-3);go(n?n.t:D.t1);});
document.getElementById("prev").addEventListener("click",()=>{const p=[...S].reverse().find(x=>x.t<T-1e-3)||[...D.markers].reverse().find(x=>x.t<T-1e-3);go(p?p.t:D.t0);});
stepEls.forEach((li,i)=>li.querySelector("button").addEventListener("click",()=>go(S[i].t)));
btn.addEventListener("click",()=>{if(reduce){const m=D.markers.find(x=>x.t>T+1e-3);T=m?m.t:D.t0;render(T);return;}
if(T>=D.t1)T=D.t0;playing=!playing;btn.textContent=playing?"❚❚":"▶";btn.setAttribute("aria-label",playing?"Pausar":"Reproducir");if(playing){last=performance.now();requestAnimationFrame(loop);}});
scrub.addEventListener("input",()=>{playing=false;btn.textContent="▶";T=D.t0+parseFloat(scrub.value)*dur;render(T);});
const mk=document.getElementById("markers");
if(mk)D.markers.forEach(m=>{const b=document.createElement("button");b.textContent=m.label;b.addEventListener("click",()=>{playing=false;btn.textContent="▶";T=m.t;render(T);});mk.appendChild(b);});
render(T);
</script>
</body>
</html>
`;
}
