/**
 * Exécuteur : parcourt l'AST, branche les flux, lance les processus.
 *
 * Idée centrale de Linux : tout est un descripteur de fichier.
 * Un pipe, un fichier, le terminal — pour le processus, c'est stdin/stdout/stderr.
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { PassThrough, Writable } from "node:stream";
import { expandWord } from "./expander.js";
import { findInPath, isBuiltin, runBuiltin } from "./builtins.js";

export async function executeLine(ast, ctx) {
  let status = 0;
  for (const stmt of ast) {
    status = await executeAndOr(stmt.pipelines, ctx, stmt.background);
    ctx.lastStatus = status;
  }
  return status;
}

async function executeAndOr(pipelines, ctx, background) {
  let status = 0;
  for (const item of pipelines) {
    if (item.op === "&&" && status !== 0) continue;
    if (item.op === "||" && status === 0) continue;
    if (background) {
      executePipeline(item.pipeline, ctx)
        .then((code) => {
          process.stderr.write(`[terminé] status=${code}\n`);
        })
        .catch((err) => {
          process.stderr.write(`nysh: ${err.message}\n`);
        });
      status = 0;
    } else {
      status = await executePipeline(item.pipeline, ctx);
    }
  }
  return status;
}

async function executePipeline(commands, ctx) {
  const expanded = commands.map((cmd) => expandCommand(cmd, ctx));
  if (expanded.length === 1) {
    return runCommand(expanded[0], ctx, process.stdin, process.stdout, process.stderr);
  }

  const pipes = Array.from({ length: expanded.length - 1 }, () => new PassThrough());
  const runs = expanded.map((cmd, idx) => {
    const stdin = idx === 0 ? process.stdin : pipes[idx - 1];
    const stdout = idx === expanded.length - 1 ? process.stdout : pipes[idx];
    return runCommand(cmd, ctx, stdin, stdout, process.stderr, {
      endStdout: idx < expanded.length - 1,
    });
  });
  const codes = await Promise.all(runs);
  return codes[codes.length - 1];
}

function expandCommand(cmd, ctx) {
  const argv = [];
  for (const word of cmd.words) {
    argv.push(...expandWord(word, ctx));
  }

  if (argv.length > 0 && ctx.aliases[argv[0]]) {
    const aliasValue = ctx.aliases[argv[0]];
    const rest = argv.slice(1);
    const aliased = aliasValue.split(/\s+/).filter(Boolean);
    argv.splice(0, argv.length, ...aliased, ...rest);
  }

  const redirs = cmd.redirs.map((r) => ({
    type: r.type,
    target: expandWord(r.target, ctx)[0],
  }));

  return { argv, redirs };
}

function openRedirs(redirs, cwd) {
  const fds = [];
  const streams = { stdin: null, stdout: null, stderr: null };

  for (const redir of redirs) {
    const file = path.resolve(cwd, redir.target);
    if (redir.type === "<") {
      const fd = fs.openSync(file, "r");
      fds.push(fd);
      streams.stdin = fd;
    } else if (redir.type === ">") {
      const fd = fs.openSync(file, "w");
      fds.push(fd);
      streams.stdout = fd;
    } else if (redir.type === ">>") {
      const fd = fs.openSync(file, "a");
      fds.push(fd);
      streams.stdout = fd;
    } else if (redir.type === "2>") {
      const fd = fs.openSync(file, "w");
      fds.push(fd);
      streams.stderr = fd;
    } else if (redir.type === "2>>") {
      const fd = fs.openSync(file, "a");
      fds.push(fd);
      streams.stderr = fd;
    }
  }

  return { fds, streams };
}

function closeFds(fds) {
  for (const fd of fds) {
    try {
      fs.closeSync(fd);
    } catch {
      /* déjà fermé par le processus fils */
    }
  }
}

async function runCommand(cmd, ctx, stdin, stdout, stderr, opts = {}) {
  const { argv, redirs } = cmd;
  if (argv.length === 0) return 0;

  if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[0]) && argv.length === 1) {
    const eq = argv[0].indexOf("=");
    ctx.env[argv[0].slice(0, eq)] = argv[0].slice(eq + 1);
    return 0;
  }

  const name = argv[0];
  let opened;
  try {
    opened = openRedirs(redirs, ctx.cwd);
  } catch (err) {
    const target = redirs[0]?.target ?? "";
    const msg = err.code === "ENOENT"
      ? `nysh: ${target} : fichier introuvable\n`
      : `nysh: ${err.message}\n`;
    stderr.write(msg);
    return 1;
  }

  const inFd = opened.streams.stdin;
  const outFd = opened.streams.stdout;
  const errFd = opened.streams.stderr;

  try {
    if (isBuiltin(name)) {
      const io = {
        stdin: inFd !== null ? fs.createReadStream(null, { fd: inFd, autoClose: false }) : stdin,
        stdout: writableFrom(outFd, stdout),
        stderr: writableFrom(errFd, stderr),
      };
      const status = await Promise.resolve(runBuiltin(name, argv, ctx, io));
      await endIfNeeded(io.stdout, outFd !== null || opts.endStdout);
      await endIfNeeded(io.stderr, errFd !== null);
      return status;
    }

    const file = findInPath(name, ctx.env.PATH || "", ctx.cwd);
    if (!file) {
      const errOut = writableFrom(errFd, stderr);
      errOut.write(`nysh: ${name} : commande introuvable\n`);
      if (opts.endStdout && stdout !== process.stdout) stdout.end();
      return 127;
    }

    const stdio = [
      inFd !== null ? inFd : stdioFrom(stdin),
      outFd !== null ? outFd : stdioFrom(stdout),
      errFd !== null ? errFd : stdioFrom(stderr),
    ];

    return await spawnExternal(file, argv.slice(1), ctx, stdio, { stdin, stdout, stderr });
  } finally {
    closeFds(opened.fds);
  }
}

function stdioFrom(stream) {
  if (stream === process.stdin || stream === process.stdout || stream === process.stderr) {
    return "inherit";
  }
  return "pipe";
}

function writableFrom(fd, fallback) {
  if (fd !== null) {
    return fs.createWriteStream(null, { fd, autoClose: false });
  }
  return fallback;
}

async function endIfNeeded(stream, shouldEnd) {
  if (!shouldEnd) return;
  if (stream === process.stdout || stream === process.stderr) return;
  if (!(stream instanceof Writable)) return;
  if (stream.writableEnded || stream.destroyed) return;
  await new Promise((resolve) => stream.end(resolve));
}

function spawnExternal(file, args, ctx, stdio, streams) {
  return new Promise((resolve) => {
    const child = spawn(file, args, {
      cwd: ctx.cwd,
      env: ctx.env,
      stdio,
    });

    if (child.stdin && stdio[0] === "pipe") {
      streams.stdin.pipe(child.stdin);
    }
    if (child.stdout && stdio[1] === "pipe") {
      child.stdout.pipe(streams.stdout, { end: streams.stdout !== process.stdout });
    }
    if (child.stderr && stdio[2] === "pipe") {
      child.stderr.pipe(streams.stderr, { end: streams.stderr !== process.stderr });
    }

    child.on("error", (err) => {
      process.stderr.write(`nysh: ${err.message}\n`);
      resolve(127);
    });

    child.on("close", (code, signal) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve(signal ? 128 : code ?? 1);
      };

      if (child.stdout && stdio[1] === "pipe" && streams.stdout !== process.stdout) {
        if (streams.stdout.writableFinished || streams.stdout.destroyed) {
          done();
        } else {
          streams.stdout.once("finish", done);
          streams.stdout.once("error", done);
        }
      } else {
        done();
      }
    });
  });
}
