# NYSH — Shell Linux en Node.js

Cours et projet des points **33** et **34** :

> Création d’un Shell Linux avec Node.js : à la découverte de la ligne de commande et du système d’exploitation Linux

## Démarrer

Prérequis : Node.js 18+.

```bash
node src/index.js                 # shell interactif
node src/index.js -c "echo hi"    # une commande
node src/index.js playground/demo.nysh
npm test
npm run cours                     # cours → http://127.0.0.1:3340
```

Dans le shell : `help`, `cd playground`, flèches haut/bas, Tab, Ctrl+C (nouveau prompt), Ctrl+D (quitter).

## Cours

| Séance | Sujet | Support |
| --- | --- | --- |
| 33 | REPL, tokenizer, builtins, PATH / spawn | [cours/SESSION-33.md](cours/SESSION-33.md) |
| 34 | Descripteurs, redirections, pipes, env, signaux | [cours/SESSION-34.md](cours/SESSION-34.md) |

Le site `npm run cours` reprend les deux séances, navigables (flèches ou `j` / `k`). Exercices : [cours/exercices.md](cours/exercices.md).

## Que fait nysh ?

- Prompt `user@host:chemin$`
- Commandes internes : `cd`, `pwd`, `echo`, `export`, `unset`, `env`, `alias`, `type`, `which`, `history`, `source`, `true`, `false`, `help`, `exit`
- Commandes externes via `$PATH`
- Pipes `\|`, redirections `>` `>>` `<` `2>` `2>>`
- `&&` `||` `;` `&`
- `$VAR` `${VAR}` `$?` `$$` `~` globs `*` `?`
- Historique `~/.nysh_history`, complétion Tab

## Architecture

```
ligne tapée
  → src/tokenizer.js
  → src/parser.js
  → src/expander.js
  → src/executor.js   (builtins + spawn)
  → prompt suivant
```

L’état du shell (`cwd`, `env`, aliases, dernier status) vit dans `ctx` (`src/shell.js`). C’est pour ça que `cd` est un builtin : un processus fils ne changerait pas le répertoire du père.

## Tests

21 tests (`node:test`) : tokenizer, expansions, `cd`, `&&`/`||`, redirections, pipeline `echo | cat`.
# PROJET_FYC
