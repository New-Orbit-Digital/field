// Small DOM + formatting helpers shared by the UI modules.
export const $ = (id) => document.getElementById(id);

export function fmt(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Browser storage can be unavailable (private windows etc.) — never let it break the game.
export function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
export function safeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }

// A keyboard keycap for prompts, e.g. KEY('E').
export const KEY = (k) => `<span class="key">${k}</span>`;
