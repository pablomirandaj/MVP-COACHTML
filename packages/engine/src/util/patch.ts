// Diferencias tipo RFC 6902 (subconjunto: add/remove/replace) entre dos documentos JSON,
// usadas para el historial con deshacer/rehacer (docs/15 §11).

export type PatchOp =
  | { op: "add"; path: string; value: unknown }
  | { op: "remove"; path: string }
  | { op: "replace"; path: string; value: unknown };

const esc = (k: string) => k.replace(/~/g, "~0").replace(/\//g, "~1");
const unesc = (k: string) => k.replace(/~1/g, "/").replace(/~0/g, "~");
const isObj = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === "object" && !Array.isArray(x);
const clone = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

export function diff(a: unknown, b: unknown, path = ""): PatchOp[] {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (Array.isArray(a) && Array.isArray(b)) {
    const ops: PatchOp[] = [];
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) ops.push(...diff(a[i], b[i], `${path}/${i}`));
    for (let i = n; i < b.length; i++) ops.push({ op: "add", path: `${path}/${i}`, value: clone(b[i]) });
    for (let i = a.length - 1; i >= n; i--) ops.push({ op: "remove", path: `${path}/${i}` });
    return ops;
  }
  if (isObj(a) && isObj(b)) {
    const ops: PatchOp[] = [];
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    for (const k of keys) {
      const p = `${path}/${esc(k)}`;
      if (!(k in b) || b[k] === undefined) { if (k in a && a[k] !== undefined) ops.push({ op: "remove", path: p }); }
      else if (!(k in a) || a[k] === undefined) ops.push({ op: "add", path: p, value: clone(b[k]) });
      else ops.push(...diff(a[k], b[k], p));
    }
    return ops;
  }
  return [{ op: "replace", path, value: clone(b) }];
}

export function applyPatch<T>(doc: T, ops: PatchOp[]): T {
  let root: unknown = clone(doc);
  for (const o of ops) {
    if (o.path === "") { root = o.op === "remove" ? undefined : clone((o as { value: unknown }).value); continue; }
    const parts = o.path.split("/").slice(1).map(unesc);
    let parent: any = root;
    for (const p of parts.slice(0, -1)) parent = parent[p];
    const last = parts[parts.length - 1];
    if (Array.isArray(parent)) {
      const i = Number(last);
      if (o.op === "add") parent.splice(i, 0, clone(o.value));
      else if (o.op === "remove") parent.splice(i, 1);
      else parent[i] = clone(o.value);
    } else {
      if (o.op === "remove") delete parent[last];
      else parent[last] = clone((o as { value: unknown }).value);
    }
  }
  return root as T;
}

/** Rutas de primer y segundo nivel afectadas (p. ej. "/actors/3"), para comprobar la localidad G2. */
export function touchedPaths(ops: PatchOp[], depth = 2): string[] {
  return [...new Set(ops.map((o) => o.path.split("/").slice(0, depth + 1).join("/")))].sort();
}
