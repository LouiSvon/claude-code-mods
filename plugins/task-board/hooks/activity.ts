const one = (text: string, n: number) => {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

// "src/a/b.ts" -> "a/b.ts" : les deux derniers segments suffisent a reconnaitre le fichier.
const tail = (path: string) => path.split('/').filter(Boolean).slice(-2).join('/')

// Ce que l'outil appele vise, en quelques mots : un fichier, une commande, un motif, une adresse.
// Les arguments de l'outil sont a plat sur l'evenement `tool.call`.
export const describe = (args: Record<string, unknown>): string => {
  const s = (key: string) => (typeof args[key] === 'string' ? (args[key] as string) : '')
  const path = s('file_path') || s('notebook_path')
  if (path !== '') return tail(path)
  const command = s('command')
  if (command !== '') return one(command, 70)
  const pattern = s('pattern')
  if (pattern !== '') return `"${one(pattern, 40)}"${s('path') !== '' ? ` dans ${tail(s('path'))}` : ''}`
  const target = s('url') || s('query')
  if (target !== '') return one(target, 70)
  const text = s('description') || s('prompt')
  if (text !== '') return one(text, 70)
  return s('path') !== '' ? tail(s('path')) : ''
}
