import fs from "node:fs";
import path from "node:path";
import { isBuiltin } from "./builtins.js";

export function createCompleter(ctx) {
  return (partial) => {
    const bits = partial.split(/\s+/);
    const last = bits[bits.length - 1] ?? "";

    if (bits.length <= 1) {
      const cmds = [
        ...Object.keys(ctx.aliases),
        ...listBuiltins(),
        ...listPathCommands(ctx.env.PATH || ""),
      ];
      const hits = unique(cmds.filter((c) => c.startsWith(last))).sort();
      return [hits.length ? hits : cmds.sort(), last];
    }

    return completePath(last, ctx.cwd);
  };
}

function listBuiltins() {
  return [
    "cd",
    "pwd",
    "echo",
    "exit",
    "help",
    "clear",
    "export",
    "unset",
    "env",
    "history",
    "type",
    "which",
    "alias",
    "unalias",
    "true",
    "false",
  ].filter((n) => isBuiltin(n));
}

function listPathCommands(pathEnv) {
  const names = [];
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }
    names.push(...entries);
  }
  return unique(names);
}

function completePath(last, cwd) {
  const base = last.startsWith("~")
    ? last.replace(/^~/, process.env.HOME || cwd)
    : last;
  const resolved = path.resolve(cwd, base);
  const dir = last.endsWith("/") ? resolved : path.dirname(resolved);
  const prefix = last.endsWith("/") ? "" : path.basename(base);

  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [[], last];
  }

  const hits = entries
    .filter((name) => name.startsWith(prefix))
    .map((name) => {
      const full = path.join(dir, name);
      const display = last.endsWith("/")
        ? last + name
        : last.slice(0, last.length - prefix.length) + name;
      try {
        return fs.statSync(full).isDirectory() ? display + "/" : display;
      } catch {
        return display;
      }
    });

  return [hits, last];
}

function unique(arr) {
  return [...new Set(arr)];
}
