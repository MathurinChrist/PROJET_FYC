import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { tokenize, TokenizeError } from "./tokenizer.js";
import { parse, ParseError } from "./parser.js";
import { executeLine } from "./executor.js";
import { buildPrompt } from "./prompt.js";
import { appendHistory, loadHistory } from "./history.js";
import { createCompleter } from "./completer.js";
import { ansi } from "./ansi.js";

export function createContext() {
  const cwd = process.cwd();
  const env = { ...process.env };
  env.PWD = cwd;
  env.HOME = env.HOME || os.homedir();
  env.USER = env.USER || os.userInfo().username;
  env.SHELL = env.SHELL || "nysh";
  env.PATH = env.PATH || "/usr/bin:/bin";

  const historyEntries = loadHistory();

  const ctx = {
    cwd,
    oldPwd: env.OLDPWD || null,
    env,
    lastStatus: 0,
    shouldExit: false,
    exitCode: 0,
    aliases: {
      ll: "ls -al",
    },
    historyEntries,
    runLine: null,
  };

  ctx.runLine = (line) => runLine(line, ctx);
  return ctx;
}

export async function runLine(line, ctx) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return 0;

  try {
    const tokens = tokenize(line);
    if (tokens.length === 0) return 0;
    const ast = parse(tokens);
    return await executeLine(ast, ctx);
  } catch (err) {
    if (err instanceof TokenizeError || err instanceof ParseError) {
      process.stderr.write(`nysh: erreur de syntaxe : ${err.message}\n`);
      ctx.lastStatus = 2;
      return 2;
    }
    process.stderr.write(`nysh: ${err.message}\n`);
    ctx.lastStatus = 1;
    return 1;
  }
}

export async function startShell(args) {
  const ctx = createContext();

  if (args[0] === "-c") {
    const command = args.slice(1).join(" ");
    if (!command) {
      process.stderr.write("nysh: -c : commande manquante\n");
      return 2;
    }
    await runLine(command, ctx);
    return ctx.shouldExit ? ctx.exitCode : ctx.lastStatus;
  }

  if (args[0] && !args[0].startsWith("-")) {
    return runScript(args[0], ctx);
  }

  if (args[0] === "--help" || args[0] === "-h") {
    process.stdout.write(
      "nysh — Node.js Linux Shell\n\n  nysh\n  nysh -c \"commande\"\n  nysh fichier.nysh\n",
    );
    return 0;
  }

  return interactive(ctx);
}

async function runScript(file, ctx) {
  let raw;
  try {
    raw = fs.readFileSync(path.resolve(file), "utf8");
  } catch {
    process.stderr.write(`nysh: ${file} : impossible de lire le fichier\n`);
    return 1;
  }
  for (const line of raw.split(/\r?\n/)) {
    await runLine(line, ctx);
    if (ctx.shouldExit) return ctx.exitCode;
  }
  return ctx.lastStatus;
}

function interactive(ctx) {
  return new Promise((resolve) => {
    const banner = [
      ansi.bold("nysh") + ansi.dim("  —  Node.js Shell  ·  IW 33 & 34"),
      ansi.dim("Tapez ") + ansi.cyan("help") + ansi.dim(" pour l'aide, ") +
        ansi.cyan("exit") + ansi.dim(" pour quitter."),
      "",
    ].join("\n");
    process.stdout.write(banner + "\n");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      completer: createCompleter(ctx),
      history: [...ctx.historyEntries].reverse(),
      prompt: buildPrompt(ctx),
    });

    rl.on("SIGINT", () => {
      process.stdout.write("\n");
      rl.setPrompt(buildPrompt(ctx));
      rl.prompt();
    });

    rl.on("line", async (line) => {
      rl.pause();
      appendHistory(line);
      if (line.trim()) ctx.historyEntries.push(line.trim());
      await runLine(line, ctx);
      if (ctx.shouldExit) {
        cleanup();
        resolve(ctx.exitCode);
        return;
      }
      rl.setPrompt(buildPrompt(ctx));
      rl.resume();
      rl.prompt();
    });

    rl.on("close", () => {
      process.stdout.write("\n");
      cleanup();
      resolve(ctx.lastStatus);
    });

    function cleanup() {
      rl.removeAllListeners("line");
      rl.removeAllListeners("SIGINT");
      try {
        rl.close();
      } catch {
        /* déjà fermé */
      }
    }

    rl.prompt();
  });
}
