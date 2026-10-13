import { expect, test } from 'claude-code/testing'

test('la ligne de statut est calculee et epinglee', async ($: any, on: any) => {
  const seen: (string | undefined)[] = []
  on('session.model', () => ({ value: 'claude-sonnet-5-5' }))
  on('session.cwd', () => ({ value: '/Users/alex/dev/demo' }))
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { window: 200000, percent: 19 },
      rateLimits: [{ kind: 'five_hour', percentUsed: 21, resetsAt: '2026-10-13T13:00:00Z' }],
    },
  }))
  on('clock.now', () => ({ value: Date.parse('2026-10-13T10:00:00Z') }))
  on('ui.status', (_$: any, e: any) => {
    seen.push(e.text)
    return { value: undefined } as never
  })

  await $.session.start({ cwd: '/Users/alex/dev/demo', surface: 'desktop', isInteractive: true, source: 'startup' })

  expect(seen.at(-1)).not.toContain('sonnet')
  expect(seen.at(-1)).toContain('demo')
  expect(seen.at(-1)).toContain('5h 21%')
})
