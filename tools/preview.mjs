// Renders every personalization into tools/preview.html, close to how the desktop
// band lays it out: the texture's paint over the app's frame, its drawing and the
// themed controls, at three usage levels. Run: node tools/preview.mjs
import { writeFileSync } from 'node:fs'
import { THEMES, figures, windows, themeParts, plainBar, plainColor, controlIcon } from '../hooks/themes.js'

const now = Date.now()
const thursday = new Date()
thursday.setHours(12, 0, 0, 0)
thursday.setDate(thursday.getDate() + ((11 - thursday.getDay()) % 7 || 7))

const img = (d) => `<img alt="${d.alt}" width="${d.width}" height="${d.height}" src="data:image/svg+xml;base64,${Buffer.from(d.source).toString('base64')}">`
const controls = (id) => `<span class="ctl">${img(controlIcon(id, 'brush'))}${img(controlIcon(id, 'chevron'))}</span>`

function band(id, f) {
  const p = themeParts(id, f)
  if (!p) {
    const rows = windows(f)
    const v = (u) => `<b style="${plainColor(u) ? 'color:' + plainColor(u) : ''}">${u}% usado</b>`
    return `<div class="row">
      <div class="col dim">${rows.map((r) => `<span>${r.label}</span>`).join('')}</div>
      <div class="col">${rows.map((r) => img(plainBar(r.used))).join('')}</div>
      <div class="col">${rows.map((r) => v(r.used)).join('')}</div>
      <div class="col dim">${rows.map((r) => `<span>${r.reset}</span>`).join('')}</div>
      <div class="grow"></div>${controls(id)}</div>`
  }
  // The texture paints the app's whole frame, its title bar across the top
  const head = p.header
  const paint = head ? `background:linear-gradient(${head.bg} 0 32px, ${p.bg} 32px)` : `background:${p.bg}`
  return `<div class="col fill" style="${paint}">${head ? `<div class="row" style="background:${head.bg}">${img(head.title)}<div class="grow"></div>${controls(id)}</div>` : ''}
    <div class="row" style="background:${p.bg}">${img(p.left)}<div class="grow"></div>${head ? '' : controls(id)}</div></div>`
}

const scheme = (dark) => dark
  ? '--page:#151515;--frame:#262626;--ink:#e8e6dc;--dim:#9a988f'
  : '--page:#faf9f5;--frame:#efeeea;--ink:#1f1e1d;--dim:#7a7870'

const head = `<!doctype html><meta charset="utf-8"><title>Usage Mod preview</title>
<style>
body{margin:0;padding:12px;font:13px 'Segoe UI',system-ui,sans-serif;width:880px}
.page{background:var(--page);color:var(--ink);padding:12px;border-radius:8px}
h2{font-weight:600;margin:0 0 6px;font-size:14px}
.label{color:var(--dim);margin:10px 0 3px}
.frame{background:var(--frame);border-radius:10px;padding:8px;width:841px;box-sizing:border-box}
.row{display:flex;align-items:center;gap:14px}
.col{display:flex;flex-direction:column;justify-content:center;line-height:18px}
.dim{color:var(--dim)}
.grow{flex:1}
.ctl{display:flex;gap:8px;align-items:center;padding:0 8px}
.ctl img{display:block}
.fill{margin:-8px;padding:8px 16px;border-radius:10px}
</style><body>`

const cases = [[17, 16], [46, 79], [88, 93]]
let all = head
cases.forEach(([five, week], i) => {
  const f = figures(
    [
      { kind: 'five_hour', percentUsed: five, resetsAt: new Date(now + 297 * 60000).toISOString() },
      { kind: 'seven_day', percentUsed: week, resetsAt: thursday.toISOString() },
    ],
    now,
  )
  let p = `<div class="page" style="${scheme(i === 2)}"><h2>Sessão 5h ${five}% usado · Semanal ${week}% usado</h2>`
  for (const t of THEMES) p += `<div class="label">${t.label}</div><div class="frame">${band(t.id, f)}</div>`
  p += '</div>'
  all += p
})
writeFileSync(new URL('./preview.html', import.meta.url), all)

// The README's pictures: every personalization at one usage level, light and dark.
// node tools/preview.mjs, then screenshot tools/readme-*.html into docs/
const sample = figures(
  [
    { kind: 'five_hour', percentUsed: 46, resetsAt: new Date(now + 134 * 60000).toISOString() },
    { kind: 'seven_day', percentUsed: 79, resetsAt: thursday.toISOString() },
  ],
  now,
)
for (const dark of [false, true]) {
  let p = `<div class="page" style="${scheme(dark)}">`
  for (const t of THEMES) p += `<div class="label">${t.label}</div><div class="frame">${band(t.id, sample)}</div>`
  writeFileSync(new URL(`./readme-${dark ? 'dark' : 'light'}.html`, import.meta.url), head + p + '</div>')
}
