import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { expandVars, expandTilde, expandWord } from "../src/expander.js";

const ctx = {
  cwd: "/tmp",
  env: { HOME: "/home/etudiant", USER: "ada", EMPTY: "" },
  lastStatus: 7,
};

describe("expansions", () => {
  it("remplace $VAR et ${VAR}", () => {
    assert.equal(expandVars("hello $USER", ctx), "hello ada");
    assert.equal(expandVars("home=${HOME}/bin", ctx), "home=/home/etudiant/bin");
  });

  it("expose $? et $$", () => {
    assert.equal(expandVars("code=$?", ctx), "code=7");
    assert.equal(expandVars("$$", ctx), String(process.pid));
  });

  it("n'expanse pas une variable inconnue en texte magique", () => {
    assert.equal(expandVars("$NOPE", ctx), "");
  });

  it("déplie le tilde", () => {
    assert.equal(expandTilde("~", ctx), "/home/etudiant");
    assert.equal(expandTilde("~/docs", ctx), "/home/etudiant/docs");
  });

  it("respecte les quotes simples", () => {
    const out = expandWord({ value: "$USER", quoted: "single" }, ctx);
    assert.deepEqual(out, ["$USER"]);
  });

  it("expanse dans les doubles quotes sans globber", () => {
    const out = expandWord({ value: "hi $USER", quoted: "double" }, ctx);
    assert.deepEqual(out, ["hi ada"]);
  });
});
