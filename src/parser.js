/**
 * Analyse syntaxique : les tokens deviennent un arbre de commandes.
 *
 * Grammaire (simplifiée, inspirée de POSIX) :
 *
 *   line       := and_or ( (';' | '&') and_or )* [';' | '&']?
 *   and_or     := pipeline ( ('&&' | '||') pipeline )*
 *   pipeline   := command ('|' command)*
 *   command    := word+ redirection*
 *   redirection := ('>' | '>>' | '<' | '2>' | '2>>') word
 */

import { T } from "./tokenizer.js";

export class ParseError extends Error {
  constructor(message) {
    super(message);
    this.name = "ParseError";
  }
}

export function parse(tokens) {
  const stmts = [];
  let i = 0;

  const peek = () => tokens[i];
  const eof = () => i >= tokens.length;
  const eat = (type) => {
    if (!eof() && peek().type === type) {
      i += 1;
      return true;
    }
    return false;
  };

  const skipSeps = () => {
    while (eat(T.SEMI)) {
      /* ignore empty statements */
    }
  };

  skipSeps();
  while (!eof()) {
    if (peek().type === T.BG) {
      throw new ParseError("opérateur & inattendu");
    }
    const andOr = parseAndOr();
    const background = eat(T.BG);
    stmts.push({ ...andOr, background });
    if (eat(T.SEMI)) {
      skipSeps();
      continue;
    }
    if (!eof() && !background) {
      if (peek().type === T.BG) continue;
      throw new ParseError(`token inattendu : ${peek().type}`);
    }
  }

  return stmts;

  function parseAndOr() {
    const pipelines = [{ pipeline: parsePipeline(), op: null }];
    while (!eof() && (peek().type === T.AND || peek().type === T.OR)) {
      const op = peek().type === T.AND ? "&&" : "||";
      i += 1;
      pipelines.push({ pipeline: parsePipeline(), op });
    }
    return { kind: "and_or", pipelines };
  }

  function parsePipeline() {
    const commands = [parseCommand()];
    while (eat(T.PIPE)) {
      commands.push(parseCommand());
    }
    return commands;
  }

  function parseCommand() {
    const words = [];
    const redirs = [];

    while (!eof()) {
      const t = peek();
      if (t.type === T.WORD) {
        words.push(t);
        i += 1;
        continue;
      }
      const redirType = redirFromToken(t.type);
      if (redirType) {
        i += 1;
        if (eof() || peek().type !== T.WORD) {
          throw new ParseError(`fichier manquant après ${redirType}`);
        }
        redirs.push({ type: redirType, target: peek() });
        i += 1;
        continue;
      }
      break;
    }

    if (words.length === 0 && redirs.length === 0) {
      throw new ParseError("commande vide");
    }
    if (words.length === 0) {
      throw new ParseError("redirection sans commande");
    }

    return { words, redirs };
  }
}

function redirFromToken(type) {
  switch (type) {
    case T.REDIR_OUT:
      return ">";
    case T.REDIR_APPEND:
      return ">>";
    case T.REDIR_IN:
      return "<";
    case T.REDIR_ERR:
      return "2>";
    case T.REDIR_ERR_APPEND:
      return "2>>";
    default:
      return null;
  }
}
