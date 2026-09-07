import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createContext, runLine } from "../src/shell.js";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nysh-"));

function ctxAt(dir = tmp) {
  const ctx = createContext();
  ctx.cwd = dir;
  ctx.env.PWD = dir;
  return ctx;
}

async function capture(line, ctx) {
  const chunks = [];
  const errChunks = [];
  const stdout = process.stdout.write;
  const stderr = process.stderr.write;
  process.stdout.write = (c) => {
    chunks.push(String(c));
    return true;
  };
  process.stderr.write = (c) => {
    errChunks.push(String(c));
    return true;
  };
  try {
    const status = await runLine(line, ctx);
    return {
      status,
      out: chunks.join(""),
      err: errChunks.join(""),
    };
  } finally {
    process.stdout.write = stdout;
    process.stderr.write = stderr;
  }
}

describe("nysh — exécution", () => {
  after(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("pwd et echo", async () => {
    const ctx = ctxAt();
    const pwd = await capture("pwd", ctx);
    assert.equal(pwd.status, 0);
    assert.equal(pwd.out.trim(), tmp);

    const echo = await capture("echo hello world", ctx);
    assert.equal(echo.out, "hello world\n");
  });

  it("cd change le répertoire du shell, pas d'un fils", async () => {
    const ctx = ctxAt();
    const nested = path.join(tmp, "nested");
    fs.mkdirSync(nested);
    await runLine("cd nested", ctx);
    assert.equal(ctx.cwd, fs.realpathSync(nested));
    const pwd = await capture("pwd", ctx);
    assert.equal(pwd.out.trim(), fs.realpathSync(nested));
  });

  it("true && / || respectent le code de retour", async () => {
    const ctx = ctxAt();
    const ok = await capture("true && echo OUI", ctx);
    assert.match(ok.out, /OUI/);
    const no = await capture("false && echo NON", ctx);
    assert.equal(no.out.includes("NON"), false);
    const fallback = await capture("false || echo FALLBACK", ctx);
    assert.match(fallback.out, /FALLBACK/);
  });

  it("redirige stdout vers un fichier", async () => {
    const ctx = ctxAt();
    const file = path.join(tmp, "out.txt");
    await runLine("echo bonjour > out.txt", ctx);
    assert.equal(fs.readFileSync(file, "utf8"), "bonjour\n");
    await runLine("echo encore >> out.txt", ctx);
    assert.equal(fs.readFileSync(file, "utf8"), "bonjour\nencore\n");
  });

  it("pipeline echo | cat", async () => {
    const ctx = ctxAt();
    const status = await runLine("echo hello-pipe | cat > pipe-out.txt", ctx);
    assert.equal(status, 0);
    const content = fs.readFileSync(path.join(tmp, "pipe-out.txt"), "utf8");
    assert.match(content, /hello-pipe/);
  });

  it("export et $VAR", async () => {
    const ctx = ctxAt();
    await runLine("export PROJET=nysh", ctx);
    const res = await capture("echo $PROJET", ctx);
    assert.equal(res.out, "nysh\n");
  });

  it("commande inconnue → 127", async () => {
    const ctx = ctxAt();
    const res = await capture("commande_qui_nexiste_pas", ctx);
    assert.equal(res.status, 127);
  });

  it("quotes simples empêchent l'expansion", async () => {
    const ctx = ctxAt();
    ctx.env.USER = "ada";
    const res = await capture("echo '$USER'", ctx);
    assert.equal(res.out, "$USER\n");
  });
});
