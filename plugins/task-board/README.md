# task-board

Barre de tâches au-dessus de la saisie de Claude Code : un mot, un état et un modèle par agent.

```
◆ TÂCHES   2 en cours   1 terminé
● Réponse          en cours   opus · high
   └ ✔ Lister       terminé    haiku
   └ ● Compter      en cours   sonnet · Read
```

## Installation

```
/plugin install task-board --marketplace LouiSvon/claude-code-mods
```

## Lecture de la barre

| Marque | Couleur | Sens |
| --- | --- | --- |
| `●` | bleu | en cours |
| `✔` | vert | terminé |
| `✖` | rouge | erreur |
| `■` | gris | arrêté |

- **Mot** : premier mot utile de la description de l'agent, en 12 caractères au plus. « Réponse » désigne la demande principale.
- **Décalage** : `└` marque un sous-agent, décalé de trois colonnes par niveau.
- **Fin de ligne** : modèle, effort, puis l'outil en cours tant que la tâche tourne.
- **Capacité** : cinq lignes au plus, `+N autres` au-delà.

## Données

Rien n'est écrit sur disque et rien ne quitte la session. L'état vit dans `$.state`, propre à la session.

## Tests

```bash
claude plugin test .
```

Cinq tests : barre d'attente, passage terminé puis en cours, tâche principale toujours visible, décalage des sous-agents, agent relancé après le nettoyage d'un tour.
