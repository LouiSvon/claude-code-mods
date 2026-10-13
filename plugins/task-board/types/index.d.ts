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
}

declare module 'claude-code' {
  interface PluginState {
    'task-board': { rows: Row[] }
  }
}
