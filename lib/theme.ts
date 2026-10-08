"use client";

// Theme is external state: the <html> class, set by the init script
// in the root layout and mutated here. Components read it through
// useSyncExternalStore with these helpers.

export type Theme = "dark" | "light";

export function getTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // private mode etc.: theme just won't persist
  }
  window.dispatchEvent(new Event("theme-change"));
}

export function subscribeTheme(onStoreChange: () => void) {
  window.addEventListener("theme-change", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener("theme-change", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}
