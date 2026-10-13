import type { EngineInterface, Register } from 'claude-code'

const ORANGE = '#ff9f43'
const BLUE = '#4da3ff'

// Blue while fresh, orange past 60 %, red past 85 %.
export const tone = (pct: number): string => (pct >= 85 ? 'error' : pct >= 60 ? ORANGE : BLUE)

export const gauge = (pct: number) => {
  const filled = Math.min(8, Math.floor(pct / 12.5 + 0.5))
  return { on: '▓'.repeat(filled), off: '░'.repeat(8 - filled) }
}

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
    const parts = [
      folderOf(cwd),
      `Contexte ${g.on}${g.off} ${ctx}%`,
      limit('five_hour', '5h'),
      limit('seven_day', 'Semaine'),
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
