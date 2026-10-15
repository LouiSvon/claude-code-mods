import { expect, test } from 'claude-code/testing'
import { projectKey } from './tokens'

const BAND = { component: 'AbovePrompt', props: {} } as const
const show = ($: never) => ($ as never as { ui: { mount: (a: never) => Promise<any> } }).ui.mount({ plugin: 'task-board', surface: 'terminal', ...BAND } as never)

// Le moteur n'est pas la : on repond a sa place, au bas de la chaine.
const bottom = (on: any) => {
  on('ui.render', ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>RIEN</Text>
  })
  on('turn.start', (_$: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('turn.step', async function* (_$: any, e: any) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
}

const spawn = ($: any, description: string) =>
  $.agent.spawn({ prompt: 'p', description, subagentType: 'Explore' })

test('bandeau d attente sans tache, puis objectif, modele et etat', async ($, on) => {
  bottom(on)
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'a1' }))

  const empty = await show($ as never)
  expect(await empty.find({ type: 'Text', text: /aucune pour/ })).toBeDefined()
  expect(await empty.find({ type: 'Text', text: /en cours/ })).toBeUndefined()
  await empty.unmount()

  await spawn($, 'Explorer le depot')
  const ui = await show($ as never)
  expect(await ui.find({ type: 'Text', text: /TÂCHES/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /en cours/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Explorer/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /haiku/ })).toBeDefined()
  await ui.unmount()
})

test('un agent termine passe en TERMINE, puis repasse en EN COURS s il repart', async ($, on) => {
  bottom(on)
  on('agent.spawn', () => ({ model: 'm', agentId: 'a1' }))
  await spawn($, 'Agent A')
  await ($ as any).turn.complete({ reason: 'answer', agentId: 'a1', answer: '', durationMs: 1000, isAborted: false, turnId: 't' })

  const done = await show($ as never)
  expect(await done.find({ type: 'Text', text: /terminé/ })).toBeDefined()
  await done.unmount()

  const stream = ($ as any).turn.step({ turnId: 't', index: 0, model: 'm', messageCount: 1, agentId: 'a1' })
  for await (const _ of stream) void _
  const again = await show($ as never)
  expect(await again.find({ type: 'Text', text: /terminé/ })).toBeUndefined()
  expect(await again.find({ type: 'Text', text: /en cours/ })).toBeDefined()
  await again.unmount()
})

test('la tache principale reste visible avec beaucoup de sous-agents', async ($, on) => {
  bottom(on)
  let n = 0
  on('agent.spawn', () => ({ model: 'm', agentId: `a${++n}` }))
  await ($ as any).turn.start({ text: 'TACHE PRINCIPALE', turnId: 't' })
  for (const name of ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel']) await spawn($, name)

  const ui = await show($ as never)
  expect(await ui.find({ type: 'Text', text: /Réponse/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Hotel/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Alpha/ })).toBeUndefined()
  await ui.unmount()
})

test('un sous-agent est decale sous la tache principale, un petit-agent encore plus', async ($, on) => {
  bottom(on)
  let n = 0
  on('agent.spawn', () => ({ model: 'm', agentId: `a${++n}` }))
  await ($ as any).turn.start({ text: 'demande', turnId: 't' })
  await spawn($, 'Alpha')
  await ($ as any).agent.spawn({ prompt: 'p', description: 'Bravo', subagentType: 'Explore', parentAgentId: 'a1' } as never)

  const ui = await show($ as never)
  expect((await ui.findAll({ type: 'Text', text: /^└ $/ })).length).toBe(2)
  await ui.unmount()
})

test('un agent relance apres le nettoyage du tour reapparait', async ($, on) => {
  bottom(on)
  on('agent.spawn', () => ({ model: 'm', agentId: 'a1' }))
  on('agent.list', () => ({ value: [{ id: 'a1', description: 'Alpha', type: 'Explore', status: 'running' }] }))
  await spawn($, 'Alpha')
  await ($ as any).turn.complete({ reason: 'answer', agentId: 'a1', answer: '', durationMs: 1, isAborted: false, turnId: 't' })
  await ($ as any).turn.start({ text: 'nouvelle demande', turnId: 't2' })

  const gone = await show($ as never)
  expect(await gone.find({ type: 'Text', text: /Alpha/ })).toBeUndefined()
  await gone.unmount()

  const stream = ($ as any).turn.step({ turnId: 't2', index: 0, model: 'm', messageCount: 1, agentId: 'a1' })
  for await (const _ of stream) void _
  const back = await show($ as never)
  expect(await back.find({ type: 'Text', text: /Alpha/ })).toBeDefined()
  await back.unmount()
})

// ---- compteur de tokens -------------------------------------------------------------------

type Files = Record<string, string>
const dirOf = (root: string) => `/home/u/.claude/mod-tokens/${projectKey(root)}`
const DIR = dirOf('/Users/a/dev/demo')

// Le disque, l'environnement et l'identite de session sont simules : rien n'ecrit dans le vrai ~/.claude.
const world = (on: any, opts: { root?: string; id?: string; files?: Files } = {}) => {
  const files: Files = { ...(opts.files ?? {}) }
  const usageOf: Record<string, any> = {}
  const writes: { path: string; text: string }[] = []
  let id = opts.id ?? 's1'
  let root = opts.root ?? '/Users/a/dev/demo'
  on('session.id', () => ({ value: id }))
  on('session.root', () => ({ value: root }))
  on('env.get', () => ({ value: '/home/u' }))
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('ui.status', () => ({ value: undefined }) as never)
  on('clock.now', () => ({ value: 1000 }))
  on('fs.list', (_$: any, e: any) => {
    const mine = Object.keys(files).filter(p => p.startsWith(`${e.path}/`))
    if (mine.length === 0) throw new Error('absent')
    return { value: mine.map(path => ({ name: path.split('/').pop(), kind: 'file', size: 1, mtimeMs: 0, isLink: false })) }
  })
  on('fs.read', (_$: any, e: any) => {
    if (!(e.path in files)) throw new Error('absent')
    return { value: files[e.path] }
  })
  on('fs.write', (_$: any, e: any) => {
    files[e.path] = e.text
    writes.push(e)
    return { value: undefined }
  })
  on('ui.render', ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>RIEN</Text>
  })
  on('turn.start', (_$: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('session.compact', () => ({ messages: [{ role: 'user', text: 'resume', toolUses: [] }], usage: usageOf.compact }))
  on('turn.step', async function* (_$: any, e: any) {
    const u = usageOf[e.agentId ?? 'main']
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: u ?? null }
  })
  return { files, usageOf, writes, setId: (v: string) => { id = v }, setRoot: (v: string) => { root = v } }
}

const use = (input: number, output: number, cache = 0) => ({
  input_tokens: input, output_tokens: output, cache_read_input_tokens: cache, cache_creation_input_tokens: 0, model: 'm',
})

const step = async ($: any, agentId?: string) => {
  const stream = $.turn.step({ turnId: 't', index: 0, model: 'm', messageCount: 1, ...(agentId ? { agentId } : {}) })
  for await (const _ of stream) void _
}

const texts = async (ui: any) => (await ui.findAll({ type: 'Text' })).map((t: any) => t.text).join('')

test('les tokens de l agent principal et des sous-agents s additionnent, chacun sur sa ligne', async ($, on) => {
  const w = world(on)
  on('agent.spawn', () => ({ model: 'm', agentId: 'a1' }))
  await ($ as any).session.start({ cwd: '/Users/a/dev/demo', surface: 'terminal', isInteractive: true, source: 'startup' })
  await ($ as any).turn.start({ text: 'demande', turnId: 't' })
  await spawn($, 'Alpha')

  w.usageOf.main = use(100, 50, 1000)
  w.usageOf.a1 = use(10, 5)
  await step($)
  await step($, 'a1')

  const ui = await show($ as never)
  const all = await texts(ui)
  expect(all).toContain('↑10 ↓5')
  expect(all).not.toContain('↑100 ↓50')
  expect(all).toContain('↑110')
  expect(all).toContain('↓55')
  expect(all).toContain('cache 1.0k')
  await ui.unmount()

  const saved = JSON.parse(w.files[`${DIR}/s1.json`])
  expect(saved).toMatchObject({ input: 110, output: 55, cache: 1000 })
})

test('le total du projet somme les autres sessions et ignore un fichier abime', async ($, on) => {
  world(on, {
    files: {
      [`${DIR}/s9.json`]: '{"input":1000,"output":200,"cache":5000}',
      [`${DIR}/s8.json`]: '{"input":1',
      [`${DIR}/notes.txt`]: 'x',
    },
  })
  await ($ as any).session.start({ cwd: '/Users/a/dev/demo', surface: 'terminal', isInteractive: true, source: 'startup' })

  const ui = await show($ as never)
  const all = await texts(ui)
  expect(all).toContain('projet ')
  expect(all).toContain('demo')
  expect(all).toContain('↑1.0k')
  expect(all).toContain('2 sessions')
  await ui.unmount()
})

test('une session reprise repart de son fichier au lieu de l ecraser', async ($, on) => {
  const w = world(on, { files: { [`${DIR}/s1.json`]: '{"input":500,"output":100,"cache":0}' } })
  await ($ as any).session.start({ cwd: '/Users/a/dev/demo', surface: 'terminal', isInteractive: true, source: 'resume' })
  w.usageOf.main = use(10, 1)
  await step($)

  expect(JSON.parse(w.files[`${DIR}/s1.json`])).toMatchObject({ input: 510, output: 101 })
})

test('apres /clear (nouvel id, pas de session.start) le compteur de session repart de zero', async ($, on) => {
  const w = world(on)
  await ($ as any).session.start({ cwd: '/Users/a/dev/demo', surface: 'terminal', isInteractive: true, source: 'startup' })
  w.usageOf.main = use(100, 10)
  await step($)
  w.setId('s2')
  w.usageOf.main = use(7, 3)
  await step($)

  expect(JSON.parse(w.files[`${DIR}/s1.json`])).toMatchObject({ input: 100, output: 10 })
  expect(JSON.parse(w.files[`${DIR}/s2.json`])).toMatchObject({ input: 7, output: 3 })
})

test('un tour interrompu garde les tokens deja depenses', async ($, on) => {
  const w = world(on)
  await ($ as any).session.start({ cwd: '/Users/a/dev/demo', surface: 'terminal', isInteractive: true, source: 'startup' })
  await ($ as any).turn.start({ text: 'demande', turnId: 't' })
  w.usageOf.main = use(300, 20)
  await step($)
  await ($ as any).turn.complete({ reason: 'aborted', answer: '', durationMs: 5, isAborted: true, turnId: 't' })

  expect(JSON.parse(w.files[`${DIR}/s1.json`])).toMatchObject({ input: 300, output: 20 })
})

test('hors dossier de projet (espace temporaire de l app) : session seule, rien d ecrit', async ($, on) => {
  const w = world(on, { root: '/Users/a/Library/Claude/scratch-workspaces/x/y' })
  await ($ as any).session.start({ cwd: '/x', surface: 'terminal', isInteractive: true, source: 'startup' })
  w.usageOf.main = use(40, 4)
  await step($)

  expect(w.writes).toEqual([])
  const ui = await show($ as never)
  const all = await texts(ui)
  expect(all).toContain('↑40')
  expect(all).not.toContain('projet ')
  await ui.unmount()
})

test('la requete de resume d une compaction compte aussi', async ($, on) => {
  const w = world(on)
  await ($ as any).session.start({ cwd: '/Users/a/dev/demo', surface: 'terminal', isInteractive: true, source: 'startup' })
  w.usageOf.compact = use(900, 80)
  await ($ as any).session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'x', toolUses: [] }] })

  expect(JSON.parse(w.files[`${DIR}/s1.json`])).toMatchObject({ input: 900, output: 80 })
})

test('un changement de dossier ne double pas les tokens dans deux projets', async ($, on) => {
  const w = world(on)
  await ($ as any).session.start({ cwd: '/Users/a/dev/demo', surface: 'terminal', isInteractive: true, source: 'startup' })
  w.usageOf.main = use(50, 5)
  await step($)
  w.setRoot('/Users/a/dev/autre')
  w.usageOf.main = use(7, 1)
  await step($)

  expect(JSON.parse(w.files[`${DIR}/s1.json`])).toMatchObject({ input: 50, output: 5 })
  expect(JSON.parse(w.files[`${dirOf('/Users/a/dev/autre')}/s1.json`])).toMatchObject({ input: 7, output: 1 })
})

test('deux reponses simultanees apres /clear sont toutes deux comptees dans la nouvelle session', async ($, on) => {
  const w = world(on)
  on('agent.spawn', () => ({ model: 'm', agentId: 'a1' }))
  await ($ as any).session.start({ cwd: '/Users/a/dev/demo', surface: 'terminal', isInteractive: true, source: 'startup' })
  await spawn($, 'Alpha')
  w.usageOf.main = use(100, 10)
  await step($)
  w.setId('s2')
  w.usageOf.main = use(7, 3)
  w.usageOf.a1 = use(20, 2)
  await Promise.all([step($), step($, 'a1')])

  expect(JSON.parse(w.files[`${DIR}/s1.json`])).toMatchObject({ input: 100, output: 10 })
  expect(JSON.parse(w.files[`${DIR}/s2.json`])).toMatchObject({ input: 27, output: 5 })
})

test('une tache en cours montre son objectif et l outil du moment, une tache finie se resume en une ligne', async ($, on) => {
  const w = world(on)
  on('agent.spawn', () => ({ model: 'm', agentId: 'a1' }))
  on('tool.call', () => ({ ref: 'r', result: {}, text: '' }) as never)
  await ($ as any).turn.start({ text: 'demande', turnId: 't' })
  await spawn($, 'Lister les fichiers du dossier')
  await step($, 'a1')
  await ($ as any).tool.call({ tool: 'Read', file_path: '/Users/a/dev/demo/src/app.ts', agentId: 'a1' })

  const live = await show($ as never)
  const all = await texts(live)
  expect(all).toContain('↳ Lister les fichiers du dossier')
  expect(all).toContain('▸ Read src/app.ts')
  expect(all).toContain('étape 1 · 1 outil')
  await live.unmount()

  await ($ as any).turn.complete({ reason: 'answer', agentId: 'a1', answer: '', durationMs: 4000, isAborted: false, turnId: 't' })
  await ($ as any).turn.complete({ reason: 'answer', answer: '', durationMs: 5000, isAborted: false, turnId: 't' })
  const done = await show($ as never)
  const after = await texts(done)
  expect(after).not.toContain('▸')
  expect(after).not.toContain('↳')
  expect(after).toContain('4s')
  await done.unmount()
  void w
})
