import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tokenize, T } from "../src/tokenizer.js";
import { parse } from "../src/parser.js";

function ast(line) {
  return parse(tokenize(line));
}

describe("tokenizer", () => {
  it("découpe une commande simple", () => {
    const tokens = tokenize("ls -la /tmp");
    assert.equal(tokens.length, 3);
    assert.equal(tokens[0].value, "ls");
    assert.equal(tokens[1].value, "-la");
  });

  it("reconnaît pipes, &&, || et redirections", () => {
    const types = tokenize("echo hi | cat >> out.txt && true || false 2> err").map(
      (t) => t.type,
    );
    assert.deepEqual(types, [
      T.WORD,
      T.WORD,
      T.PIPE,
      T.WORD,
      T.REDIR_APPEND,
      T.WORD,
      T.AND,
      T.WORD,
      T.OR,
      T.WORD,
      T.REDIR_ERR,
      T.WORD,
    ]);
  });

  it("conserve le contenu entre quotes", () => {
    const tokens = tokenize(`echo "hello world" 'a b'`);
    assert.equal(tokens[1].value, "hello world");
    assert.equal(tokens[1].quoted, "double");
    assert.equal(tokens[2].value, "a b");
    assert.equal(tokens[2].quoted, "single");
  });

  it("ignore les commentaires", () => {
    const tokens = tokenize("pwd # où suis-je");
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].value, "pwd");
  });
});

describe("parser", () => {
  it("construit un pipeline", () => {
    const tree = ast("ls | grep js | wc -l");
    assert.equal(tree[0].pipelines[0].pipeline.length, 3);
  });

  it("enchaîne && et ||", () => {
    const tree = ast("true && echo ok || echo ko");
    assert.equal(tree[0].pipelines.length, 3);
    assert.equal(tree[0].pipelines[1].op, "&&");
    assert.equal(tree[0].pipelines[2].op, "||");
  });

  it("attache les redirections à la commande", () => {
    const cmd = ast("cat < in.txt > out.txt 2> err.txt")[0].pipelines[0].pipeline[0];
    assert.equal(cmd.words[0].value, "cat");
    assert.equal(cmd.redirs.length, 3);
    assert.equal(cmd.redirs[0].type, "<");
    assert.equal(cmd.redirs[1].type, ">");
    assert.equal(cmd.redirs[2].type, "2>");
  });
});
