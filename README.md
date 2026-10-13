# claude-code-mods

Deux mods pour l'app Claude Code, qui rendent le travail des agents lisible d'un coup d'oeil.

```
◆ TÂCHES   2 en cours   1 terminé
● Réponse          en cours   opus · high
   └ ✔ Lister       terminé    haiku
   └ ● Compter      en cours   sonnet · Read
┌──────────────────────────────────────────────┐
│ Tapez / pour les commandes.                  │
└──────────────────────────────────────────────┘
 Contexte ▓▓░░░░░░ 19% │ 5h 21% ↻4h25 │ Semaine 33% ↻5j
```

## Les mods

| Mod | Rôle | Où ça s'affiche |
| --- | --- | --- |
| [`task-board`](plugins/task-board) | Une ligne par tâche : un mot, un état coloré, le modèle et l'effort. Les sous-agents sont décalés sous leur parent. | Au-dessus de la saisie |
| [`statusline-app`](plugins/statusline-app) | Contexte, limite des 5 heures et limite de la semaine, avec le temps avant le reset. | Sous la saisie |

### task-board

- **Un mot par tâche** : le premier mot utile de la description de l'agent (« Lister », « Compter », « Relire »). La demande principale s'appelle « Réponse ».
- **Un état en couleur** : `●` bleu en cours, `✔` vert terminé, `✖` rouge erreur, `■` gris arrêté.
- **La hiérarchie se voit** : un sous-agent est décalé de trois colonnes avec un trait `└`, un agent lancé par un sous-agent d'autant de plus.
- **Ce que fait l'agent maintenant** : l'outil en cours (`Read`, `Grep`, ...) s'ajoute à la ligne tant que la tâche tourne.
- **Propre à chaque demande** : le tableau repart de zéro à chaque nouveau message, sauf les agents encore en cours. Un agent relancé plus tard retrouve sa ligne.

### statusline-app

- Jauge de contexte `▓░`, limite 5 h et limite de la semaine avec leur reset (`↻4h25`, `↻5j`).
- Le dossier de la session, seulement s'il existe, et un rappel `/clear conseillé` au-delà de 60 % de contexte.
- Sur le terminal, le mod ne fait rien : la ligne d'état du shell reste la tienne.

## Installation

Dans une session `claude` d'un terminal :

```
/plugin install task-board --marketplace LouiSvon/claude-code-mods
/plugin install statusline-app --marketplace LouiSvon/claude-code-mods
```

Réponds `y` à « Add marketplace? », puis choisis la portée. Un mod installé au niveau utilisateur se charge ensuite dans chaque session, y compris celles de l'app de bureau. La commande `/plugin install` elle-même n'existe pas dans l'onglet Code de l'app : installe depuis un terminal.

> Le manifeste du marketplace passe `claude plugin validate`. L'installation depuis GitHub n'a pas encore été essayée sur une machine vierge.

### Essayer sans installer

```bash
git clone https://github.com/LouiSvon/claude-code-mods.git
cd claude-code-mods
claude --plugin-dir "$PWD/plugins/task-board" --plugin-dir "$PWD/plugins/statusline-app"
```

`--plugin-dir` charge un mod depuis son dossier pour la durée de la session. Il est répétable : un drapeau par mod.

## Comment ça marche

Chaque mod est un module de hooks, sans dépendance. Aucun ne lit ni n'envoie de donnée hors de la session.

| Événement | Ce que fait `task-board` |
| --- | --- |
| `turn.start` | Crée la ligne « Réponse », retire les tâches terminées du tour précédent. |
| `agent.spawn` | Ajoute une ligne avec l'objectif, le type, le modèle et la profondeur. |
| `turn.step` | Met à jour le modèle et l'effort réels, remet en cours un agent relancé. |
| `tool.call` | Affiche l'outil en cours. |
| `turn.complete` | Passe la tâche en terminé, erreur ou arrêté, avec sa durée. |
| `ui.render` (`AbovePrompt`) | Dessine la barre. |

`statusline-app` recalcule sa ligne à `session.start`, `turn.step` et `turn.complete`, puis l'épingle avec `$.ui.status`.

## Limites connues

- **La ligne d'état est du texte simple.** L'app de bureau ne dessine pas d'arbre coloré sous la saisie : `statusline-app` utilise donc la ligne de statut du moteur, sans couleur.
- **Le décalage sur trois niveaux** (agent, sous-agent, petit-agent) est testé avec des événements simulés, pas avec de vrais agents imbriqués.
- **Les types** viennent du moteur : le dossier `.claude-plugin/types/` est généré au premier chargement d'un mod et n'est pas versionné. `tsc -p plugins/<mod>` ne fonctionne qu'après ce premier chargement.
- L'API des mods est en accès anticipé : elle peut changer entre deux versions de Claude Code.

## Développement

```bash
claude plugin validate plugins/task-board
claude plugin test plugins/task-board        # 5 tests
claude plugin test plugins/statusline-app    # 4 tests
```

Les tests montent le rendu avec le moteur de test de Claude Code (`claude-code/testing`) et simulent les événements. Chaque défaut corrigé a son test.

## Licence

[MIT](LICENSE)
