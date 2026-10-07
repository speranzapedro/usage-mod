// Drawing for each personalization (texture) of the usage band. Pure functions, no
// mods API, so a plain Node script can render every one for a preview (tools/).
//
// On the desktop a personalization is a band painted in its own background color
// across the whole frame, holding a drawing and the controls. The drawings are SVG
// with transparent backgrounds, so they sit on that paint.
import { FONTS } from './fonts.js'

export const THEMES = [
  { id: 'padrao', label: 'Padrão' },
  { id: 'lol', label: 'League of Legends' },
  { id: 'cs', label: 'Counter-Strike' },
  { id: 'carro', label: 'Painel de carro' },
  { id: 'sims', label: 'The Sims' },
  { id: 'pokemon', label: 'Pokémon' },
  { id: 'pacman', label: 'Pac-Man' },
  { id: 'win95', label: 'Windows 95' },
]

export const isTheme = (id) => THEMES.some((t) => t.id === id)

// ---------------------------------------------------------------------------
// Figures shared by every theme

const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)))
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const pad2 = (v) => String(v).padStart(2, '0')

// rateLimits from $.session.usage() -> the numbers and reset strings every theme draws.
// percentUsed is how much of the window is used, as in Claude's own usage screen.
export function figures(rateLimits, now) {
  const five = rateLimits.find((r) => r.kind === 'five_hour')
  const week = rateLimits.find((r) => r.kind === 'seven_day')
  if (!five && !week) return null

  let fiveIn = '—'
  if (five?.resetsAt) {
    const mins = Math.max(0, Math.round((Date.parse(five.resetsAt) - now) / 60000))
    const h = Math.floor(mins / 60)
    const m = mins % 60
    fiveIn = h > 0 ? `${h}h ${pad2(m)}min` : `${m}min`
  }
  let weekAt = '—'
  if (week?.resetsAt) {
    const d = new Date(week.resetsAt)
    weekAt = `${WEEKDAYS[d.getDay()]}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  }
  return { five: clamp(five?.percentUsed ?? 0), week: clamp(week?.percentUsed ?? 0), fiveIn, weekAt }
}

// What every texture says, in this order and these words: the window, how much of
// it is used, and when it resets
export function windows(f) {
  return [
    { label: 'Sessão 5h', used: f.five, reset: `reinicia em ${f.fiveIn}` },
    { label: 'Semanal', used: f.week, reset: `reinicia ${f.weekAt}` },
  ]
}

const usageAlt = (f) => windows(f).map((r) => `${r.label}: ${r.used}% usado, ${r.reset}`).join('. ')

// Bar color for the plain theme: neutral, then clay from 75%, red from 90%
export const plainColor = (used) => (used >= 90 ? '#e5674f' : used >= 75 ? '#d97757' : undefined)

// ---------------------------------------------------------------------------
// SVG helpers

const TAHOMA = "Tahoma, 'MS Sans Serif', 'Segoe UI', sans-serif"
// Embedded fonts (fonts.js), each with a system fallback
const PRESS = 'UMPress, Consolas, monospace'
const CINZEL = 'UMCinzel, Georgia, serif'
const BARLOW = "UMBarlow, Bahnschrift, 'Arial Narrow', sans-serif"
const NUNITO = "UMNunito, 'Segoe UI', sans-serif"

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const n = (v) => Math.round(v * 100) / 100
const upper = (s) => s.toUpperCase()
const capital = (s) => s[0].toUpperCase() + s.slice(1)

function attrs(o) {
  return [
    o.family ? `font-family="${o.family}"` : '',
    o.size ? `font-size="${o.size}"` : '',
    o.fill ? `fill="${o.fill}"` : '',
    o.weight ? `font-weight="${o.weight}"` : '',
    o.anchor ? `text-anchor="${o.anchor}"` : '',
    o.spacing ? `letter-spacing="${o.spacing}"` : '',
  ].filter(Boolean).join(' ')
}

// One line of text; `runs` is a string, or [text, options] pairs drawn as tspans
function text(x, y, runs, o = {}) {
  const base = { family: TAHOMA, size: 12, fill: '#000', ...o }
  const body = typeof runs === 'string'
    ? esc(runs)
    : runs.map(([s, ro = {}]) => `<tspan ${attrs(ro)}>${esc(s)}</tspan>`).join('')
  return `<text x="${n(x)}" y="${n(y)}" ${attrs(base)}>${body}</text>`
}

// Text centered on a row: the baseline sits a third of the font size below the center
const midText = (x, cy, s, o) => text(x, cy + o.size * 0.36, s, o)

// @font-face rules for the fonts a drawing uses, each font inlined as a data URL
function fontStyle(keys) {
  if (!keys.length) return ''
  const faces = keys.map((k) => {
    const f = FONTS[k]
    return `@font-face{font-family:${f.family};font-weight:${f.weight};src:url(data:font/woff2;base64,${f.data}) format('woff2')}`
  })
  return `<style>${faces.join('')}</style>`
}

// One drawing: a transparent SVG of the given size
function draw(w, h, body, alt, { defs = '', fonts = [] } = {}) {
  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${fontStyle(fonts)}<defs>${defs}</defs>${body}</svg>`,
    width: w,
    height: h,
    alt,
  }
}

// The layout every texture shares, taken from the Windows 95 one: a row per window
// with its label, the texture's bar, "X% usado" and "reinicia …". Each texture
// brings its own drawing for those four, in columns of `cols` widths.
function usageRows(f, { cy, cols: [labelW, barW, pctW, resetW], gap = 12, label, bar, pct, reset }) {
  const pctX = labelW + barW + gap
  const resetX = pctX + pctW
  let body = ''
  windows(f).forEach((r, i) => {
    body += label(0, cy[i], r.label, i) + bar(labelW, cy[i], barW, r.used, i) +
      pct(pctX, cy[i], `${r.used}% usado`, r.used, i) + reset(resetX, cy[i], r.reset, i)
  })
  return { body, width: resetX + resetW }
}

// ---------------------------------------------------------------------------
// The plain theme's bar, drawn between native text so it adapts to the app's theme

export function plainBar(used) {
  const w = 200
  const fill = plainColor(used) ?? '#8f8d86'
  return draw(w, 18,
    `<rect x="0" y="7" width="${w}" height="4" rx="2" fill="rgba(128,128,128,.28)"/>` +
    `<rect x="0" y="7" width="${n(Math.max(4, (w * used) / 100))}" height="4" rx="2" fill="${fill}"/>`,
    `${used}% usado`)
}

// ---------------------------------------------------------------------------
// Textures: each returns { bg, ink, left, header? }
// `ink` is the color of the band's own text

function lol(f) {
  const h = 54
  const defs =
    '<linearGradient id="mp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4aa8ff"/><stop offset="1" stop-color="#1d5fa8"/></linearGradient>' +
    '<linearGradient id="hp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#45c862"/><stop offset="1" stop-color="#1b7a33"/></linearGradient>'
  const { body, width } = usageRows(f, {
    cy: [17, 38],
    cols: [100, 230, 82, 150],
    label: (x, cy, s) => midText(x, cy, upper(s), { family: CINZEL, size: 11, weight: 700, fill: '#c8aa6e', spacing: 1.5 }),
    // Mana blue for the 5-hour window, health green for the week, both filling as they're used
    bar: (x, cy, w, used, i) => {
      const y = cy - 7.5
      let g = `<rect x="${x}" y="${y}" width="${w}" height="15" fill="#0a1414" stroke="#785a28"/>`
      g += `<rect x="${x + 1}" y="${y + 1}" width="${n((w - 2) * used / 100)}" height="13" fill="url(#${i ? 'hp' : 'mp'})"/>`
      for (let k = 1; k < 10; k++) g += `<rect x="${n(x + (w * k) / 10)}" y="${y + 1}" width="1.5" height="13" fill="rgba(0,0,0,.5)"/>`
      return g
    },
    pct: (x, cy, s) => midText(x, cy, s, { family: BARLOW, size: 13, weight: 600, fill: '#f0e6d2' }),
    reset: (x, cy, s) => midText(x, cy, s, { family: BARLOW, size: 13, weight: 500, fill: '#a09b8c' }),
  })
  return { bg: '#010a13', ink: '#c8aa6e', left: draw(width, h, body, usageAlt(f), { defs, fonts: ['cinzel700', 'barlow500', 'barlow600'] }) }
}

// The HUD's bottom bar rather than rows: one stat per window side by side, each an
// icon, big numerals "17% USADO" over a thin bar, and beside them the window's name
// and when it resets
function cs(f) {
  const h = 56
  const cream = '#e3d7b0'
  const hot = (used) => (used >= 75 ? '#ff5a4f' : cream)
  // The HUD's armor for the 5-hour window and health for the week, as in the game
  const stats = [
    ['COLETE', 'M11.5 0 3 3.2v6.2c0 5.4 3.6 9.8 8.5 11.6 4.9-1.8 8.5-6.2 8.5-11.6V3.2z'],
    ['VIDA', 'M8 0h7v8h8v7h-8v8H8v-8H0V8h8z'],
  ]
  let l = ''
  windows(f).forEach((r, i) => {
    const x = i * 330
    const c = hot(r.used)
    const [stat, icon] = stats[i]
    l += `<path transform="translate(${x} 16)" fill="${c}" d="${icon}"/>`
    l += text(x + 34, 39, [[`${r.used}%`, { size: 34 }], [' USADO', { size: 13, spacing: 1 }]], { family: BARLOW, weight: 600, fill: c })
    l += `<rect x="${x + 34}" y="46" width="112" height="3" fill="rgba(227,215,176,.18)"/>`
    l += `<rect x="${x + 34}" y="46" width="${n(112 * r.used / 100)}" height="3" fill="${c}"/>`
    l += text(x + 160, 26, `${stat} · ${upper(r.label)}`, { family: BARLOW, size: 13, weight: 600, fill: cream, spacing: 1 })
    l += text(x + 160, 44, upper(r.reset), { family: BARLOW, size: 13, weight: 500, fill: '#8d8a7e', spacing: 1 })
  })
  return { bg: '#141516', ink: cream, left: draw(640, h, l, usageAlt(f), { fonts: ['barlow500', 'barlow600'] }) }
}

// A semicircle gauge in a 100 x 58 box, the needle at fraction p
function gauge(p, zone, ticks, labels) {
  const pt = (q, r) => [50 - r * Math.cos(Math.PI * q), 50 - r * Math.sin(Math.PI * q)]
  const arc = (a, b) => {
    const [x0, y0] = pt(a, 40)
    const [x1, y1] = pt(b, 40)
    return `M${n(x0)} ${n(y0)}A40 40 0 0 1 ${n(x1)} ${n(y1)}`
  }
  let g = `<path d="${arc(0, 1)}" fill="none" stroke="#2c3036" stroke-width="3"/>`
  g += `<path d="${arc(zone[0], zone[1])}" fill="none" stroke="${zone[2]}" stroke-width="3"/>`
  for (let i = 0; i <= ticks; i++) {
    const [x0, y0] = pt(i / ticks, 31)
    const [x1, y1] = pt(i / ticks, 37)
    g += `<line x1="${n(x0)}" y1="${n(y0)}" x2="${n(x1)}" y2="${n(y1)}" stroke="#8b9199" stroke-width="1.6"/>`
  }
  for (const [q, s] of labels) {
    const [x, y] = pt(q, 23)
    g += text(x, y + 3, s, { family: BARLOW, size: 9, weight: 600, fill: '#8b9199', anchor: 'middle' })
  }
  g += `<line x1="50" y1="50" x2="50" y2="15" stroke="#ff6a3d" stroke-width="2.4" stroke-linecap="round" transform="rotate(${n(-90 + 180 * p)} 50 50)"/>`
  g += '<circle cx="50" cy="50" r="4" fill="#e9ecef"/>'
  return g
}

// The dashboard keeps its gauges: one per window, side by side, each with its
// label, "X% usado" and "reinicia …" beside it. The needle climbs as it's used.
function carro(f) {
  const h = 68
  const lab = { family: BARLOW, size: 12, weight: 500, fill: '#8b9199', spacing: 2 }
  const sub = { family: BARLOW, size: 13, weight: 500, fill: '#8b9199' }
  let l = ''
  windows(f).forEach((r, i) => {
    const x = i * 300
    const hot = r.used >= 80
    l += `<g transform="translate(${x} 4) scale(1.08)">${gauge(r.used / 100, [0.8, 1, '#ff5a3d'], 10, [[0, '0'], [0.5, '50'], [1, '100']])}</g>`
    l += text(x + 122, 21, upper(r.label), lab)
    l += text(x + 122, 46, [[`${r.used}%`, { size: 26, weight: 600, fill: hot ? '#ff5a3d' : '#e9ecef' }], [' usado', { size: 14, weight: 500, fill: '#c3c8ce' }]], { family: BARLOW })
    l += text(x + 122, 62, r.reset, sub)
  })
  return { bg: '#0e1013', ink: '#e9ecef', left: draw(560, h, l, usageAlt(f), { fonts: ['barlow500', 'barlow600'] }) }
}

function sims(f) {
  const h = 58
  const level = (used) => (used < 50 ? '#3fbf4f' : used < 75 ? '#e9c22e' : '#e5483a')
  const pb = level(Math.max(f.five, f.week))
  const faces = [['12,0 0,17 12,21', 'rgba(255,255,255,.45)'], ['12,0 24,17 12,21', 'rgba(255,255,255,.15)'], ['0,17 12,21 12,40', 'rgba(0,0,0,.08)'], ['24,17 12,21 12,40', 'rgba(0,0,0,.25)']]
  const plumbob = faces.map(([p, o]) => `<polygon points="${p}" fill="${pb}"/><polygon points="${p}" fill="${o}"/>`).join('') +
    '<polygon points="12,0 24,17 12,40 0,17" fill="none" stroke="rgba(0,0,0,.3)" stroke-width=".8"/>'
  const { body, width } = usageRows(f, {
    cy: [17, 41],
    cols: [118, 210, 84, 150],
    label: (x, cy, s) => midText(x + 38, cy, s, { family: NUNITO, size: 13, weight: 800, fill: '#1d3b53' }),
    // Need bars that fill as the window is used: green, then yellow, then red
    bar: (x, cy, w, used) =>
      `<rect x="${x}" y="${cy - 7}" width="${w}" height="14" rx="7" fill="#c9d6e0"/>` +
      `<rect x="${x + 2}" y="${cy - 5}" width="${n(Math.max(10, (w - 4) * used / 100))}" height="10" rx="5" fill="${level(used)}"/>`,
    pct: (x, cy, s) => midText(x, cy, s, { family: NUNITO, size: 13, weight: 800, fill: '#1d3b53' }),
    reset: (x, cy, s) => midText(x, cy, s, { family: NUNITO, size: 12, weight: 700, fill: '#4f6a80' }),
  })
  return {
    bg: '#eaf2f8',
    ink: '#1d3b53',
    left: draw(width, h, `<g transform="translate(4 9) scale(.95)">${plumbob}</g>` + body, usageAlt(f), { fonts: ['nunito700', 'nunito800'] }),
  }
}

function pokemon(f) {
  const h = 54
  const t = (x, cy, s, fill = '#303030') => midText(x, cy, upper(s), { family: PRESS, size: 8, fill })
  // EXP bars, blue for the 5-hour window and orange for the week, filling as they're used
  const colors = ['#40a8f8', '#f8a030']
  const { body, width } = usageRows(f, {
    cy: [17, 38],
    cols: [84, 236, 92, 160],
    label: (x, cy, s) => t(x, cy, s),
    bar: (x, cy, w, used, i) => {
      const y = cy - 6.5
      const bx = x + 30
      const bw = w - 30
      return `<rect x="${x}" y="${y}" width="${w}" height="13" fill="#303030"/>` +
        midText(x + 15, cy, 'EXP', { family: PRESS, size: 7, fill: colors[i], anchor: 'middle' }) +
        `<rect x="${bx}" y="${y + 2}" width="${bw - 2}" height="9" fill="#e0e0c8"/>` +
        `<rect x="${bx}" y="${y + 2}" width="${n((bw - 2) * used / 100)}" height="9" fill="${colors[i]}"/>`
    },
    pct: (x, cy, s) => t(x, cy, s),
    reset: (x, cy, s) => t(x, cy, s, '#686868'),
  })
  return { bg: '#f8f8d8', ink: '#303030', left: draw(width, h, body, usageAlt(f), { fonts: ['press400'] }) }
}

function pacman(f) {
  const h = 58
  const pac = (cx, cy) => `<path d="M${n(cx)} ${cy}L${n(cx + 6.06)} ${cy - 3.5}A7 7 0 1 0 ${n(cx + 6.06)} ${cy + 3.5}Z" fill="#ffe600"/>`
  const ghost = (x, y, c) =>
    `<g transform="translate(${x} ${y})"><path d="M1 14V7a6 6 0 0 1 12 0v7l-2-2-2 2-2-2-2 2-2-2z" fill="${c}"/>` +
    '<circle cx="5" cy="6.5" r="2" fill="#fff"/><circle cx="9.5" cy="6.5" r="2" fill="#fff"/>' +
    '<circle cx="5.8" cy="6.9" r="1" fill="#2121de"/><circle cx="10.3" cy="6.9" r="1" fill="#2121de"/></g>'
  const t = (fill) => ({ family: PRESS, size: 8, fill })
  const { body, width } = usageRows(f, {
    cy: [15, 43],
    cols: [84, 232, 92, 160],
    label: (x, cy, s) => midText(x, cy, upper(s), t('#ffe600')),
    // A maze corridor: Pac-Man has eaten the dots behind him, the share that's used
    bar: (x, cy, w, used, i) => {
      let g = `<rect x="${x}" y="${cy - 12}" width="${w}" height="24" rx="5" fill="none" stroke="#2121de" stroke-width="2"/>`
      const frac = used / 100
      const run = w - 44
      for (let k = 0; k < 18; k++) {
        const p = (k + 0.5) / 18
        if (p < frac) continue
        g += `<rect x="${n(x + 14 + p * run)}" y="${cy - 1.5}" width="3" height="3" fill="#ffb8ae"/>`
      }
      g += pac(x + 12 + run * frac, cy)
      g += ghost(x + w - 20, cy - 7, i ? '#ffb8ff' : '#ff0000')
      return g
    },
    pct: (x, cy, s) => midText(x, cy, upper(s), t('#ffffff')),
    reset: (x, cy, s) => midText(x, cy, upper(s), t('#b0b0b0')),
  })
  return { bg: '#000000', ink: '#ffe600', left: draw(width, h, body, usageAlt(f), { fonts: ['press400'] }) }
}

function win95(f) {
  const h = 52
  const t = { family: TAHOMA, size: 12, fill: '#000' }
  const { body, width } = usageRows(f, {
    cy: [14, 37],
    cols: [76, 250, 74, 150],
    gap: 10,
    label: (x, cy, s) => midText(x, cy, s, t),
    // The copy dialog's sunken field, filling with blocks as the window is used
    bar: (x, cy, w, used) => {
      const y = cy - 8
      let g = `<rect x="${x}" y="${y}" width="${w}" height="16" fill="#fff"/>`
      g += `<path d="M${x + 0.5} ${y + 15.5}V${y + 0.5}H${x + w - 0.5}" fill="none" stroke="#808080"/><path d="M${x + 0.5} ${y + 15.5}H${x + w - 0.5}V${y + 0.5}" fill="none" stroke="#fff"/>`
      const inner = (w - 6) * used / 100
      for (let k = 0; k + 8 <= inner; k += 10) g += `<rect x="${x + 3 + k}" y="${y + 3}" width="8" height="10" fill="#000080"/>`
      return g
    },
    pct: (x, cy, s) => midText(x, cy, s, t),
    reset: (x, cy, s) => midText(x, cy, capital(s), t),
  })
  return {
    bg: '#c0c0c0',
    ink: '#000000',
    header: {
      bg: '#000080',
      h: 24,
      title: draw(240, 24, text(2, 16.5, 'Copiando seu uso do Claude…', { ...t, weight: 700, fill: '#fff' }), 'Copiando seu uso do Claude'),
    },
    left: draw(width, h, body, usageAlt(f)),
  }
}

const TEXTURES = { lol, cs, carro, sims, pokemon, pacman, win95 }

// The parts of a texture, or null for the plain theme (drawn with native text)
export function themeParts(theme, f) {
  const make = TEXTURES[theme]
  return make ? make(f) : null
}

// The band's rounded corners. A personalization paints over the app's whole frame,
// whose clip is square, so each corner is masked in the page's own color, light or
// dark (measured on the desktop app: #fcfcfb and #151515), to the chat box's 12px radius.
export const CORNER_RADIUS = 12
const PAGE = '<style>.pg{fill:#fcfcfb}@media (prefers-color-scheme: dark){.pg{fill:#151515}}</style>'
// An Svg needs a non-empty alt: with an empty one the desktop drops it
const CORNER_ALT = 'Canto arredondado'

// The top-left corner, in a box that starts `oy` px above the frame's top edge (one
// 20px row less the frame's 12px margin; the app clips that part)
export function topLeftCorner(oy = 8) {
  const r = CORNER_RADIUS
  return draw(r, oy + r, `${PAGE}<path class="pg" d="M0 0H${r}V${oy}A${r} ${r} 0 0 0 0 ${oy + r}Z"/>`, CORNER_ALT)
}

// The bottom-left corner, on the bottom margin `h` px tall
export function bottomLeftCorner(h) {
  const r = CORNER_RADIUS
  return draw(r, h, `${PAGE}<path class="pg" d="M0 ${h - r}V${h}H${r}A${r} ${r} 0 0 1 0 ${h - r}Z"/>`, CORNER_ALT)
}

// A piece of the band's right margin, `w` px wide and `h` tall, in `fill`, with the
// frame's corner masked: 'tr' at (w, oy), the box starting `oy` px above the frame
// like the top-left corner's; 'br' at (w, h). The margin is painted to the pixel: a
// Box reaching past it, by a fraction of a pixel even, makes the band scroll.
export function marginPiece(w, h, fill, at, oy = 8) {
  const r = CORNER_RADIUS
  const mask = at === 'tr'
    ? `<rect class="pg" width="${w}" height="${oy}"/><path class="pg" d="M${w - r} ${oy}H${w}V${oy + r}A${r} ${r} 0 0 0 ${w - r} ${oy}Z"/>`
    : `<path class="pg" d="M${w} ${h - r}V${h}H${w - r}A${r} ${r} 0 0 0 ${w} ${h - r}Z"/>`
  return draw(w, h, `${PAGE}<rect width="${w}" height="${h}" fill="${fill}"/>${mask}`, 'Margem do cartão')
}

// A transparent drawing that only gives its Box a size in pixels
export const spacerSvg = (w, h) => draw(w, h, '', 'Espaço')

// The brush and chevron controls, drawn in each texture's own button style, as in
// the prototype. The band lays an invisible native button over each one for the click.
const BRUSH_PATH = 'M19.5 3.5a2.1 2.1 0 0 1 3 3L13 16l-3-3z M10 13c-2.4 0-4.2 1.8-4.2 4.2 0 1.5-.8 2.6-2.3 3.3 1.3 1 3 1.5 4.6 1.5 3 0 5-2.2 5-5'
const CHEVRON_PATH = 'm6 9 6 6 6-6'

const CONTROL_STYLES = {
  // w, h: the button; frame: its chrome as SVG; ink: the icon's color
  padrao: { w: 26, h: 24, ink: '#8f8d86', frame: () => '' },
  lol: { w: 28, h: 24, ink: '#c8aa6e', frame: (w, h) =>
    `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" fill="#1e2328" stroke="#785a28"/>` },
  cs: { w: 26, h: 24, ink: '#8d8a7e', frame: () => '' },
  carro: { w: 26, h: 24, ink: '#8b9199', frame: () => '' },
  sims: { w: 26, h: 26, ink: '#1d3b53', frame: (w, h) =>
    `<circle cx="${w / 2}" cy="${h / 2}" r="${w / 2 - 1}" fill="#fff" stroke="#b8c8d6"/>` },
  pokemon: { w: 28, h: 24, ink: '#303030', frame: (w, h) =>
    `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="4" fill="#f8f8d8" stroke="#303030" stroke-width="2"/>` },
  pacman: { w: 28, h: 24, ink: '#ffffff', frame: (w, h) =>
    `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="6" fill="#000" stroke="#2121de" stroke-width="2"/>` },
  win95: { w: 20, h: 18, ink: '#000000', frame: (w, h) =>
    `<rect width="${w}" height="${h}" fill="#c0c0c0"/>` +
    `<path d="M0.5 ${h - 0.5}V0.5H${w - 0.5}" fill="none" stroke="#fff"/><path d="M0.5 ${h - 0.5}H${w - 0.5}V0.5" fill="none" stroke="#000"/>` +
    `<path d="M1.5 ${h - 1.5}H${w - 1.5}V1.5" fill="none" stroke="#808080"/>` },
}

export function controlIcon(theme, kind) {
  const s = CONTROL_STYLES[theme] ?? CONTROL_STYLES.padrao
  const size = Math.min(s.w, s.h) - 10
  const icon = kind === 'brush' ? BRUSH_PATH : CHEVRON_PATH
  const scale = size / 24
  const body = s.frame(s.w, s.h) +
    `<path d="${icon}" transform="translate(${n((s.w - size) / 2)} ${n((s.h - size) / 2)}) scale(${n(scale)})" fill="none" stroke="${s.ink}" stroke-width="${n(1.9 / scale)}" stroke-linecap="round" stroke-linejoin="round"/>`
  return draw(s.w, s.h, body, kind === 'brush' ? 'Personalizar' : 'Esconder')
}

// Thumbnails for the texture picker, as in the prototype's menu
export function themeThumb(id) {
  const w = 34
  const h = 22
  const box = (fill, inner, stroke = '') =>
    `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="4" fill="${fill}" ${stroke ? `stroke="${stroke}"` : ''}/>${inner}`
  const bar = (x, y, bw, fill, track = 'rgba(128,128,128,.35)', bh = 3) =>
    `<rect x="${x}" y="${y}" width="${w - 2 * x}" height="${bh}" rx="${bh / 2}" fill="${track}"/><rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="${bh / 2}" fill="${fill}"/>`
  const thumbs = {
    padrao: box('rgba(128,128,128,.12)', bar(5, 7, 12, '#9a988f') + bar(5, 13, 19, '#d97757')),
    lol: box('#010a13', bar(4, 7, 12, '#2f86d6', '#0a1020', 3) + bar(4, 13, 18, '#2ea34a', '#0a1414', 4), '#785a28'),
    cs: box('#141516', bar(5, 7, 12, '#e3d7b0', 'rgba(227,215,176,.18)', 2) + bar(5, 13, 19, '#e3d7b0', 'rgba(227,215,176,.18)', 2)),
    carro: box('#0e1013', `<g transform="translate(6 3) scale(.22)">${gauge(0.7, [0.8, 1, '#ff5a3d'], 4, [])}</g>`),
    sims: box('#eaf2f8', '<polygon transform="translate(13 3) scale(.42)" points="12,0 24,17 12,40 0,17" fill="#3fbf4f"/>'),
    pokemon: box('#f8f8d8', `<rect x="4" y="8" width="7" height="6" fill="#303030"/>` + bar(12, 9, 10, '#40a8f8', '#506858', 4), '#484848'),
    pacman: box('#000', `<path d="M10 11L14.3 8.5A5 5 0 1 0 14.3 13.5Z" fill="#ffe600"/><rect x="18" y="10" width="2" height="2" fill="#ffb8ae"/><rect x="23" y="10" width="2" height="2" fill="#ffb8ae"/><rect x="28" y="10" width="2" height="2" fill="#ffb8ae"/>`),
    win95: box('#c0c0c0', `<rect x="2" y="2" width="${w - 4}" height="5" fill="#000080"/><rect x="4" y="11" width="${w - 8}" height="6" fill="#fff"/><rect x="5" y="12" width="14" height="4" fill="#000080"/>`),
  }
  const label = THEMES.find((t) => t.id === id)?.label ?? id
  return draw(w, h, thumbs[id] ?? '', label)
}
