/**
 * Analyse lexicale : la ligne de commande devient une liste de tokens.
 *
 * Un token est soit un mot (éventuellement quoté), soit un opérateur
 * du shell : |, ||, &&, ;, &, >, >>, <, 2>, 2>>.
 *
 * Les quotes sont conservées sur le mot pour que l'expansion ($VAR, globs)
 * sache ce qu'elle a le droit de modifier — comme bash.
 */

export const T = {
  WORD: "WORD",
  PIPE: "PIPE",
  AND: "AND",
  OR: "OR",
  SEMI: "SEMI",
  BG: "BG",
  REDIR_OUT: "REDIR_OUT",
  REDIR_APPEND: "REDIR_APPEND",
  REDIR_IN: "REDIR_IN",
  REDIR_ERR: "REDIR_ERR",
  REDIR_ERR_APPEND: "REDIR_ERR_APPEND",
};

export class TokenizeError extends Error {
  constructor(message) {
    super(message);
    this.name = "TokenizeError";
  }
}

export function tokenize(input) {
  const tokens = [];
  const n = input.length;
  let i = 0;

  const peek = (k = 0) => input[i + k];
  const eof = () => i >= n;

  const skipSpaces = () => {
    while (!eof() && /\s/.test(peek())) i += 1;
  };

  while (!eof()) {
    skipSpaces();
    if (eof()) break;

    if (peek() === "#") break;

    if (peek() === "2" && peek(1) === ">") {
      if (peek(2) === ">") {
        tokens.push({ type: T.REDIR_ERR_APPEND });
        i += 3;
      } else {
        tokens.push({ type: T.REDIR_ERR });
        i += 2;
      }
      continue;
    }

    if (peek() === ">" && peek(1) === ">") {
      tokens.push({ type: T.REDIR_APPEND });
      i += 2;
      continue;
    }
    if (peek() === ">") {
      tokens.push({ type: T.REDIR_OUT });
      i += 1;
      continue;
    }
    if (peek() === "<") {
      tokens.push({ type: T.REDIR_IN });
      i += 1;
      continue;
    }
    if (peek() === "|" && peek(1) === "|") {
      tokens.push({ type: T.OR });
      i += 2;
      continue;
    }
    if (peek() === "|") {
      tokens.push({ type: T.PIPE });
      i += 1;
      continue;
    }
    if (peek() === "&" && peek(1) === "&") {
      tokens.push({ type: T.AND });
      i += 2;
      continue;
    }
    if (peek() === "&") {
      tokens.push({ type: T.BG });
      i += 1;
      continue;
    }
    if (peek() === ";") {
      tokens.push({ type: T.SEMI });
      i += 1;
      continue;
    }

    tokens.push(readWord());
  }

  return tokens;

  function readWord() {
    let value = "";
    let inQuote = null;
    let sawUnquoted = false;
    let sawSingle = false;
    let sawDouble = false;

    while (!eof()) {
      const c = peek();

      if (!inQuote && /[\s|;&><]/.test(c)) break;
      if (!inQuote && c === "#") break;

      if (c === "'" && inQuote !== "double") {
        if (inQuote === "single") {
          inQuote = null;
        } else {
          inQuote = "single";
          sawSingle = true;
        }
        i += 1;
        continue;
      }

      if (c === '"' && inQuote !== "single") {
        if (inQuote === "double") {
          inQuote = null;
        } else {
          inQuote = "double";
          sawDouble = true;
        }
        i += 1;
        continue;
      }

      if (c === "\\" && inQuote !== "single") {
        i += 1;
        if (eof()) {
          throw new TokenizeError("backslash en fin de ligne");
        }
        if (!inQuote) sawUnquoted = true;
        value += peek();
        i += 1;
        continue;
      }

      if (!inQuote) sawUnquoted = true;
      value += c;
      i += 1;
    }

    if (inQuote) {
      throw new TokenizeError("guillemet non fermé");
    }

    let quoteKind = null;
    if (!sawUnquoted && sawSingle && !sawDouble) quoteKind = "single";
    else if (!sawUnquoted && sawDouble) quoteKind = "double";

    return { type: T.WORD, value, quoted: quoteKind };
  }
}
