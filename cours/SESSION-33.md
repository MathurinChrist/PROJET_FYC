# Séance 33 — Fonder le shell

**IW** · Création d’un shell Linux avec Node.js  
Durée indicative : 4 h

Cette séance construit un shell qui lit une ligne, la découpe, exécute les commandes internes, et lance les binaires du PATH. Les pipes et redirections sont pour la séance 34.

## 1. Qu’est-ce qu’un shell ?

Le « terminal » empile trois couches : le tty (fenêtre), le shell (bash, zsh, nysh), et les programmes (`ls`, `git`, `node`). `ls` n’est pas une fonction du shell : c’est `/usr/bin/ls`. `cd` en revanche doit être interne, sinon seul un processus fils changerait de dossier.

## 2. Linux vu du terminal

Linux expose le monde comme des fichiers. À retenir : répertoire courant (`PWD`), home (`~`), `PATH`, permissions rwx, environnement hérité par les fils. Le shell transmet les arguments tels quels : il ne « comprend » pas `-la`.

## 3. Processus, fork et exec

Un processus a un PID, un cwd, un env, et les descripteurs 0/1/2. Unix fait `fork` → `exec` → `wait`. Node encapsule cela dans `child_process.spawn`. Code de retour 0 = succès, 127 = commande introuvable.

## 4. Node.js et le système

| Module | Rôle |
| --- | --- |
| `readline` | REPL, Ctrl+C / Ctrl+D |
| `child_process` | binaires |
| `fs` / `path` | cd, fichiers |
| `process` | env, cwd, exit |

Flux : ligne → tokenizer → parser → expander → executor → prompt.

## 5. TP — REPL

`src/shell.js` : `readline.createInterface`, état `ctx` (cwd, env, lastStatus, aliases). Ctrl+D quitte, ligne vide ignorée, `~` dans le prompt si on est dans `$HOME`.

## 6. TP — Tokenizer

Quotes, commentaires `#`, lookahead `|` vs `||`, `>` vs `>>`. Fichier : `src/tokenizer.js`. Tests : `npm test`.

## 7. TP — Builtins

`cd`, `pwd`, `echo`, `export`, `exit`, `help` vivent dans `src/builtins.js`. Vérifier `cd playground && pwd && cd -`.

## 8. TP — Externes

Recherche dans `$PATH`, chemins avec `/`, status 127. `type` et `which` rendent le mécanisme visible. Le fils hérite de `ctx.env`.

## Checklist de fin de séance

- Prompt `user@host:dir$` qui suit `cd`
- Builtins + binaires du PATH
- Quotes simples et doubles
- `nysh: … : commande introuvable` avec code 127

Mini-devoir : expliquer en 8 lignes pourquoi `cd` ne peut pas être `spawn`.
