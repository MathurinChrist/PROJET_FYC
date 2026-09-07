#!/usr/bin/env node
/**
 * Point d'entrée de nysh.
 *
 *   nysh                 → mode interactif (REPL)
 *   nysh -c "echo hi"    → une commande, puis exit
 *   nysh script.nysh     → exécute un fichier ligne à ligne
 */

import { startShell } from "./shell.js";

const args = process.argv.slice(2);

try {
  const code = await startShell(args);
  process.exit(code);
} catch (err) {
  process.stderr.write(`nysh: ${err.message}\n`);
  process.exit(1);
}
