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

// 14:03:09, en heure locale.
export const clock = (at: number): string => {
  const d = new Date(at)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`
}

// 80ms, 1.2s, 2min05 : la duree d'un outil, plus fine que celle d'une tache.
export const span = (ms: number | undefined): string => {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return ''
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min${String(s % 60).padStart(2, '0')}`
}

// Le logo d'un agent d'apres son type ; un type inconnu prend un logo stable tire de son identifiant.
const LOGOS: Record<string, string> = {
  principal: '🧠',
  Explore: '🔭',
  Plan: '🧭',
  'general-purpose': '🤖',
  chercheur: '🔎',
  implementeur: '🔧',
  relecteur: '🧐',
  orchestrateur: '🎼',
  'claude-code-guide': '📘',
  'statusline-setup': '📟',
}
const SPARE = ['🐙', '🦊', '🐝', '🦉', '🐳', '🦄']

const hash = (text: string) => {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 31) + text.charCodeAt(i)) >>> 0
  return h
}

export const logoOf = (type: string, id: string): string => LOGOS[type] ?? SPARE[hash(id) % SPARE.length]!

// Une couleur par agent : on reconnait d'un coup d'oeil qui fait quoi, dans la liste comme dans le journal.
const TINTS = ['#b08cff', '#4dd4d4', '#ff9f43', '#ff7ab2', '#8fd36a', '#f2d45c']
export const tintOf = (id: string): string => (id === 'main' ? '#4da3ff' : TINTS[hash(id) % TINTS.length]!)

// Le journal survit aux rechargements : une entree ecrite par une ancienne version peut manquer de champs.
// Sans cette garde, `tintOf(undefined)` plante le rendu et le panneau reste vide.
export const complete = <T extends { agent?: string; logo?: string; detail?: string; text?: string }>(x: T) => ({
  ...x,
  agent: x.agent ?? 'main',
  logo: x.logo ?? logoOf('principal', 'main'),
  detail: x.detail ?? '',
  text: x.text ?? '',
})
