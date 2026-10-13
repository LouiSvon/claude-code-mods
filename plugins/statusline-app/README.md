# statusline-app

Ligne d'état sous la saisie de l'app Claude Code : contexte, limite des 5 heures et limite de la semaine.

```
Contexte ▓▓░░░░░░ 19% │ 5h 21% ↻4h25 │ Semaine 33% ↻5j
```

## Installation

```
/plugin install statusline-app --marketplace LouiSvon/claude-code-mods
```

## Contenu de la ligne

- **Dossier** de la session, seulement s'il existe.
- **Contexte** : jauge de huit crans et pourcentage.
- **5h** et **Semaine** : pourcentage utilisé et temps avant le reset. Ces deux champs n'apparaissent que si ton abonnement les expose.
- **`/clear conseillé`** au-delà de 60 % de contexte.

Le modèle n'est pas affiché : l'app l'affiche déjà à côté de la saisie.

## Comportement

- Sur le terminal, le mod ne fait rien : la ligne d'état du shell reste en place.
- La ligne est du texte simple, sans couleur : l'app de bureau ne dessine pas d'arbre coloré à cet endroit.
- Elle est recalculée à `session.start`, `turn.step` et `turn.complete`. Une lecture qui échoue est ignorée, sans casser le tour.

## Tests

```bash
claude plugin test .
```

Quatre tests : jauge et teintes, dossier réel ou non, temps avant reset, ligne épinglée par la session.
