export type Totals = { input: number; output: number; cache: number }

export type Row = {
  id: string
  goal: string
  type: string
  model: string
  effort: string
  status: 'running' | 'done' | 'error' | 'aborted'
  action: string
  steps: number
  depth: number
  durationMs?: number
  // Cible du dernier outil appele, et nombre d'outils lances (absents sur une ancienne ligne).
  detail?: string
  tools?: number
  // Absent sur les lignes ecrites par une ancienne version.
  usage?: Totals
}

// Une ligne du journal d'activite (panneau) : un outil, un agent lance, une fin de tache, une demande.
export type Entry = {
  id: string
  at: number
  who: string
  depth: number
  kind: 'prompt' | 'agent' | 'tool' | 'end'
  text: string
  detail: string
  state: 'run' | 'ok' | 'err'
  ms?: number
}

// Compteur de la session et du projet ; `others` = les autres sessions du meme projet.
export type Tally = {
  session: Totals
  others: Totals
  sessions: number
  project: string
}

declare module 'claude-code' {
  interface PluginState {
    'task-board': { rows: Row[]; tally: Tally; journal: Entry[] }
  }
}
