"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";

const themes: Array<{ value: Theme; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("seeme-theme", theme);
}

export function ThemeControl() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "system";
    }

    const storedTheme = localStorage.getItem("seeme-theme");
    return storedTheme === "light" ||
      storedTheme === "dark" ||
      storedTheme === "system"
      ? storedTheme
      : "system";
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function changeTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    applyTheme(nextTheme);
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
