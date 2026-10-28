"use client";

import { useEffect, useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";

const themes: Array<{ value: Theme; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const themeStorageKey = "seeme-theme";
const themeListeners = new Set<() => void>();

function readStoredTheme(): Theme {
  const storedTheme = localStorage.getItem(themeStorageKey);
  return storedTheme === "light" ||
    storedTheme === "dark" ||
    storedTheme === "system"
    ? storedTheme
    : "system";
}

function subscribeToTheme(listener: () => void): () => void {
  themeListeners.add(listener);
  window.addEventListener("storage", listener);

  return () => {
    themeListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(themeStorageKey, theme);
}

export function ThemeControl() {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    readStoredTheme,
    (): Theme => "system",
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function changeTheme(nextTheme: Theme) {
    applyTheme(nextTheme);
    for (const listener of themeListeners) {
      listener();
    }
  }

  return (
    <fieldset className="flex items-center gap-1 border-0 p-0">
      <legend className="sr-only">Theme</legend>
      {themes.map((item) => (
        <button
          aria-pressed={theme === item.value}
          className="rounded px-2 py-1 text-xs text-muted transition-colors hover:bg-panel-strong hover:text-foreground aria-pressed:bg-accent aria-pressed:text-white"
          key={item.value}
          onClick={() => changeTheme(item.value)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </fieldset>
  );
}
