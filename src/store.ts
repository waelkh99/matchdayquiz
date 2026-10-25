// localStorage can throw (private mode, blocked storage); the app must work without it.
const P = 'teamsheet:v2:'
export const store = {
  get<T>(k: string): T | null {
    try { const v = localStorage.getItem(P + k); return v ? (JSON.parse(v) as T) : null } catch { return null }
  },
  set(k: string, v: unknown) {
    try { if (v === undefined) localStorage.removeItem(P + k); else localStorage.setItem(P + k, JSON.stringify(v)) } catch { /* ignore */ }
  },
}
