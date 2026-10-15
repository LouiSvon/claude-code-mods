# task-board

Barre de tâches au-dessus de la saisie de Claude Code : un mot, un état, un modèle et les tokens par agent, puis le compteur de la session et du projet.

```
◆ TÂCHES   ● 2 en cours   ✔ 1 terminé
● Réponse   en cours   opus · high
  ↳ Optimise mes deux mods Claude Code
  ▸ Edit hooks/register.tsx  · étape 4 · 7 outils
   └ ● Compter  en cours ↑800 ↓120  sonnet
        ↳ Compter les tests du dépôt
        ▸ Grep "test(" dans plugins  · étape 2 · 3 outils
   └ ✔ Lister   terminé  ↑2.1k ↓300  4s · haiku
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

## Panneau d'activité

Sur l'app de bureau, un panneau étroit (44 colonnes) s'ouvre tout seul à droite et y reste, pour voir ce que fait Claude en détail sans alourdir la bande. Sur un terminal simple il s'ouvre à la demande avec `/activite` (il prendrait des lignes de la conversation). La même commande le rouvre après fermeture.

```
◆ ACTIVITÉ  ● 2  ✔ 1  14 outils
🧠 Réponse  ● en cours
   ↳ Optimise mes deux mods
   ▸ Edit hooks/register.tsx
   ● ● ● ● ● étape 4 · 7 outils
   └ 🔭 Lister  ✔ terminé  4s · haiku
      ↳ Lister les fichiers du dossier
      ● ● ● étape 2 · 3 outils
◆ JOURNAL
14:03:09 🔭 ✔ Read src/app.ts  80ms
14:03:08 🧠 ⇢ lance Lister
── 14:03:05 ── Optimise mes deux mods
```

- **Un logo et une couleur par agent** : 🧠 la réponse principale, 🔭 Explore, 🧭 Plan, 🤖 general-purpose, 🔎 chercheur, 🔧 implementeur, 🧐 relecteur, 🎼 orchestrateur, 📘 claude-code-guide. Un agent d'un autre type reçoit un logo stable tiré de son identifiant. Le logo et la couleur se retrouvent dans la bande, la liste et le journal.
- **Agents** : toutes les tâches (la bande en montre quatre), avec objectif (`↳`), outil du moment (`▸`), étape, nombre d'outils et tokens des sous-agents. Une rangée de points montre les dix derniers outils de l'agent : vert réussi, orange en cours, rouge refusé ou en erreur.
- **Journal** : les 300 derniers événements, le plus récent en haut. Une ligne par demande (`── 14:03:09 ──`), par agent lancé (`⇢`), par outil (`▸` en cours, `✔`, `✖`, avec sa cible et sa durée) et par fin de tâche.
- Le journal vit en mémoire de la session : il n'est pas écrit sur disque.

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

Vingt-sept tests : les cinq de la barre (attente, terminé puis en cours, tâche principale visible, décalage, agent relancé) et vingt-deux sur les tokens, l'activité et le panneau (formatage, clés de projet sans collision, cumul par agent, total projet avec fichier abîmé ignoré, reprise, `/clear`, réponses simultanées, changement de dossier, tour interrompu, compaction, hors projet). Disque et environnement sont simulés : aucun test n'écrit dans ton `~/.claude`.
