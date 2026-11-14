"use client";

import { MoonIcon, SunIcon } from "@nuvui/icons";
import { Button } from "@nuvui/react";
import { useEffect, useState } from "react";
import { THEME_KEY } from "../lib/theme";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  // data-theme="system": nuvui follows the OS in CSS, so ask the same question here.
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Switches between light and dark, and remembers the choice for the next visit. */
export function ThemeToggle() {
  // Unknown until the browser can say; the server renders the moon.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  const next: Theme = theme === "dark" ? "light" : "dark";

  function toggle() {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage can be blocked; the theme still changes for this page.
    }
    setTheme(next);
  }

  return (
    <Button
      intent="ghost"
      size="sm"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      className="theme-toggle"
    >
      {theme === "dark" ? (
        <SunIcon aria-hidden="true" size={18} />
      ) : (
        <MoonIcon aria-hidden="true" size={18} />
      )}
    </Button>
  );
}
