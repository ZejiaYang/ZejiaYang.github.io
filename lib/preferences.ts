"use client";

let memoryFolded = false;

export function getDashboardFolded(): boolean {
  try {
    const saved = localStorage.getItem("dash-folded");
    if (saved !== null) return saved === "1";
  } catch {
    // Storage can be unavailable in private browsing.
  }
  return memoryFolded;
}

export function setDashboardFolded(folded: boolean): void {
  memoryFolded = folded;
  try {
    localStorage.setItem("dash-folded", folded ? "1" : "0");
  } catch {
    // Storage can be unavailable in private browsing.
  }
  window.dispatchEvent(new CustomEvent("dashboard-fold", { detail: folded }));
}

export function subscribeDashboard(onChange: () => void): () => void {
  window.addEventListener("dashboard-fold", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("dashboard-fold", onChange);
    window.removeEventListener("storage", onChange);
  };
}
