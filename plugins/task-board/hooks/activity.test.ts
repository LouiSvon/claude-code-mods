import { expect, test } from 'claude-code/testing'
import { describe } from './activity'

test('describe : la cible de l outil en quelques mots', () => {
  expect(describe({ tool: 'Read', file_path: '/Users/a/dev/demo/src/app.ts' })).toBe('src/app.ts')
  expect(describe({ tool: 'Bash', command: 'claude   plugin test\nplugins/x' })).toBe('claude plugin test plugins/x')
  expect(describe({ tool: 'Grep', pattern: 'adopt', path: '/a/b/hooks' })).toBe('"adopt" dans b/hooks')
  expect(describe({ tool: 'WebFetch', url: 'https://example.com' })).toBe('https://example.com')
  expect(describe({ tool: 'Agent', description: 'Lister les fichiers' })).toBe('Lister les fichiers')
  expect(describe({ tool: 'Anything', n: 3 })).toBe('')
  expect(describe({ tool: 'Bash', command: 'x'.repeat(200) }).length).toBe(70)
})
