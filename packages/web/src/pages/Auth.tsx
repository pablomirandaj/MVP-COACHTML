import { useState } from "react";
import { post } from "../lib/api";
import { ErrorBox, useAction } from "../components/ui";

export function Auth({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const a = useAction();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    a.run(async () => {
      if (mode === "login") await post("/auth/login", { email, password });
      else await post("/auth/register", { email, password, display_name: name });
      onDone();
    });
  };
  return (
    <main className="auth">
      <h1>Football Coach Studio</h1>
      <p className="muted">Prepara cada jornada: once, balón parado, fases de juego y la charla.</p>
      <form className="card stack" onSubmit={submit}>
        <h2>{mode === "login" ? "Entrar" : "Crear cuenta"}</h2>
        {mode === "register" && <label>Tu nombre<input aria-label="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" /></label>}
        <label>Email<input aria-label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus /></label>
        <label>Contraseña<input aria-label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
          autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        <ErrorBox error={a.error} />
        <button className="primary" disabled={a.busy}>{mode === "login" ? "Entrar" : "Crear cuenta"}</button>
        <button type="button" className="link" onClick={() => { setMode(mode === "login" ? "register" : "login"); a.setError(null); }}>
          {mode === "login" ? "¿No tienes cuenta? Crear una" : "¿Ya tienes cuenta? Entrar"}
        </button>
      </form>
    </main>
  );
}
