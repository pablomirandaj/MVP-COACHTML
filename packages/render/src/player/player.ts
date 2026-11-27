// Reproductor por pasos «como la J5». UNA sola implementación para la app y para el HTML exportado: el exportador
// incrusta `createPlayer.toString()`, así que esta función no puede usar NADA de fuera de su cuerpo (ni imports,
// ni ayudantes, ni constantes del módulo). Recibe una secuencia fcs.seq/1 (coordenadas en metros).
/* eslint-disable */
export function createPlayer(root: HTMLElement, seq: any, opts?: any): any {
  "use strict";
  var o = opts || {};
  var doc = root.ownerDocument || document;
  var win: any = doc.defaultView || window;
  var NS = "http://www.w3.org/2000/svg";
  var CSS = ".fcsp{--n:#070B08;--c:#0F1712;--v:#0E7A32;--f:#35D45F;--o:#D9A526;--h:#E8F1EA;--g:#8FA396;--r:#D6263B;color:var(--h);font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;max-width:100%}"
    + ".fcsp *{box-sizing:border-box}"
    + ".fcsp-board{position:relative;border:1px solid rgba(143,163,150,.22);border-radius:6px 6px 0 0;overflow:hidden;background:#0B1A0F}"
    + ".fcsp-pitch{display:block;width:100%;height:auto;max-height:72vh;margin:0 auto;touch-action:manipulation}"
    + ".fcsp-pl,.fcsp-rv,.fcsp-ball{transition:transform .62s cubic-bezier(.42,.02,.28,1)}"
    + ".fcsp.slow .fcsp-pl,.fcsp.slow .fcsp-rv,.fcsp.slow .fcsp-ball{transition-duration:1.05s}"
    + ".fcsp.instant .fcsp-pl,.fcsp.instant .fcsp-rv,.fcsp.instant .fcsp-ball{transition:none}"
    + ".fcsp-pl circle{fill:#0E7A32;stroke:#35D45F;stroke-width:.28}.fcsp-pl.back circle{fill:#123A1E;stroke:#8FA396}.fcsp-pl.key circle{stroke:#D9A526;stroke-width:.5}"
    + ".fcsp-pl text{fill:#fff;font-family:Oswald,Inter,sans-serif;font-weight:600;text-anchor:middle;dominant-baseline:central}"
    + ".fcsp-rv circle{fill:#2A0A10;stroke:#D6263B;stroke-width:.26}.fcsp-rv.key circle{stroke:#D9A526;stroke-width:.45}.fcsp-rv text{fill:#FFD3D8;font-family:Oswald,Inter,sans-serif;text-anchor:middle;dominant-baseline:central}"
    + ".fcsp-ln{fill:none;opacity:0;animation:fcspIn .35s ease forwards}.fcsp-ln.run{stroke:#fff;stroke-width:.36;stroke-dasharray:1.1 .85}.fcsp-ln.pass{stroke:#D9A526;stroke-width:.42}"
    + ".fcsp-ln.blk{stroke:#35D45F;stroke-width:.48;stroke-linecap:round}.fcsp-ln.old{animation:none;opacity:.16}@keyframes fcspIn{to{opacity:.95}}"
    + ".fcsp-status{border:1px solid rgba(143,163,150,.22);border-top:none;background:var(--c);padding:12px 14px;min-height:92px;border-radius:0 0 6px 6px}"
    + ".fcsp-beat{font-family:Oswald,Inter,sans-serif;font-weight:700;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--g);display:flex;align-items:center;gap:9px;flex-wrap:wrap}"
    + ".fcsp-now{display:none;background:var(--o);color:#1A1200;padding:2px 8px;border-radius:2px;font-size:11px;letter-spacing:.16em}"
    + ".fcsp-status.trig{border-color:rgba(217,165,38,.6);background:#171208}.fcsp-status.trig .fcsp-beat{color:var(--o)}.fcsp-status.trig .fcsp-now{display:inline-block;animation:fcspPulse 1.1s ease-in-out infinite}"
    + "@keyframes fcspPulse{0%,100%{opacity:1}50%{opacity:.45}}.fcsp-txt{margin:7px 0 0;font-size:14.5px;line-height:1.5;color:#D8E4DB}"
    + ".fcsp-dots{display:flex;gap:5px;padding:10px 0 0}.fcsp-dots i{flex:1;height:4px;background:rgba(143,163,150,.25);border-radius:2px;cursor:pointer}.fcsp-dots i.on{background:var(--f)}.fcsp-dots i.on.trig{background:var(--o)}.fcsp-dots i.done{background:rgba(53,212,95,.45)}"
    + ".fcsp-ctrl{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 0 0}"
    + ".fcsp-ctrl button{background:#121C16;border:1px solid rgba(143,163,150,.3);color:var(--h);border-radius:4px;padding:10px 12px;font-size:15px;cursor:pointer;line-height:1;min-width:44px;min-height:42px;font-family:inherit}"
    + ".fcsp-ctrl button:hover{border-color:var(--f)}.fcsp-ctrl button:focus-visible,.fcsp-dots i:focus-visible{outline:2px solid var(--o);outline-offset:2px}"
    + ".fcsp-ctrl .fcsp-play{background:var(--v);border-color:var(--f);font-weight:700;flex:1;font-family:Oswald,Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;font-size:13px}"
    + ".fcsp-ctrl .fcsp-arrows[aria-pressed=false]{color:var(--g)}"
    + "@media (prefers-reduced-motion:reduce){.fcsp-pl,.fcsp-rv,.fcsp-ball{transition-duration:.01ms!important}.fcsp-ln{animation:none;opacity:.95}.fcsp-status.trig .fcsp-now{animation:none}}";
  if (!doc.getElementById("fcsp-style")) { var st = doc.createElement("style"); st.id = "fcsp-style"; st.textContent = CSS; doc.head.appendChild(st); }
  win.__fcspN = (win.__fcspN || 0) + 1;
  var uid = "fcsp" + win.__fcspN;
  var L = seq.pitch.length_m, W = seq.pitch.width_m;
  var frame = 0, timer: any = null, speed = o.speed || 1, arrows = o.arrows !== false;
  var reduce = !!(win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var playing = o.autoplay !== false && !reduce;
  var vertical = o.vertical === true || o.vertical === false ? o.vertical : seq.view === "HALF" || (root.clientWidth || 400) < 620;

  // Estados acumulados por paso.
  var states: any[] = []; (function () {
    var pos: any = {}, k: string; for (k in seq.start) pos[k] = seq.start[k]; var ball = seq.ball;
    for (var i = 0; i < seq.frames.length; i++) { var f = seq.frames[i], np: any = {}; for (k in pos) np[k] = pos[k];
      if (f.pos) for (k in f.pos) np[k] = f.pos[k]; if (f.ball) ball = f.ball; pos = np; states.push({ pos: pos, ball: ball }); }
  })();
  // Región visible (en metros del marco de ataque) y transformación a pantalla.
  var x0 = -3, x1 = L + 3;
  if (seq.view === "HALF") {
    var minX = L; states.forEach(function (s: any) { for (var k in s.pos) minX = Math.min(minX, s.pos[k][0]); minX = Math.min(minX, s.ball[0]); });
    x0 = Math.max(-3, Math.min(L / 2 - 2, minX - 4));
  }
  function T(x: number, y: number): number[] { return vertical ? [y, x1 - x] : [x - x0, y + 3]; }
  var VW = vertical ? W : x1 - x0, VH = vertical ? x1 - x0 : W + 6;
  var vb = vertical ? [-3, 0, W + 6, VH] : [0, 0, VW, VH];

  root.innerHTML = "";
  var wrap = doc.createElement("div"); wrap.className = "fcsp"; root.appendChild(wrap);
  wrap.innerHTML = '<div class="fcsp-board"><svg class="fcsp-pitch" viewBox="' + vb.join(" ") + '" role="img" aria-label="' + String(seq.title || "Jugada").replace(/"/g, "&quot;") + '"></svg></div>'
    + '<div class="fcsp-status" aria-live="polite"><div class="fcsp-beat"><span class="fcsp-beat-t"></span><span class="fcsp-now">Ahora</span></div><p class="fcsp-txt"></p></div>'
    + '<div class="fcsp-dots" role="tablist" aria-label="Pasos"></div>'
    + '<div class="fcsp-ctrl"><button type="button" class="fcsp-prev" aria-label="Paso anterior">◀ Atrás</button><button type="button" class="fcsp-play"></button>'
    + '<button type="button" class="fcsp-next" aria-label="Paso siguiente">Siguiente ▶</button><button type="button" class="fcsp-speed" aria-label="Velocidad">1×</button>'
    + '<button type="button" class="fcsp-arrows" aria-pressed="true">Flechas</button></div>';
  var svg = wrap.querySelector("svg") as SVGSVGElement;
  function mk(tag: string, attrs: any, parent?: Element): any { var n = doc.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, String(attrs[k])); (parent || svg).appendChild(n); return n; }
  function P(x: number, y: number) { var p = T(x, y); return p[0].toFixed(2) + " " + p[1].toFixed(2); }

  // Campo.
  var defs = mk("defs", {});
  var gr = mk("linearGradient", { id: uid + "g", x1: 0, y1: 0, x2: vertical ? 0 : 1, y2: vertical ? 1 : 0 }, defs);
  mk("stop", { offset: 0, "stop-color": "#123A1E" }, gr); mk("stop", { offset: 1, "stop-color": "#0A2312" }, gr);
  [["w", "#fff"], ["o", "#D9A526"]].forEach(function (m) {
    var mm = mk("marker", { id: uid + m[0], viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 4, markerHeight: 4, orient: "auto" }, defs);
    mk("path", { d: "M1 1L9 5L1 9", fill: "none", stroke: m[1], "stroke-width": 1.8, "stroke-linecap": "round", "stroke-linejoin": "round" }, mm);
  });
  mk("rect", { x: vb[0], y: vb[1], width: vb[2], height: vb[3], fill: "url(#" + uid + "g)" });
  for (var s = 0; s < 14; s++) { var a0 = s * L / 14; if (s % 2 === 0 && a0 + L / 14 > x0) { var p1 = T(Math.max(a0, x0), 0), p2 = T(a0 + L / 14, W);
    mk("rect", { x: Math.min(p1[0], p2[0]), y: Math.min(p1[1], p2[1]), width: Math.abs(p2[0] - p1[0]), height: Math.abs(p2[1] - p1[1]), fill: "rgba(255,255,255,.022)" }); } }
  var LS = { fill: "none", stroke: "rgba(255,255,255,.42)", "stroke-width": 0.26 };
  function poly(pts: number[][]) { mk("path", Object.assign({ d: "M" + pts.map(function (q) { return P(q[0], q[1]); }).join(" L") }, LS)); }
  function arc(cx: number, cy: number, r: number, a: number, b: number) { var pts = []; for (var i = 0; i <= 24; i++) { var t = a + (b - a) * i / 24; pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } poly(pts); }
  poly([[0, 0], [L, 0], [L, W], [0, W], [0, 0]]); poly([[L / 2, 0], [L / 2, W]]); arc(L / 2, W / 2, 9.15, 0, Math.PI * 2);
  [0, 1].forEach(function (g) { var gx = g ? L : 0, d = g ? -1 : 1;
    poly([[gx, W / 2 - 20.16], [gx + 16.5 * d, W / 2 - 20.16], [gx + 16.5 * d, W / 2 + 20.16], [gx, W / 2 + 20.16]]);
    poly([[gx, W / 2 - 9.16], [gx + 5.5 * d, W / 2 - 9.16], [gx + 5.5 * d, W / 2 + 9.16], [gx, W / 2 + 9.16]]);
    poly([[gx, W / 2 - 3.66], [gx - 1.6 * d, W / 2 - 3.66], [gx - 1.6 * d, W / 2 + 3.66], [gx, W / 2 + 3.66]]);
    var c = T(gx + 11 * d, W / 2); mk("circle", { cx: c[0], cy: c[1], r: 0.3, fill: "rgba(255,255,255,.42)" });
    arc(gx + 11 * d, W / 2, 9.15, g ? Math.PI - 0.93 : -0.93, g ? Math.PI + 0.93 : 0.93); });

  var gLines = mk("g", {});
  var el: any = {};
  // Rivales primero: nuestros números quedan siempre encima y se leen aunque haya un marcador pegado.
  seq.actors.filter(function (a: any) { return a.team !== "OWN"; }).concat(seq.actors.filter(function (a: any) { return a.team === "OWN"; })).forEach(function (a: any) {
    var own = a.team === "OWN";
    var g = mk("g", { class: own ? "fcsp-pl" + (a.kind === "back" ? " back" : "") : "fcsp-rv" });
    mk("circle", { cx: 0, cy: 0, r: own ? 1.35 : 1.1 }, g);
    var t = mk("text", { x: 0, y: 0, "font-size": own ? (String(a.label).length > 2 ? 1.05 : 1.5) : 1.15 }, g); t.textContent = a.label || "";
    el[a.id] = g;
  });
  var ball = mk("circle", { class: "fcsp-ball", cx: 0, cy: 0, r: 0.65, fill: "#F7D66B", stroke: "#3A2A00", "stroke-width": 0.2 });

  function place(node: any, xy: number[]) { var p = T(xy[0], xy[1]); node.style.transform = "translate(" + p[0].toFixed(2) + "px," + p[1].toFixed(2) + "px)"; }
  function pathD(l: number[]) { return l.length === 6 ? "M" + P(l[0], l[1]) + " Q" + P(l[2], l[3]) + " " + P(l[4], l[5]) : "M" + P(l[0], l[1]) + " L" + P(l[2], l[3]); }
  function drawLines(f: any, old: boolean) {
    var c = old ? " old" : "";
    (f.runs || []).forEach(function (l: number[]) { mk("path", { class: "fcsp-ln run" + c, d: pathD(l), "marker-end": "url(#" + uid + "w)" }, gLines); });
    (f.passes || []).forEach(function (l: number[]) { mk("path", { class: "fcsp-ln pass" + c, d: pathD(l), "marker-end": "url(#" + uid + "o)" }, gLines); });
    (f.blocks || []).forEach(function (l: number[]) {
      mk("path", { class: "fcsp-ln blk" + c, d: pathD(l) }, gLines);
      var a = T(l[l.length - 4], l[l.length - 3]), b = T(l[l.length - 2], l[l.length - 1]), dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1, px = -dy / n * 1.1, py = dx / n * 1.1;
      mk("line", { class: "fcsp-ln blk" + c, x1: b[0] - px, y1: b[1] - py, x2: b[0] + px, y2: b[1] + py }, gLines);
    });
  }
  var beatEl = wrap.querySelector(".fcsp-beat-t") as HTMLElement, txtEl = wrap.querySelector(".fcsp-txt") as HTMLElement;
  var statusEl = wrap.querySelector(".fcsp-status") as HTMLElement, dotsEl = wrap.querySelector(".fcsp-dots") as HTMLElement;
  var playBtn = wrap.querySelector(".fcsp-play") as HTMLButtonElement, speedBtn = wrap.querySelector(".fcsp-speed") as HTMLButtonElement, arrowsBtn = wrap.querySelector(".fcsp-arrows") as HTMLButtonElement;
  seq.frames.forEach(function (_: any, i: number) { var d = doc.createElement("i"); d.setAttribute("role", "tab"); d.tabIndex = 0; d.title = "Paso " + (i + 1);
    d.addEventListener("click", function () { setPlaying(false); go(i); }); dotsEl.appendChild(d); });

  function render() {
    var f = seq.frames[frame] || { beat: "—", txt: "" }, stt = states[frame] || { pos: seq.start, ball: seq.ball };
    var key = f.key || [];
    for (var id in el) { el[id].classList.toggle("key", key.indexOf(id) >= 0); if (stt.pos[id]) place(el[id], stt.pos[id]); }
    place(ball, stt.ball);
    gLines.innerHTML = "";
    if (arrows) { for (var i = 0; i < frame; i++) drawLines(seq.frames[i], true); drawLines(f, false); }
    beatEl.textContent = f.beat; txtEl.textContent = f.txt;
    statusEl.classList.toggle("trig", !!f.trig);
    for (var j = 0; j < dotsEl.children.length; j++) { var d = dotsEl.children[j] as HTMLElement;
      d.className = j === frame ? "on" + (seq.frames[j].trig ? " trig" : "") : j < frame ? "done" : ""; d.setAttribute("aria-selected", j === frame ? "true" : "false"); }
    if (o.onFrame) o.onFrame(frame);
  }
  function go(i: number) {
    var n = seq.frames.length; if (!n) return;
    var next = ((i % n) + n) % n;
    if (next === 0 && frame === n - 1) { wrap.classList.add("instant"); frame = 0; render(); wrap.getBoundingClientRect(); wrap.classList.remove("instant"); return; }
    frame = next; render();
  }
  function loop() { if (timer) { win.clearInterval(timer); timer = null; } if (!playing || seq.frames.length < 2) return; timer = win.setInterval(function () { go(frame + 1); }, (reduce ? 4200 : 2800) / speed); }
  function setPlaying(v: boolean) { playing = v; playBtn.textContent = v ? "Pausa" : "Reproducir"; loop(); }
  function setSpeed(v: number) { speed = v; speedBtn.textContent = v === 0.6 ? "0,6×" : v === 1.6 ? "1,6×" : "1×"; wrap.classList.toggle("slow", v < 1); loop(); }
  function setArrows(v: boolean) { arrows = v; arrowsBtn.setAttribute("aria-pressed", v ? "true" : "false"); arrowsBtn.textContent = v ? "Flechas" : "Sin flechas"; render(); }
  (wrap.querySelector(".fcsp-prev") as HTMLElement).addEventListener("click", function () { setPlaying(false); if (frame > 0) go(frame - 1); });
  (wrap.querySelector(".fcsp-next") as HTMLElement).addEventListener("click", function () { setPlaying(false); go(frame + 1); });
  playBtn.addEventListener("click", function () { setPlaying(!playing); });
  speedBtn.addEventListener("click", function () { setSpeed(speed === 1 ? 0.6 : speed === 0.6 ? 1.6 : 1); });
  arrowsBtn.addEventListener("click", function () { setArrows(!arrows); });

  wrap.classList.add("instant"); setArrows(arrows); setSpeed(speed); wrap.getBoundingClientRect(); wrap.classList.remove("instant");
  setPlaying(playing);
  return {
    go: function (i: number) { setPlaying(false); go(i); }, next: function () { setPlaying(false); go(frame + 1); }, prev: function () { setPlaying(false); if (frame > 0) go(frame - 1); },
    play: function () { setPlaying(true); }, pause: function () { setPlaying(false); }, setArrows: setArrows, setSpeed: setSpeed,
    frame: function () { return frame; }, destroy: function () { setPlaying(false); root.innerHTML = ""; },
  };
}

/**
 * Código del reproductor listo para incrustar: una expresión que devuelve `createPlayer`. Define `__name` por si el
 * compilador (tsx/esbuild con keepNames, p. ej. en el servidor) lo ha insertado dentro de la función.
 */
export function playerSource(): string { return wrapSource(createPlayer.toString()); }
export const wrapSource = (fnSrc: string) => `(function(){var __name=function(f){return f};return (${fnSrc});})()`;

/** Página mínima con el reproductor (pruebas y vistas previas). */
export function playerPageHtml(seq: unknown, opts: Record<string, unknown> = {}): string {
  const data = JSON.stringify(seq).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#070B08;padding:12px}</style></head>`
    + `<body><div id="p"></div><script>window.player=${playerSource()}(document.getElementById("p"),${data},${JSON.stringify(opts)});</script></body></html>`;
}
