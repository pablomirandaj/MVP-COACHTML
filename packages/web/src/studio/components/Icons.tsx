// Iconos de trazo (24 px), dibujados a mano para no depender de librerías.
const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
export const Icon = {
  home: () => <svg viewBox="0 0 24 24" aria-hidden="true"><path {...P} d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1z" /></svg>,
  board: () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect {...P} x="3" y="5" width="18" height="14" rx="2" /><path {...P} d="M12 5v14M7 10l2 2-2 2M15 9c2 1 2 5 0 6" /></svg>,
  setpiece: () => <svg viewBox="0 0 24 24" aria-hidden="true"><path {...P} d="M4 20V5l7 3-7 3" /><circle {...P} cx="17" cy="15" r="3" /><path {...P} d="M8 17c3-4 5-5 6-4" /></svg>,
  plans: () => <svg viewBox="0 0 24 24" aria-hidden="true"><path {...P} d="M4 18h4l3-12 3 8 2-3h4" /></svg>,
  library: () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect {...P} x="4" y="4" width="7" height="7" rx="1.5" /><rect {...P} x="13" y="4" width="7" height="7" rx="1.5" /><rect {...P} x="4" y="13" width="7" height="7" rx="1.5" /><rect {...P} x="13" y="13" width="7" height="7" rx="1.5" /></svg>,
  roster: () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...P} cx="9" cy="8" r="3" /><path {...P} d="M3 20c0-3 3-5 6-5s6 2 6 5M16 6a3 3 0 0 1 0 6M18 15c2 1 3 3 3 5" /></svg>,
};
