import type { EngineInterface, Register } from 'claude-code'

const ORANGE = '#ff9f43'
const BLUE = '#4da3ff'

// Blue while fresh, orange past 60 %, red past 85 %.
export const tone = (pct: number): string => (pct >= 85 ? 'error' : pct >= 60 ? ORANGE : BLUE)

export const gauge = (pct: number) => {
  const filled = Math.min(8, Math.floor(pct / 12.5 + 0.5))
  return { on: '▓'.repeat(filled), off: '░'.repeat(8 - filled) }
}

// 842, 12k, 200k, 1.2M: the same short form as the task-board's token counters.
export const short = (n: number): string =>
  n < 1000 ? String(Math.round(n)) : n < 999_500 ? `${Math.round(n / 1000)}k` : `${(n / 1_000_000).toFixed(1)}M`

// "≈ $0.42": the API-equivalent price, not a charge (a subscription pays a flat fee); "" when unknown.
export const price = (usd: number | undefined): string =>
  usd === undefined || !Number.isFinite(usd) || usd <= 0 ? '' : `≈ $${usd < 10 ? usd.toFixed(2) : usd.toFixed(1)}`

// The session's folder, or null when it runs in the app's scratch folder or the home directory.
export const folderOf = (cwd: string, home = ''): string | null => {
  if (cwd.includes('/scratch-workspaces/') || (home !== '' && cwd === home)) return null
  return cwd.split('/').filter(Boolean).pop() ?? null
}

// "2h13" or "45min" until a window resets; "" when unknown.
export const until = (resetsAt: string | undefined, nowMs: number): string => {
  const ms = resetsAt === undefined ? NaN : Date.parse(resetsAt) - nowMs
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min}min`
  if (min < 48 * 60) return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
  return `${Math.floor(min / 1440)}j`
}

// The app draws no coloured tree under the prompt, only a status line of text: build that line.
async function refresh($: EngineInterface) {
  try {
    const [cwd, usage, now] = await Promise.all([$.session.cwd(), $.session.usage(), $.clock.now()])
    const ctx = Math.round(usage.context.percent ?? 0)
    const g = gauge(ctx)
    const limit = (kind: string, label: string) => {
      const l = usage.rateLimits.find(r => r.kind === kind)
      if (l === undefined) return null
      const reset = until(l.resetsAt, now)
      return `${label} ${Math.round(l.percentUsed)}%${reset !== '' ? ` ↻${reset}` : ''}`
    }
    const fill = usage.context.tokens === undefined ? '' : ` ${short(usage.context.tokens)}/${short(usage.context.window)}`
    const cost = price(usage.cost?.usd)
    const parts = [
      folderOf(cwd),
      `Contexte ${g.on}${g.off} ${ctx}%${fill}`,
      limit('five_hour', '5h'),
      limit('seven_day', 'Semaine'),
      cost === '' ? null : cost,
      ctx >= 60 ? '/clear conseillé' : null,
    ].filter((p): p is string => p !== null)
    $.ui.status(parts.join(' │ '))
  } catch {
    // the status line is a comfort: a failed read must not break a turn
  }
}

// Learnt at session.start (a reload raises it again); the terminal has its own shell status line.
let surface: string | null = null

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    surface = e.surface
    if (surface !== 'terminal') await refresh($)

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (surface !== 'terminal') await refresh($)

    return yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (surface !== 'terminal') await refresh($)

    return next(e)
  })
}
