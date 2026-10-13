import { expect, test } from 'claude-code/testing'

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
  expect((await ui.findAll({ type: 'Text', text: /└/ })).length).toBe(2)
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
