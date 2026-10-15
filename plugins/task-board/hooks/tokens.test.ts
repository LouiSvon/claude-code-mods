import { expect, test } from 'claude-code/testing'
import { ZERO, add, dur, fmt, folderName, fromUsage, isScratch, parseTotals, projectKey } from './tokens'

test('fmt abrege sans perdre l ordre de grandeur', () => {
  expect([0, 842, 1200, 9_999, 45_300, 999_999, 1_230_000, 12_400_000].map(fmt)).toEqual([
    '0', '842', '1.2k', '10k', '45k', '1.00M', '1.23M', '12.4M',
  ])
  expect([fmt(-5), fmt(NaN)]).toEqual(['0', '0'])
})

test('dur : secondes puis minutes', () => {
  expect([dur(200), dur(4000), dur(125_000), dur(undefined)]).toEqual(['<1s', '4s', '2min05', ''])
})

test('fromUsage : le cache lu est compte a part, un champ absent vaut zero', () => {
  expect(
    fromUsage({ input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 1000, cache_creation_input_tokens: 40 }),
  ).toEqual({ input: 50, output: 5, cache: 1000 })
  expect(fromUsage({ output_tokens: 3 })).toEqual({ input: 0, output: 3, cache: 0 })
  expect(fromUsage(null)).toEqual(ZERO)
  expect(add({ input: 1, output: 2, cache: 3 }, { input: 10, output: 20, cache: 30 })).toEqual({
    input: 11, output: 22, cache: 33,
  })
})

test('projectKey garde la racine entiere : deux depots du meme nom restent distincts', () => {
  expect(projectKey('/Users/a/dev/demo')).not.toBe(projectKey('/Users/b/dev/demo'))
  expect(projectKey('/Users/a/dev/demo')).toBe('-Users-a-dev-demo')
  expect(folderName('/Users/a/dev/demo')).toBe('demo')
  expect(isScratch('/x/Claude/scratch-workspaces/a/b')).toBe(true)
  expect(isScratch('/Users/a/dev/demo')).toBe(false)
})

test('parseTotals ignore un fichier tronque ou faux', () => {
  expect(parseTotals('{"input":1,"output":2,"cache":3,"updatedAt":9}')).toEqual({ input: 1, output: 2, cache: 3 })
  expect(parseTotals('{"input":1,"outp')).toBeNull()
  expect(parseTotals('{"input":-1,"output":2,"cache":3}')).toBeNull()
  expect(parseTotals('null')).toBeNull()
})
