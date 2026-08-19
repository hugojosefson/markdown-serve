import { escapeHtml } from "./html.ts";
import { queryHref, setQuery } from "./query.ts";

type DisplayOption = "theme" | "width";
type Theme = "auto" | "light" | "dark";
type Width = "narrow" | "wide";

const themes: Theme[] = ["light", "auto", "dark"];
const widths: Width[] = ["narrow", "wide"];

export function displayState(url: URL): { theme: Theme; width: Width } {
  return {
    theme: valid(url.searchParams.get("theme"), themes, "auto"),
    width: valid(url.searchParams.get("width"), widths, "narrow"),
  };
}

export function displayHref(url: URL, option: DisplayOption): string {
  return displayOptionHref(
    url,
    option,
    nextDisplay(displayState(url)[option], option),
  );
}

export function displayLinks(url: URL): string {
  const { theme, width } = displayState(url);
  const nextTheme = nextDisplay(theme, "theme");
  const nextWidth = nextDisplay(width, "width");
  return `<div class="display-group display-theme" role="group" aria-label="Color theme">${
    themes.map((value) =>
      displayLink(
        "theme",
        value,
        theme,
        value === nextTheme ? "t" : undefined,
        url,
      )
    ).join("")
  }</div><div class="display-group display-width" role="group" aria-label="Content width">${
    widths.map((value) =>
      displayLink(
        "width",
        value,
        width,
        value === nextWidth ? "w" : undefined,
        url,
      )
    ).join("")
  }</div>`;
}

function displayLink(
  option: DisplayOption,
  value: Theme | Width,
  selected: Theme | Width,
  shortcut: "t" | "w" | undefined,
  url: URL,
): string {
  const active = value === selected;
  const label = active ? `${capitalize(value)} selected` : `Switch to ${value}`;
  return `<a class="display-link${active ? " is-selected" : ""}" href="${
    escapeHtml(displayOptionHref(url, option, value))
  }" aria-label="${label}" title="${label}${shortcut ? ` (${shortcut})` : ""}"${
    active ? ' aria-current="true"' : ""
  }${shortcut ? ` aria-keyshortcuts="${shortcut}"` : ""}>${
    icon(option, value)
  }</a>`;
}

function displayOptionHref(
  url: URL,
  option: DisplayOption,
  value: Theme | Width,
): string {
  const defaultValue = option === "theme" ? "auto" : "narrow";
  return queryHref(
    url.pathname,
    setQuery(url.search, option, value === defaultValue ? undefined : value),
  );
}

function icon(option: DisplayOption, value: Theme | Width): string {
  const paths = option === "theme"
    ? {
      light:
        '<circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5 13 13M13 3l-1.5 1.5M4.5 11.5 3 13"/>',
      auto:
        '<path fill="currentColor" stroke="none" d="M8 1a7 7 0 1 0 0 14V1Z"/><circle cx="8" cy="8" r="7"/>',
      dark: '<path d="M13.5 11A6 6 0 0 1 5 2.5 6.5 6.5 0 1 0 13.5 11Z"/>',
    }[value as Theme]
    : value === "wide"
    ? '<path d="M5 5 2 8l3 3M11 5l3 3-3 3M2 8h12"/>'
    : '<path d="M2 5 5 8 2 11M14 5l-3 3 3 3M5 8h6"/>';
  return `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">${paths}</svg>`;
}

function nextDisplay(
  state: Theme | Width,
  option: DisplayOption,
): Theme | Width {
  const states = option === "theme" ? themes : widths;
  return states[(states.indexOf(state as never) + 1) % states.length];
}

function valid<T extends string>(
  value: string | null,
  values: readonly T[],
  fallback: T,
): T {
  return values.includes(value as T) ? value as T : fallback;
}

function capitalize(value: string): string {
  return value[0].toUpperCase() + value.slice(1);
}
