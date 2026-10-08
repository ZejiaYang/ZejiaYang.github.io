"use client";

// Theme is external state: the <html> class, set before first paint by
// the root layout and kept in sync here for useSyncExternalStore.
export type Theme = "dark" | "light";

// An explicit choice still works for this tab if storage is blocked/full.
let unsavedPreference: Theme | null = null;

function isTheme(value: string | null): value is Theme {
  return value === "dark" || value === "light";
}

function readPreference(): Theme | null {
  if (unsavedPreference) return unsavedPreference;
  try {
    const saved = localStorage.getItem("theme");
    return isTheme(saved) ? saved : null;
  } catch {
    return null;
  }
}

function setDomTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function getTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  setDomTheme(theme);
  try {
    localStorage.setItem("theme", theme);
    unsavedPreference = null;
  } catch {
    unsavedPreference = theme;
  }
  window.dispatchEvent(new Event("theme-change"));
}

export function subscribeTheme(onStoreChange: () => void) {
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  let preference = readPreference();

  function syncDom() {
    setDomTheme(preference ?? (system.matches ? "dark" : "light"));
  }

  function onThemeChange() {
    preference = readPreference();
    onStoreChange();
  }

  function onStorage(event: StorageEvent) {
    if (event.key !== "theme" && event.key !== null) return;
    try {
      if (event.storageArea && event.storageArea !== window.localStorage)
        return;
    } catch {
      // A delivered storage event can still be used when access is blocked.
    }
    unsavedPreference = null;
    preference = isTheme(event.newValue) ? event.newValue : null;
    // Storage events do not mutate the receiving tab's DOM themselves.
    syncDom();
    onStoreChange();
  }

  function onSystemChange() {
    if (preference !== null) return;
    syncDom();
    onStoreChange();
  }

  syncDom();
  window.addEventListener("theme-change", onThemeChange);
  window.addEventListener("storage", onStorage);
  system.addEventListener("change", onSystemChange);
  return () => {
    window.removeEventListener("theme-change", onThemeChange);
    window.removeEventListener("storage", onStorage);
    system.removeEventListener("change", onSystemChange);
  };
}
