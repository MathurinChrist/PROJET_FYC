/** Séquences ANSI — pas de dépendance externe, le terminal suffit. */

const enabled = process.stdout.isTTY && process.env.NO_COLOR !== "0";

function wrap(code, text) {
  if (!enabled) return String(text);
  return `\x1b[${code}m${text}\x1b[0m`;
}

export const ansi = {
  green: (t) => wrap("32", t),
  blue: (t) => wrap("34", t),
  cyan: (t) => wrap("36", t),
  yellow: (t) => wrap("33", t),
  red: (t) => wrap("31", t),
  dim: (t) => wrap("2", t),
  bold: (t) => wrap("1", t),
};
