/**
 * Expansions POSIX minimales, dans l'ordre :
 *  1. tilde (~ et ~/...)
 *  2. variables ($NAME, ${NAME}, $?, $$)
 *  3. globbing (* et ?) — uniquement hors quotes
 */

import fs from "node:fs";
import path from "node:path";

export function expandWord(token, ctx) {
  if (token.quoted === "single") {
    return [token.value];
  }

  let value = expandVars(token.value, ctx);
  if (token.quoted === "double") {
    return [value];
  }

  value = expandTilde(value, ctx);
  return expandGlob(value, ctx.cwd);
}

export function expandVars(input, ctx) {
  const env = ctx.env;
  let out = "";
  let i = 0;

  while (i < input.length) {
    if (input[i] !== "$") {
      out += input[i];
      i += 1;
      continue;
    }

    if (input[i + 1] === "?") {
      out += String(ctx.lastStatus ?? 0);
      i += 2;
      continue;
    }
    if (input[i + 1] === "$") {
      out += String(process.pid);
      i += 2;
      continue;
    }
    if (input[i + 1] === "{") {
      const end = input.indexOf("}", i + 2);
      if (end === -1) {
        out += "$";
        i += 1;
        continue;
      }
      const name = input.slice(i + 2, end);
      out += env[name] ?? "";
      i = end + 1;
      continue;
    }

    if (/[A-Za-z_]/.test(input[i + 1] ?? "")) {
      let j = i + 1;
      while (j < input.length && /[A-Za-z0-9_]/.test(input[j])) j += 1;
      const name = input.slice(i + 1, j);
      out += env[name] ?? "";
      i = j;
      continue;
    }

    out += "$";
    i += 1;
  }

  return out;
}

export function expandTilde(value, ctx) {
  if (value === "~") return ctx.env.HOME || ctx.cwd;
  if (value.startsWith("~/")) {
    return path.join(ctx.env.HOME || ctx.cwd, value.slice(2));
  }
  return value;
}

export function expandGlob(pattern, cwd) {
  if (!/[*?]/.test(pattern)) return [pattern];

  const dir = path.isAbsolute(pattern)
    ? path.dirname(pattern)
    : path.dirname(path.join(cwd, pattern));
  const base = path.basename(pattern);

  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [pattern];
  }

  const re = globToRegExp(base);
  const matches = entries
    .filter((name) => !(name.startsWith(".") && !base.startsWith(".")))
    .filter((name) => re.test(name))
    .sort();

  if (matches.length === 0) return [pattern];

  const prefix = path.isAbsolute(pattern)
    ? path.dirname(pattern)
    : path.dirname(pattern) === "."
      ? ""
      : path.dirname(pattern);

  return matches.map((name) => (prefix ? path.join(prefix, name) : name));
}

function globToRegExp(glob) {
  let src = "^";
  for (const ch of glob) {
    if (ch === "*") src += ".*";
    else if (ch === "?") src += ".";
    else src += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  src += "$";
  return new RegExp(src);
}
