# Séance 34 — Un vrai shell

**IW** · Création d’un shell Linux avec Node.js  
Durée indicative : 4 h

On reprend le même dépôt. Cette séance recable les descripteurs de fichiers : redirections, pipes, environnement, opérateurs de contrôle, signaux.

## 1. Carte du code

- `parser.js` — grammaire : ligne, and_or, pipeline, redirections
- `expander.js` — `$VAR`, `$?`, `~`, globs
- `executor.js` — fd, pipes, spawn
- `history.js` / `completer.js` — confort tty

On parse la structure **avant** d’expanser les mots (sinon un `|` dans une variable casserait le pipeline).

## 2. Descripteurs 0, 1, 2

stdin, stdout, stderr. Rediriger = substituer un fichier ou un pipe à l’un de ces fd **avant** d’exécuter. Le programme, lui, écrit toujours sur 1.

## 3. Redirections

`>` `>>` `<` `2>` `2>>`. On `openSync` le fichier et on passe le fd numérique à `spawn`. Ne pas fermer le descripteur avant la fin du fils.

## 4. Pipes

`echo hello-pipe | cat` : stdout de gauche = écriture, stdin de droite = lecture. Lancer les étages **en parallèle** pour éviter un deadlock. Un builtin dans un pipe doit appeler `.end()` (EOF).

## 5. Environnement et expansions

Ordre : variables → tilde → globbing (hors quotes). `export` / `unset` mutent `ctx.env`, transmis au `spawn`. Quotes simples = littéral ; doubles = expansion des `$`.

## 6. Opérateurs

| Opérateur | Sens |
| --- | --- |
| `;` | toujours |
| `&&` | si status == 0 |
| `\|\|` | si status != 0 |
| `&` | arrière-plan |

`true` et `false` existent pour enseigner le status, pas le texte affiché.

## 7. Signaux, historique, complétion

Ctrl+C : nouveau prompt, pas d’exit. Ctrl+D : quitter. Historique dans `~/.nysh_history`. Tab : builtins + PATH ou fichiers. Alias `ll=ls -al`.

## 8. TP final

Jouer le scénario de `playground/demo.nysh` **dans nysh**, puis `node src/index.js playground/demo.nysh`.

## 9. Au-delà

Non couvert (volontairement) : `if`/`for`, job control, `$(( ))`, `$(...)`, `2>&1`. Le critère de réussite : expliquer chaque caractère de `ls | grep js > out && echo ok`.
