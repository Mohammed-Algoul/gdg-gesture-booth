import { DEFAULT_SETTINGS } from './config.js';

const STORAGE_KEY = 'gdg-gesture-booth:settings:v1';

/** Clamp/validate a loaded settings object against the defaults' types. */
function sanitize(raw) {
  const out = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
    const v = raw[key];
    if (typeof v === typeof def && (typeof v !== 'number' || Number.isFinite(v))) out[key] = v;
  }
  return out;
}

/** Settings live only in this browser's localStorage (nothing leaves the device). */
export function loadSettings() {
  try {
    return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* private mode / storage disabled — settings just won't persist */
  }
}
