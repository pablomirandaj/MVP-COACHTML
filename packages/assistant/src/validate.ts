// Validación de comandos IR con el validador precompilado (sin eval: funciona en la página de Claude).
// @ts-expect-error módulo JS generado sin tipos
import { validateCommand } from "./generated/command-validator.js";

type Validator = ((c: unknown) => boolean) & { errors?: { instancePath?: string; message?: string; params?: Record<string, unknown> }[] | null };
const v = validateCommand as Validator;

export function commandErrors(commands: unknown): string | null {
  if (!Array.isArray(commands) || commands.length === 0) return "commands debe ser una lista con al menos un comando.";
  for (const [i, c] of commands.entries()) {
    if (!v(c)) {
      const e = (v.errors ?? []).slice(0, 3).map((x) => `${x.instancePath || "/"} ${x.message ?? ""}`.trim()).join("; ");
      return `Comando ${i + 1} (${(c as any)?.op ?? "?"}) no cumple el esquema IR: ${e}`;
    }
  }
  return null;
}
