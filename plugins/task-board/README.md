# task-board

Barre de tâches au-dessus de la saisie de Claude Code : un mot, un état, un modèle et les tokens par agent, puis le compteur de la session et du projet.

```
◆ TÂCHES   ● 2 en cours   ✔ 1 terminé
🧠 Réponse   ● en cours  opus · high
   ↳ Optimise mes deux mods Claude Code
   ▸ Edit hooks/register.tsx  · étape 4 · 7 outils
   └ 🔭 Compter   ● en cours ↑800 ↓120  sonnet
         ↳ Compter les tests du dépôt
         ▸ Grep "test(" dans plugins  · étape 2 · 3 outils
   └ 🔎 Lister    ✔ terminé  ↑2.1k ↓300  4s · haiku
◆ TOKENS   ↑14k ↓3.8k cache 210k   │   projet demo ↑1.2M ↓140k · 12 sessions
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
- **Tâche en cours** : trois lignes. L'état, puis `↳` l'objectif de la tâche, puis `▸` l'outil du moment avec sa cible (`Read hooks/app.ts`, `Bash claude plugin test…`, `Grep "motif" dans dossier`), l'étape et le nombre d'outils lancés. Une tâche finie se résume à une ligne : durée, modèle, effort.
- **Tokens d'un sous-agent** : `↑` entrée neuve (non cache + écriture en cache), `↓` sortie, sur sa ligne. La ligne principale n'en affiche pas : c'est le compteur de session.
- **Capacité** : quatre tâches au plus, `+N autres` au-delà. Une ligne trop longue pour le terminal est coupée au bord (`…`), jamais cassée sur la suivante.

## Logos

Chaque agent a un logo et une couleur dans la bande : 🧠 la réponse principale, 🔭 Explore, 🧭 Plan, 🤖 general-purpose, 🔎 chercheur, 🔧 implementeur, 🧐 relecteur, 🎼 orchestrateur, 📘 claude-code-guide. Un autre type reçoit un logo stable tiré de son identifiant.

## Compteur de tokens

Une seule ligne `◆ TOKENS` : le compteur de la session. Elle ajoute le total du projet seulement quand d'autres sessions du même dossier existent (sinon ce serait le même chiffre). Elle cumule chaque réponse du modèle (agent principal et sous-agents ensemble, y compris celles d'un tour interrompu ensuite) et la requête de résumé d'une compaction. `cache` est la lecture du cache de prompt, comptée à part : elle se chiffre en millions et masquerait le reste.

- **Session** : repart de son fichier à la reprise (`--resume`), de zéro après `/clear`.
- **Projet** : somme de toutes les sessions du même dossier. Le dossier de stockage porte le nom du projet suivi d'une empreinte de la racine entière : deux dépôts du même nom, ou à un caractère près, ne se mélangent jamais. Les autres sessions sont relues à chaque fin de tour.
- **Changement de dossier** (`/cd`) : le compteur repart de zéro pour le nouveau projet ; ce qui a été dépensé avant reste dans l'ancien.
- **Hors dossier de projet** (espace temporaire de l'app) : la session seule, rien n'est écrit. Sa reprise repart donc de zéro.
- **Limite** : une réponse coupée en plein flux (arrêt pendant que le modèle écrit) peut ne pas être comptée ; le moteur ne rapporte alors pas toujours ses tokens.

## Données

Le seul fichier écrit est le compteur, un par session : `~/.claude/mod-tokens/<projet>-<empreinte>/<id-de-session>.json` (`{input, output, cache, updatedAt}`, des nombres, aucun texte de conversation). Rien ne quitte ta machine. Pour repartir de zéro, supprime ce dossier.

## Tests

```bash
claude plugin test .
```

Vingt-deux tests : les cinq de la barre (attente, terminé puis en cours, tâche principale visible, décalage, agent relancé), l'objectif et l'outil du moment, la cible des outils, les logos, et le compteur de tokens (formatage, clés de projet sans collision, cumul par agent, total projet avec fichier abîmé ignoré, reprise, `/clear`, réponses simultanées, changement de dossier, tour interrompu, compaction, hors projet). Disque et environnement sont simulés : aucun test n'écrit dans ton `~/.claude`.
