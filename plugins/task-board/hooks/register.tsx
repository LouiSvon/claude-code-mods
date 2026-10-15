import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Entry, Row, Tally } from '../types'
import { clock, describe, logoOf, span, tintOf } from './activity'
import { ZERO, add, dur, fmt, folderName, fromUsage, isScratch, parseTotals, projectKey } from './tokens'

const rows = atom({ plugin: 'task-board', key: 'rows' } as const, [])
const EMPTY: Tally = { session: ZERO, others: ZERO, sessions: 0, project: '' }
const tally = atom({ plugin: 'task-board', key: 'tally' } as const, EMPTY)
const journal = atom({ plugin: 'task-board', key: 'journal' } as const, [])
const MAIN = 'main'
const PANE = 'activite'
const PANE_OPEN = { id: PANE, title: 'Activité', columns: 44, rows: 16 }
const MAX_ROWS = 4
const BLUE = '#4da3ff'
const CYAN = '#4dd4d4'
const ORANGE = '#ff9f43'
const VIOLET = '#b08cff'

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

// Journal du panneau : les 300 derniers evenements, du plus ancien au plus recent.
const note = ($: any, entry: Entry) => update($, journal, list => [...list, entry].slice(-300))
const mark = ($: any, id: string, change: Partial<Entry>) =>
  update($, journal, list => list.map(x => (x.id === id ? { ...x, ...change } : x)))
const whoOf = (list: Row[], id: string) => {
  const row = list.find(r => r.id === id)
  return {
    who: row === undefined ? 'Agent' : label(row),
    depth: row?.depth ?? 0,
    agent: id,
    logo: logoOf(row?.type ?? 'principal', id),
  }
}

let model = ''
let effort = ''
// Session et dossier vus en dernier : /clear change l'id et /cd la racine, sans relancer session.start.
let sid = ''
let sroot = ''
// Ou ecrire le compteur de la session courante ; fige avec sid/sroot pour ne jamais deriver en cours de route.
let current: { dir: string; id: string; name: string } | null = null

// Les mises a jour du compteur passent une par une : deux reponses qui finissent en meme temps
// ne se marchent pas dessus (surtout autour d'un /clear).
let chain: Promise<unknown> = Promise.resolve()
const serial = <T,>(fn: () => Promise<T>): Promise<T> => {
  const run = chain.then(fn, fn)
  chain = run.then(() => undefined, () => undefined)
  return run
}

// Un fichier par session sous ~/.claude/mod-tokens/<projet>/ : aucune ecriture partagee,
// le total du projet est la somme des fichiers.
const where = async ($: any, root: string) => {
  const home: string | undefined = await $.env.get('HOME')
  if (isScratch(root) || !home) return null
  return { dir: `${home}/.claude/mod-tokens/${projectKey(root)}`, name: folderName(root) }
}

// Somme des autres sessions du projet ; un dossier absent ou un fichier illisible comptent pour rien.
const scanOthers = async ($: any, dir: string, id: string) => {
  let others = ZERO
  let sessions = 0
  let entries: { name: string; kind: string }[] = []
  try {
    entries = await $.fs.list(dir)
  } catch {
    return { others, sessions }
  }
  for (const f of entries) {
    if (f.kind !== 'file' || !f.name.endsWith('.json') || f.name === `${id}.json`) continue
    try {
      const t = parseTotals(await $.fs.read(`${dir}/${f.name}`))
      if (t !== null) {
        others = add(others, t)
        sessions += 1
      }
    } catch {
      // fichier en cours d'ecriture par une autre session
    }
  }
  return { others, sessions }
}

// Se cale sur la session et le dossier courants : relit son fichier (reprise) et les autres sessions du projet.
// Un changement de dossier repart de zero pour le nouveau projet : les tokens deja comptes restent dans l'ancien.
// A appeler dans serial().
const adopt = async ($: any, force = false) => {
  const id: string = await $.session.id()
  const root: string = await $.session.root()
  if (id === sid && root === sroot && !force) return
  sid = id
  sroot = root
  const place = await where($, root)
  current = place === null ? null : { ...place, id }
  let session = ZERO
  let found = { others: ZERO, sessions: 0 }
  if (current !== null) {
    try {
      session = parseTotals(await $.fs.read(`${current.dir}/${id}.json`)) ?? ZERO
    } catch {
      // premiere fois pour cette session
    }
    found = await scanOthers($, current.dir, id)
  }
  await update($, tally, () => ({
    session,
    others: found.others,
    sessions: found.sessions,
    project: current?.name ?? '',
  }))
}

const save = async ($: any, session: Totals) => {
  try {
    if (current === null) return
    await $.fs.write(`${current.dir}/${current.id}.json`, JSON.stringify({ ...session, updatedAt: await $.clock.now() }))
  } catch {
    // le compteur est un confort : un disque en echec ne doit pas casser un tour
  }
}

const refreshOthers = async ($: any) => {
  try {
    if (current === null) return
    const found = await scanOthers($, current.dir, current.id)
    await update($, tally, t => ({ ...t, others: found.others, sessions: found.sessions }))
  } catch {
    // idem
  }
}

// Ajoute des tokens au compteur de la session (et a la ligne d'un agent, si on la connait).
const spend = ($: any, spent: Totals, agent?: string) =>
  serial(async () => {
    try {
      await adopt($)
      if (agent !== undefined) await update($, rows, patch(agent, row => ({ usage: add(row.usage ?? ZERO, spent) })))
      const t = await update($, tally, cur => ({ ...cur, session: add(cur.session, spent) }))
      await save($, t.session)
    } catch {
      // le compteur est un confort
    }
  })

const LOOK = {
  running: { color: BLUE, icon: '●', text: 'en cours' },
  done: { color: 'success', icon: '✔', text: 'terminé' },
  error: { color: 'error', icon: '✖', text: 'erreur' },
  aborted: { color: 'inactive', icon: '■', text: 'arrêté' },
} as const

// Une tache : une ligne ; tant qu'elle tourne, deux de plus (l'objectif, puis l'outil du moment).
// `full` (panneau) garde l'objectif meme une fois la tache finie et ajoute la traine des derniers outils.
const rowView = ({ Box, Text }: any, row: Row, full: boolean, trail: Entry[] = []) => {
  const look = LOOK[row.status]
  const live = row.status === 'running'
  const tint = tintOf(row.id)
  const extra = [live ? '' : dur(row.durationMs), modelName(row.model), row.effort].filter(p => p !== '').join(' · ')
  const used = row.usage ?? ZERO
  // La ligne principale n'affiche pas ses tokens : c'est le compteur de session.
  const spent = row.id !== MAIN && used.input + used.output > 0
  const pad = ' '.repeat(row.depth * 3 + 3)
  const what = row.action === 'reflexion' || row.action === 'demarrage' ? 'réflexion…' : `${row.action} ${row.detail ?? ''}`.trim()
  const tools = row.tools ?? 0

  return (
    <Box key={row.id} flexDirection="column">
      <Text wrap="truncate-end">
        {' '.repeat(row.depth * 3)}
        {row.depth > 0 && <Text dimColor>└ </Text>}
        <Text>{logoOf(row.type, row.id)} </Text>
        <Text color={tint} bold dimColor={row.status === 'done'}>{label(row).padEnd(9)}</Text>
        <Text color={look.color} bold>{look.icon} </Text>
        <Text color={look.color}>{look.text.padEnd(8)}</Text>
        {spent && <Text color={CYAN}>{`↑${fmt(used.input)} ↓${fmt(used.output)}  `}</Text>}
        <Text dimColor>{extra}</Text>
      </Text>
      {(live || full) && <Text wrap="truncate-end" dimColor>{pad}↳ {row.goal}</Text>}
      {live && <Text wrap="truncate-end" color={ORANGE}>{pad}▸ {what}</Text>}
      {(live || (full && trail.length > 0)) && (
        <Text wrap="truncate-end">
          <Text dimColor>{pad}</Text>
          {trail.map(x => (
            <Text key={x.id} color={x.state === 'err' ? 'error' : x.state === 'ok' ? 'success' : ORANGE}>● </Text>
          ))}
          <Text dimColor>{`étape ${row.steps}${tools > 0 ? ` · ${tools} outil${tools === 1 ? '' : 's'}` : ''}`}</Text>
        </Text>
      )}
    </Box>
  )
}

// Une ligne du journal : l'heure, le logo de l'agent, ce qui se passe, combien de temps.
const entryView = ({ Text }: any, x: Entry) => {
  const time = clock(x.at)
  if (x.kind === 'prompt') {
    return (
      <Text key={x.id} wrap="truncate-end">
        <Text color={VIOLET} bold>── {time} ── </Text>
        <Text color={VIOLET}>{x.detail}</Text>
      </Text>
    )
  }
  const color = x.state === 'err' ? 'error' : x.state === 'ok' ? 'success' : ORANGE
  const icon = x.kind === 'tool' ? (x.state === 'run' ? '▸' : x.state === 'ok' ? '✔' : '✖') : x.kind === 'agent' ? '⇢' : x.state === 'err' ? '✖' : '■'
  return (
    <Text key={x.id} wrap="truncate-end">
      <Text dimColor>{time} </Text>
      <Text>{x.logo} </Text>
      <Text color={color}>{icon} </Text>
      <Text color={x.kind === 'tool' ? undefined : tintOf(x.agent)} bold={x.kind === 'tool'}>{x.text}</Text>
      {x.detail !== '' && <Text dimColor> {x.detail}</Text>}
      {x.ms !== undefined && <Text dimColor>{`  ${span(x.ms)}`}</Text>}
    </Text>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // Une ancienne version epinglait une ligne de statut : un rechargement l'efface.
    $.ui.status(undefined)
    await serial(() => adopt($, true)).catch(() => undefined)
    await $.command
      .register({ name: 'activite', description: "Ouvre le panneau d'activité des agents (outils, étapes, journal)" })
      .catch(() => undefined)
    // Sur l'app de bureau le panneau reste ouvert, etroit, a droite ; un terminal simple l'ouvre a la demande.
    if (e.surface !== 'terminal') void $.ui.open(PANE_OPEN).catch(() => undefined)

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
    await serial(() => refreshOthers($))
    const at = await $.clock.now()
    await note($, { id: `p${at}`, at, who: 'Réponse', agent: MAIN, logo: logoOf('principal', MAIN), depth: 0, kind: 'prompt', text: 'demande', detail: short(e.text || 'suite', 160), state: 'ok' })

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
    const at = await $.clock.now()
    const parent = whoOf(await read($, rows), e.parentAgentId ?? MAIN)
    await note($, { id: `s${started.agentId}`, at, ...parent, kind: 'agent', text: `lance ${label(row)}`, detail: row.goal, state: 'ok' })

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

    const result = yield* next(e)

    // Source unique des tokens : chaque reponse du modele, y compris celle d'un tour interrompu ensuite.
    const spent = fromUsage(result.usage)
    if (spent.input + spent.output + spent.cache > 0) {
      await spend($, spent, id)
    }

    return result
  })

  // Le resume de compaction est une requete a part, hors turn.step : sans ceci le compteur la rate.
  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    const spent = fromUsage('usage' in result ? result.usage : undefined)
    if (spent.input + spent.output + spent.cache > 0) {
      await spend($, spent)
    }

    return result
  })

  on('tool.call', async ($, e, next) => {
    const id = e.agentId ?? MAIN
    const detail = describe(e)
    await update($, rows, patch(id, row => ({ action: e.tool, detail, tools: (row.tools ?? 0) + 1 })))
    const at = await $.clock.now()
    const key = e.tool_use_id ?? `t${at}${e.tool}`
    const who = whoOf(await read($, rows), id)
    await note($, { id: key, at, ...who, kind: 'tool', text: e.tool, detail, state: 'run' })

    // Le journal garde la duree et l'issue de l'outil ; une erreur ou un refus se voit en rouge.
    try {
      const ran = await next(e)
      const failed = ran.deny !== undefined || ('isError' in ran && ran.isError === true)
      await mark($, key, { state: failed ? 'err' : 'ok', ms: (await $.clock.now()) - at })

      return ran
    } catch (err) {
      await mark($, key, { state: 'err', ms: (await $.clock.now()) - at })
      throw err
    }
  })

  on('turn.complete', async ($, e, next) => {
    const id = e.agentId ?? MAIN
    const status: Row['status'] =
      e.reason === 'answer' ? 'done' : e.reason === 'aborted' ? 'aborted' : 'error'
    await update($, rows, patch(id, () => ({ status, action: '', durationMs: e.durationMs })))
    if (id === MAIN) await serial(() => refreshOthers($))
    const at = await $.clock.now()
    const who = whoOf(await read($, rows), id)
    const words = status === 'done' ? 'terminé' : status === 'aborted' ? 'arrêté' : 'erreur'
    await note($, { id: `e${at}${id}`, at, ...who, kind: 'end', text: words, detail: '', state: status === 'done' ? 'ok' : 'err', ms: e.durationMs })

    return next(e)
  })

  // Une ligne par tache, un mot, un etat, ses tokens ; un pied de page pour la session et le projet.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, rows)
    const t = await read($, tally)
    const count = (s: Row['status']) => list.filter(r => r.status === s).length
    const running = count('running')
    const done = count('done')
    const failed = count('error') + count('aborted')

    const main = list.filter(r => r.id === MAIN)
    const others = list.filter(r => r.id !== MAIN)
    const shown = [...main, ...others.slice(-(MAX_ROWS - main.length))]
    const hidden = list.length - shown.length

    const project = add(t.others, t.session)
    // Le projet n'apparait que s'il apporte du neuf : sinon c'est le meme chiffre que la session.
    const more = t.project !== '' && t.sessions > 0

    return (
      <Box flexDirection="column">
        <Text wrap="truncate-end">
          <Text color={BLUE} bold>◆ TÂCHES</Text>
          {list.length === 0 && <Text dimColor>   aucune pour l'instant</Text>}
          {running > 0 && <Text color={LOOK.running.color} bold>   ● {running} en cours</Text>}
          {done > 0 && <Text color={LOOK.done.color}>   ✔ {done} terminé{done > 1 ? 's' : ''}</Text>}
          {failed > 0 && <Text color={LOOK.error.color}>   ✖ {failed} échec{failed > 1 ? 's' : ''}</Text>}
        </Text>
        {shown.map(row => rowView({ Box, Text }, row, false))}
        {hidden > 0 && <Text dimColor>  +{hidden} autres</Text>}
        <Text wrap="truncate-end">
          <Text color={VIOLET} bold>◆ TOKENS</Text>
          <Text dimColor>   </Text>
          <Text color={CYAN} bold>↑{fmt(t.session.input)}</Text>
          <Text color={ORANGE} bold> ↓{fmt(t.session.output)}</Text>
          <Text dimColor> cache {fmt(t.session.cache)}</Text>
          {more && <Text dimColor>   │   projet </Text>}
          {more && <Text color={VIOLET}>{short(t.project, 20)} </Text>}
          {more && <Text color={CYAN} bold>↑{fmt(project.input)}</Text>}
          {more && <Text color={ORANGE} bold> ↓{fmt(project.output)}</Text>}
          {more && <Text dimColor> · {t.sessions + 1} sessions</Text>}
        </Text>
      </Box>
    )
  })

  on('command.run', { command: 'activite' }, async $ => {
    const placed = await $.ui.open(PANE_OPEN)

    return { text: placed.isPlaced ? "Panneau d'activité ouvert." : "Ce terminal n'affiche pas de panneau ici." }
  })

  // Le panneau : tous les agents avec leur detail, puis le journal, le plus recent en haut.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, rows)
    const log = await read($, journal)
    const count = (st: Row['status']) => list.filter(r => r.status === st).length
    const running = count('running')
    const done = count('done')
    const tools = log.filter(x => x.kind === 'tool').length
    const failed = log.filter(x => x.kind === 'tool' && x.state === 'err').length
    // Les lignes restantes apres l'en-tete et les agents : le journal s'adapte a la hauteur du panneau.
    const used = 3 + list.reduce((n, r) => n + 2 + (r.status === 'running' ? 2 : 1), 0)
    const room = Math.max(4, (e.viewport?.rows ?? 30) - used - 3)

    return (
      <Box flexDirection="column">
        <Text wrap="truncate-end">
          <Text color={BLUE} bold>◆ ACTIVITÉ</Text>
          {running > 0 && <Text color={BLUE} bold>  ● {running}</Text>}
          {done > 0 && <Text color="success">  ✔ {done}</Text>}
          {failed > 0 && <Text color="error">  ✖ {failed}</Text>}
          <Text dimColor>  {tools} outil{tools > 1 ? 's' : ''}</Text>
        </Text>
        {list.length === 0 && <Text dimColor>Aucune tâche pour l'instant.</Text>}
        {list.map(row =>
          rowView({ Box, Text }, row, true, log.filter(x => x.kind === 'tool' && x.agent === row.id).slice(-10)),
        )}
        <Text color={VIOLET} bold>◆ JOURNAL</Text>
        {log.length === 0 && <Text dimColor>Rien pour l'instant.</Text>}
        {log
          .slice(-room)
          .reverse()
          .map(x => entryView({ Text }, x))}
      </Box>
    )
  })
}
