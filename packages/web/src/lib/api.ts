// Cliente de la API: JSON, cookies de sesión y errores RFC 9457 convertidos en ApiError.
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public body: any) { super(message); }
}

export async function api<T = any>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${url}`, {
    method, credentials: "same-origin",
    headers: body !== undefined ? { "content-type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const isJson = res.headers.get("content-type")?.includes("json");
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) throw new ApiError(res.status, data?.code ?? "ERROR", data?.title ?? `Error ${res.status}`, data);
  return data as T;
}

export const get = <T = any>(url: string) => api<T>("GET", url);
export const post = <T = any>(url: string, body?: unknown) => api<T>("POST", url, body ?? {});
export const put = <T = any>(url: string, body: unknown) => api<T>("PUT", url, body);
export const patch = <T = any>(url: string, body: unknown) => api<T>("PATCH", url, body);
export const del = (url: string) => api("DELETE", url);

/** Descarga un recurso de la API como archivo (HTML exportado, PDF). */
export async function download(url: string, fallbackName: string) {
  const res = await fetch(`/api${url}`, { credentials: "same-origin" });
  if (!res.ok) {
    const data = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
    throw new ApiError(res.status, data?.code ?? "ERROR", data?.title ?? `Error ${res.status}`, data);
  }
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? fallbackName;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export interface Me { id: string; email: string; display_name: string; teams: { id: string; name: string; category: string; season: string; role: string }[] }
export interface PlayerDto {
  id: string; first_name: string; last_name: string; nickname: string | null; shirt_number: number | null; primary_position: string;
  secondary_positions: string[]; dominant_foot: "RIGHT" | "LEFT" | "BOTH"; height_cm: number | null; attributes: Record<string, number>;
  setpiece_roles: string[]; status: string; status_note: string | null; coach_notes: string | null;
}
export interface MatchDto {
  id: string; team_id: string; status: string; kickoff_at: string | null; is_home: boolean | null; venue: string | null; matchday: number | null;
  competition: string | null; opponent: string | null; objectives: string | null; training_notes: string | null; post_match_notes: string | null;
}
