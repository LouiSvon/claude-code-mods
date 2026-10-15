# task-board

Barre de tâches au-dessus de la saisie de Claude Code : un mot, un état, un modèle et les tokens par agent, puis le compteur de la session et du projet.

```
◆ TÂCHES   ● 2 en cours   ✔ 1 terminé
● Réponse    en cours   ↑12k ↓3.4k   opus · high · Read
   └ ✔ Lister  terminé   ↑2.1k ↓300  4s · haiku
   └ ● Compter en cours  ↑800 ↓120   sonnet · Grep
◆ TOKENS   session ↑14k ↓3.8k cache 210k   │   projet demo ↑1.2M ↓140k cache 9.8M · 12 sessions
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
- **Tokens de la ligne** : `↑` entrée neuve (non cache + écriture en cache), `↓` sortie, pour ce tour. `·` tant que l'agent n'a rien dépensé.
- **Fin de ligne** : durée une fois terminé, modèle, effort, puis l'outil en cours tant que la tâche tourne.
- **Capacité** : cinq lignes au plus, `+N autres` au-delà.

## Compteur de tokens

La ligne `◆ TOKENS` cumule chaque réponse du modèle, agent principal et sous-agents ensemble, y compris celles d'un tour interrompu ensuite. `cache` est la lecture du cache de prompt, comptée à part : elle se chiffre en millions et masquerait le reste.

- **Session** : repart de son fichier à la reprise (`--resume`), de zéro après `/clear`.
- **Projet** : somme de toutes les sessions du même dossier (racine complète, deux dépôts du même nom restent distincts). Les autres sessions sont relues à chaque fin de tour.
- Hors dossier de projet (espace temporaire de l'app) : la session seule, rien n'est écrit.

## Données

Le seul fichier écrit est le compteur, un par session : `~/.claude/mod-tokens/<racine-du-projet>/<id-de-session>.json` (`{input, output, cache, updatedAt}`, des nombres, aucun texte de conversation). Rien ne quitte ta machine. Pour repartir de zéro, supprime ce dossier.

## Tests

```bash
claude plugin test .
```

Seize tests : les cinq de la barre (attente, terminé puis en cours, tâche principale visible, décalage, agent relancé) et onze sur les tokens (formatage, cumul par agent, total projet avec fichier abîmé ignoré, reprise, `/clear`, tour interrompu, hors projet). Disque et environnement sont simulés : aucun test n'écrit dans ton `~/.claude`.
