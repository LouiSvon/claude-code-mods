import { expect, test } from 'claude-code/testing'
import { folderOf, gauge, price, short, tone, until } from './register'

test('gauge and tones follow the shell script', () => {
  expect(gauge(30)).toEqual({ on: '▓▓', off: '░░░░░░' })
  expect(gauge(62).on).toBe('▓▓▓▓▓')
  expect([tone(10), tone(60), tone(90)]).toEqual(['#4da3ff', '#ff9f43', 'error'])
})

test('folder only when the session is in a real folder', () => {
  expect(folderOf('/Users/alex/dev/demo')).toBe('demo')
  expect(folderOf('/Users/alex/Library/Application Support/Claude/scratch-workspaces/a/b/c')).toBeNull()
  expect(folderOf('/Users/alex', '/Users/alex')).toBeNull()
})

test('time until reset', () => {
  const now = Date.parse('2026-10-10T10:00:00Z')
  expect(until('2026-10-10T12:13:00Z', now)).toBe('2h13')
  expect(until('2026-10-10T10:45:00Z', now)).toBe('45min')
  expect(until('2026-10-14T10:00:00Z', now)).toBe('4j')
  expect(until(undefined, now)).toBe('')
  expect(until('2026-10-10T09:00:00Z', now)).toBe('')
})

test('short token counts and API-equivalent price', () => {
  expect([short(842), short(38_400), short(200_000), short(999_999), short(1_250_000)]).toEqual(['842', '38k', '200k', '1.0M', '1.3M'])
  expect([price(0.4213), price(12.34), price(undefined), price(0)]).toEqual(['≈ $0.42', '≈ $12.3', '', ''])
})
