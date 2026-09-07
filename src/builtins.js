/**
 * Commandes internes : elles s'exécutent dans le processus du shell.
 * Sans ça, `cd` ne changerait que le répertoire d'un processus fils,
 * et le prompt resterait au même endroit — le piège classique.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ansi } from "./ansi.js";

export const builtins = {
  cd,
  pwd,
  echo,
  exit,
  help,
  clear,
  export: exportVar,
  unset,
  env,
  history,
  type,
  which,
  alias,
  unalias,
  source,
  true: trueCmd,
  false: falseCmd,
};

export function isBuiltin(name) {
  return Object.prototype.hasOwnProperty.call(builtins, name);
}

export function runBuiltin(name, argv, ctx, io) {
  return builtins[name](argv, ctx, io);
}

function write(io, text) {
  io.stdout.write(text);
}

function writeln(io, text = "") {
  io.stdout.write(text + "\n");
}

function cd(argv, ctx, io) {
  const targetArg = argv[1];
  let target;

  if (!targetArg || targetArg === "~") {
    target = ctx.env.HOME || os.homedir();
  } else if (targetArg === "-") {
    if (!ctx.oldPwd) {
      io.stderr.write("nysh: cd: OLDPWD non défini\n");
      return 1;
    }
    target = ctx.oldPwd;
    writeln(io, target);
  } else {
    target = path.resolve(ctx.cwd, targetArg);
  }

  try {
    const stat = fs.statSync(target);
    if (!stat.isDirectory()) {
      io.stderr.write(`nysh: cd: ${targetArg}: n'est pas un répertoire\n`);
      return 1;
    }
  } catch {
    io.stderr.write(`nysh: cd: ${targetArg}: aucun fichier ou dossier de ce type\n`);
    return 1;
  }

  ctx.oldPwd = ctx.cwd;
  ctx.cwd = fs.realpathSync(target);
  ctx.env.PWD = ctx.cwd;
  ctx.env.OLDPWD = ctx.oldPwd;
  return 0;
}

function pwd(_argv, ctx, io) {
  writeln(io, ctx.cwd);
  return 0;
}

function echo(argv, ctx, io) {
  let args = argv.slice(1);
  let newline = true;
  if (args[0] === "-n") {
    newline = false;
    args = args.slice(1);
  }
  const text = args.join(" ");
  if (newline) writeln(io, text);
  else write(io, text);
  return 0;
}

function exit(argv, ctx) {
  const code = argv[1] !== undefined ? Number(argv[1]) || 0 : ctx.lastStatus || 0;
  ctx.shouldExit = true;
  ctx.exitCode = code;
  return code;
}

function clear(_argv, _ctx, io) {
  io.stdout.write("\x1b[2J\x1b[H");
  return 0;
}

function exportVar(argv, ctx, io) {
  if (argv.length === 1) {
    for (const key of Object.keys(ctx.env).sort()) {
      writeln(io, `${key}=${ctx.env[key]}`);
    }
    return 0;
  }
  for (const spec of argv.slice(1)) {
    const eq = spec.indexOf("=");
    if (eq === -1) {
      ctx.env[spec] = ctx.env[spec] ?? "";
    } else {
      ctx.env[spec.slice(0, eq)] = spec.slice(eq + 1);
    }
  }
  return 0;
}

function unset(argv, ctx) {
  for (const name of argv.slice(1)) {
    delete ctx.env[name];
  }
  return 0;
}

function env(_argv, ctx, io) {
  for (const key of Object.keys(ctx.env).sort()) {
    writeln(io, `${key}=${ctx.env[key]}`);
  }
  return 0;
}

function history(_argv, ctx, io) {
  const lines = ctx.historyEntries ?? [];
  lines.forEach((line, idx) => {
    writeln(io, `${String(idx + 1).padStart(5)}  ${line}`);
  });
  return 0;
}

function type(argv, ctx, io) {
  if (argv.length < 2) {
    io.stderr.write("nysh: type: argument manquant\n");
    return 1;
  }
  let status = 0;
  for (const name of argv.slice(1)) {
    if (ctx.aliases[name]) {
      writeln(io, `${name} est un alias de \`${ctx.aliases[name]}\``);
    } else if (isBuiltin(name)) {
      writeln(io, `${name} est une commande interne du shell`);
    } else {
      const found = findInPath(name, ctx.env.PATH || "", ctx.cwd);
      if (found) writeln(io, `${name} est ${found}`);
      else {
        writeln(io, `nysh: type: ${name} : introuvable`);
        status = 1;
      }
    }
  }
  return status;
}

function which(argv, ctx, io) {
  if (argv.length < 2) return 1;
  const found = findInPath(argv[1], ctx.env.PATH || "", ctx.cwd);
  if (!found) return 1;
  writeln(io, found);
  return 0;
}

function alias(argv, ctx, io) {
  if (argv.length === 1) {
    for (const [k, v] of Object.entries(ctx.aliases).sort()) {
      writeln(io, `alias ${k}='${v}'`);
    }
    return 0;
  }
  for (const spec of argv.slice(1)) {
    const eq = spec.indexOf("=");
    if (eq === -1) {
      if (ctx.aliases[spec]) writeln(io, `alias ${spec}='${ctx.aliases[spec]}'`);
      else {
        io.stderr.write(`nysh: alias: ${spec} : introuvable\n`);
        return 1;
      }
    } else {
      ctx.aliases[spec.slice(0, eq)] = spec.slice(eq + 1);
    }
  }
  return 0;
}

function unalias(argv, ctx) {
  for (const name of argv.slice(1)) {
    delete ctx.aliases[name];
  }
  return 0;
}

async function source(argv, ctx, io) {
  const file = argv[1];
  if (!file) {
    io.stderr.write("nysh: source : fichier manquant\n");
    return 1;
  }
  const full = path.resolve(ctx.cwd, file);
  let raw;
  try {
    raw = fs.readFileSync(full, "utf8");
  } catch {
    io.stderr.write(`nysh: source : ${file} : introuvable\n`);
    return 1;
  }
  if (!ctx.runLine) {
    io.stderr.write("nysh: source : indisponible dans ce contexte\n");
    return 1;
  }
  for (const line of raw.split(/\r?\n/)) {
    await ctx.runLine(line);
    if (ctx.shouldExit) break;
  }
  return ctx.lastStatus;
}

function trueCmd() {
  return 0;
}

function falseCmd() {
  return 1;
}

function help(_argv, _ctx, io) {
  writeln(
    io,
    [
      ansi.bold("nysh") + " — Node.js Shell pédagogique",
      "",
      ansi.cyan("Commandes internes"),
      "  cd [dir]     changer de répertoire  (cd - pour revenir)",
      "  pwd          afficher le répertoire courant",
      "  echo [-n]    afficher des arguments",
      "  export A=b   définir une variable d'environnement",
      "  unset A      supprimer une variable",
      "  env          lister l'environnement",
      "  alias a=b    créer un alias",
      "  type cmd     dire si cmd est interne, alias, ou externe",
      "  history      historique des commandes",
      "  source f     exécuter un fichier dans ce shell",
      "  clear        effacer l'écran",
      "  help         cette aide",
      "  exit [n]     quitter le shell",
      "",
      ansi.cyan("Syntaxe supportée"),
      "  cmd | cmd          pipes",
      "  cmd > f  >> f      redirection stdout",
      "  cmd 2> f           redirection stderr",
      "  cmd < f            redirection stdin",
      "  cmd && cmd || cmd  opérateurs conditionnels",
      "  cmd ; cmd          séquence",
      "  cmd &              arrière-plan",
      "  $VAR ${VAR} $? $$  expansions",
      "  ~  *  ?            tilde et globbing",
      "",
      "Cours : npm run cours",
    ].join("\n"),
  );
  return 0;
}

export function findInPath(cmd, pathEnv, cwd) {
  if (cmd.includes("/") || cmd.startsWith(".")) {
    const full = path.resolve(cwd, cmd);
    if (isExecutable(full)) return full;
    return null;
  }
  const dirs = pathEnv.split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    const full = path.join(dir, cmd);
    if (isExecutable(full)) return full;
  }
  return null;
}

function isExecutable(file) {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    const stat = fs.statSync(file);
    return stat.isFile();
  } catch {
    return false;
  }
}
