import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Row } from '../types'

const rows = atom({ plugin: 'task-board', key: 'rows' } as const, [])
const MAIN = 'main'
const MAX_ROWS = 5
const BLUE = '#4da3ff'

const short = (text: string, n: number) => {
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length > n ? `${one.slice(0, n - 1)}...` : one
}

const SKIP = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'l', 'et', 'a'])

// Un seul mot simple : le premier mot utile de la description (un verbe en general).
const label = (row: Row) => {
  if (row.id === MAIN) return 'Réponse'
  const words = row.goal.split(/[^\p{L}\p{N}]+/u).filter(w => w !== '')
  const word = words.find(w => w.length > 2 && !SKIP.has(w.toLowerCase())) ?? words[0] ?? row.type
  return (word.charAt(0).toUpperCase() + word.slice(1)).slice(0, 12)
}

// "claude-haiku-5-5" devient "haiku".
const modelName = (model: string) => /^(?:claude-)?([a-z]+)/.exec(model)?.[1] ?? model

const patch = (id: string, fn: (row: Row) => Partial<Row>) => (list: Row[]) =>
  list.map(row => (row.id === id ? { ...row, ...fn(row) } : row))

// La ligne principale reste toujours ; on borne seulement les sous-agents.
const cap = (list: Row[]) => {
  const main = list.filter(r => r.id === MAIN)
  const others = list.filter(r => r.id !== MAIN).slice(-59)
  return [...main, ...others]
}

let model = ''
let effort = ''

const LOOK = {
  running: { color: BLUE, icon: '●', text: 'en cours' },
  done: { color: 'success', icon: '✔', text: 'terminé' },
  error: { color: 'error', icon: '✖', text: 'erreur' },
  aborted: { color: 'inactive', icon: '■', text: 'arrêté' },
} as const

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // Une ancienne version epinglait une ligne de statut : un rechargement l'efface.
    $.ui.status(undefined)

    return next(e)
  })

  // Nouvelle demande : on repart d'un tableau propre, sans les taches du tour d'avant.
  on('turn.start', async ($, e, next) => {
    const main: Row = {
      id: MAIN,
      goal: short(e.text || 'Suite de la tache', 90),
      type: 'principal',
      model,
      effort,
      status: 'running',
      action: 'reflexion',
      steps: 0,
      depth: 0,
    }
    await update($, rows, list => [
      main,
      ...list.filter(r => r.id !== MAIN && r.status === 'running'),
    ])

    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.deny !== undefined || started.agentId === undefined) return started

    const row: Row = {
      id: started.agentId,
      goal: short(e.description || e.prompt, 90),
      type: e.subagentType,
      model: started.model,
      effort: '',
      status: 'running',
      action: 'demarrage',
      steps: 0,
      depth: 1,
    }
    await update($, rows, list => {
      const parent = list.find(r => r.id === e.parentAgentId)
      return cap([...list, { ...row, depth: parent === undefined ? 1 : parent.depth + 1 }])
    })

    return started
  })

  // Chaque requete fixe le modele et l'effort reels ; un agent relance repasse en cours.
  on('turn.step', async function* ($, e, next) {
    const id = e.agentId ?? MAIN
    if (id === MAIN) {
      model = e.model
      effort = e.effort === undefined ? '' : String(e.effort)
    } else if (!(await read($, rows)).some(r => r.id === id)) {
      // Agent relance apres le nettoyage d'un tour : on recree sa ligne depuis le moteur.
      const info = (await $.agent.list()).find(a => a.id === id)
      if (info !== undefined) {
        await update($, rows, list =>
          list.some(r => r.id === id)
            ? list
            : cap([
                ...list,
                {
                  id,
                  goal: short(info.description || info.type, 90),
                  type: info.type,
                  model: e.model,
                  effort: '',
                  status: 'running',
                  action: 'reflexion',
                  steps: 0,
                  depth: (list.find(r => r.id === info.parentId)?.depth ?? 0) + 1,
                },
              ]),
        )
      }
    }
    await update(
      $,
      rows,
      patch(id, row => ({
        model: e.model,
        effort: e.effort === undefined ? '' : String(e.effort),
        steps: row.steps + 1,
        action: 'reflexion',
        status: 'running',
        durationMs: undefined,
      })),
    )

    return yield* next(e)
  })

  on('tool.call', async ($, e, next) => {
    const id = e.agentId ?? MAIN
    await update($, rows, patch(id, () => ({ action: e.tool })))

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const id = e.agentId ?? MAIN
    const status: Row['status'] =
      e.reason === 'answer' ? 'done' : e.reason === 'aborted' ? 'aborted' : 'error'
    await update($, rows, patch(id, () => ({ status, action: '', durationMs: e.durationMs })))

    return next(e)
  })

  // Une ligne par tache, un mot, un etat : lisible d'un coup d'oeil.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, rows)
    const count = (s: Row['status']) => list.filter(r => r.status === s).length
    const running = count('running')
    const done = count('done')
    const failed = count('error') + count('aborted')

    const main = list.filter(r => r.id === MAIN)
    const others = list.filter(r => r.id !== MAIN)
    const shown = [...main, ...others.slice(-(MAX_ROWS - main.length))]
    const hidden = list.length - shown.length

    return (
      <Box flexDirection="column">
        <Box>
          <Text color={BLUE} bold>◆ TÂCHES</Text>
          {list.length === 0 && <Text dimColor>   aucune pour l'instant</Text>}
          {running > 0 && <Text color={LOOK.running.color}>   {running} en cours</Text>}
          {done > 0 && <Text color={LOOK.done.color}>   {done} terminé{done > 1 ? 's' : ''}</Text>}
          {failed > 0 && <Text color={LOOK.error.color}>   {failed} échec{failed > 1 ? 's' : ''}</Text>}
        </Box>
        {shown.map(row => {
          const look = LOOK[row.status]
          const extra = [modelName(row.model), row.effort, row.status === 'running' ? row.action : '']
            .filter(p => p !== '')
            .join(' · ')
          const indent = row.depth * 3

          return (
            <Box key={row.id} paddingLeft={indent}>
              {row.depth > 0 && <Text dimColor>└ </Text>}
              <Text color={look.color} bold>{look.icon} </Text>
              <Box width={Math.max(8, 16 - indent)}>
                <Text bold={row.status === 'running'} dimColor={row.status === 'done'}>{label(row)}</Text>
              </Box>
              <Box width={11}><Text color={look.color}>{look.text}</Text></Box>
              <Text dimColor>{extra}</Text>
            </Box>
          )
        })}
        {hidden > 0 && <Text dimColor>  +{hidden} autres</Text>}
      </Box>
    )
  })
}
