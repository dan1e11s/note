import { createIconButton, icons, setIcon } from "./icons";

type Theme = "light" | "dark";

const STORAGE_KEY = "note-theme";

function readStored(): Theme | null {
  const value = localStorage.getItem(STORAGE_KEY);
  return value === "light" || value === "dark" ? value : null;
}

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function activeTheme(): Theme {
  return readStored() ?? systemTheme();
}

function apply(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function createThemeToggle(): HTMLButtonElement {
  const button = createIconButton(icons.moon, "Сменить тему", "icon-button");

  const refresh = (): void => {
    setIcon(button, activeTheme() === "dark" ? icons.sun : icons.moon);
  };

  button.addEventListener("click", () => {
    const next: Theme = activeTheme() === "dark" ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, next);
    apply(next);
    refresh();
  });

  refresh();
  return button;
}
