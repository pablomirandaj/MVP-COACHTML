// Asignación óptima (algoritmo húngaro) con desempate lexicográfico determinista (docs/15 §7).
// score[i][j]: idoneidad entera de la fila i (rol/actor) para la columna j (jugador). Se maximiza.

/** Máximo de la suma de una asignación de todas las filas a columnas distintas (filas ≤ columnas). */
export function maxAssignmentValue(score: number[][]): number {
  const n = score.length;
  if (n === 0) return 0;
  const m = score[0].length;
  if (m < n) throw new Error("maxAssignmentValue: más filas que columnas");
  let big = 0;
  for (const row of score) for (const s of row) big = Math.max(big, s);
  // Húngaro clásico (min-coste) sobre coste = big - score; índices 1..n / 1..m.
  const INF = Number.MAX_SAFE_INTEGER;
  const u = new Array(n + 1).fill(0), v = new Array(m + 1).fill(0);
  const p = new Array(m + 1).fill(0), way = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(m + 1).fill(INF);
    const used = new Array(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF, j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = big - score[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  let total = 0;
  for (let j = 1; j <= m; j++) if (p[j]) total += score[p[j] - 1][j - 1];
  return total;
}

/**
 * Asignación de máxima idoneidad; entre óptimos empatados elige, recorriendo las filas en orden,
 * la primera columna (en el orden dado) que mantiene el óptimo. Devuelve el índice de columna por fila.
 */
export function lexOptimalAssignment(score: number[][]): number[] {
  const n = score.length;
  if (n === 0) return [];
  const m = score[0].length;
  const best = maxAssignmentValue(score);
  const result: number[] = [];
  const usedCols = new Set<number>();
  let acc = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (usedCols.has(j)) continue;
      const restRows: number[] = [];
      for (let r = i + 1; r < n; r++) restRows.push(r);
      const restCols: number[] = [];
      for (let c = 0; c < m; c++) if (c !== j && !usedCols.has(c)) restCols.push(c);
      const sub = restRows.map((r) => restCols.map((c) => score[r][c]));
      const rest = sub.length ? maxAssignmentValue(sub) : 0;
      if (acc + score[i][j] + rest === best) {
        result.push(j); usedCols.add(j); acc += score[i][j];
        break;
      }
    }
  }
  return result;
}
