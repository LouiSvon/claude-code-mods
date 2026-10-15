export type Totals = { input: number; output: number; cache: number }

export const ZERO: Totals = { input: 0, output: 0, cache: 0 }

type ApiUsage = {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

// "input" = ce que le modele a lu de neuf (non cache + ecrit en cache) ; la lecture du cache
// pese des millions et fausserait le chiffre phare, elle est comptee a part.
export const fromUsage = (u: ApiUsage | null | undefined): Totals =>
  u == null
    ? ZERO
    : {
        input: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
        output: u.output_tokens ?? 0,
        cache: u.cache_read_input_tokens ?? 0,
      }

export const add = (a: Totals, b: Totals): Totals => ({
  input: a.input + b.input,
  output: a.output + b.output,
  cache: a.cache + b.cache,
})

// 842, 1.2k, 45k, 1.2M.
export const fmt = (n: number): string => {
  if (!Number.isFinite(n) || n < 0) return '0'
  if (n < 1000) return String(Math.round(n))
  if (n < 9_950) return `${(n / 1000).toFixed(1)}k`
  if (n < 999_500) return `${Math.round(n / 1000)}k`
  return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 2 : 1)}M`
}

// 4s, 2min05.
export const dur = (ms: number | undefined): string => {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return ''
  const s = Math.round(ms / 1000)
  if (s < 1) return '<1s'
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}min${String(s % 60).padStart(2, '0')}`
}

// Nom du dossier de stockage : le nom du projet, lisible, puis un empreinte de la racine entiere.
// Deux racines differentes ne partagent jamais de dossier, meme si elles ne different que par
// un caractere (`/b-c`, `/b/c`, `/b c`) : le nom seul ne distingue pas.
export const projectKey = (root: string): string => {
  let a = 5381
  let b = 52711
  for (let i = 0; i < root.length; i++) {
    const c = root.charCodeAt(i)
    a = (Math.imul(a, 33) ^ c) >>> 0
    b = (Math.imul(b, 31) + c + i) >>> 0
  }
  const name = (root.split('/').filter(Boolean).pop() ?? 'racine').replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 40)
  return `${name}-${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`
}

export const folderName = (root: string): string => root.split('/').filter(Boolean).pop() ?? root

// L'app lance ses sessions sans dossier dans un espace temporaire : pas de projet.
export const isScratch = (root: string): boolean => root.includes('/scratch-workspaces/')

// Un fichier d'une autre session peut etre en cours d'ecriture : tout ce qui n'est pas valide est ignore.
export const parseTotals = (text: string): Totals | null => {
  try {
    const v = JSON.parse(text) as Partial<Totals> | null
    const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : null)
    const input = num(v?.input)
    const output = num(v?.output)
    const cache = num(v?.cache)
    return input === null || output === null || cache === null ? null : { input, output, cache }
  } catch {
    return null
  }
}
