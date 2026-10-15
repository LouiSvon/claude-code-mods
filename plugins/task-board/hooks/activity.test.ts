import { expect, test } from 'claude-code/testing'
import { clock, complete, describe, logoOf, tintOf } from './activity'

test('describe : la cible de l outil en quelques mots', () => {
  expect(describe({ tool: 'Read', file_path: '/Users/a/dev/demo/src/app.ts' })).toBe('src/app.ts')
  expect(describe({ tool: 'Bash', command: 'claude   plugin test\nplugins/x' })).toBe('claude plugin test plugins/x')
  expect(describe({ tool: 'Grep', pattern: 'adopt', path: '/a/b/hooks' })).toBe('"adopt" dans b/hooks')
  expect(describe({ tool: 'WebFetch', url: 'https://example.com' })).toBe('https://example.com')
  expect(describe({ tool: 'Agent', description: 'Lister les fichiers' })).toBe('Lister les fichiers')
  expect(describe({ tool: 'Anything', n: 3 })).toBe('')
  expect(describe({ tool: 'Bash', command: 'x'.repeat(200) }).length).toBe(70)
})

test('clock', () => {
  expect(clock(new Date(2026, 9, 15, 14, 3, 9).getTime())).toBe('14:03:09')
})

test('logo et couleur : connus par type, stables pour un agent inconnu', () => {
  expect(logoOf('Explore', 'a1')).toBe('🔭')
  expect(logoOf('principal', 'main')).toBe('🧠')
  expect(logoOf('mystere', 'a7')).toBe(logoOf('mystere', 'a7'))
  expect(logoOf('mystere', 'a7').length).toBeGreaterThan(0)
  expect(tintOf('main')).toBe('#4da3ff')
  expect(tintOf('a1')).toBe(tintOf('a1'))
  expect(tintOf('a1')).toMatch(/^#[0-9a-f]{6}$/)
})

test('complete : une ancienne entree du journal ne fait plus planter le rendu', () => {
  const old = complete({ id: 'x', kind: 'end' } as { agent?: string; logo?: string; who?: string; text?: string })
  expect(old.agent).toBe('main')
  expect(old.logo).toBe('🧠')
  expect(() => tintOf(old.agent)).not.toThrow()
  expect(complete({ agent: 'a1', logo: '🔭', who: 'Lister', text: 't' })).toEqual({ agent: 'a1', logo: '🔭', who: 'Lister', text: 't' })
  // la cause du panneau vide : sans garde, tintOf(undefined) leve une erreur
  expect(() => tintOf(undefined as never)).toThrow()
})
