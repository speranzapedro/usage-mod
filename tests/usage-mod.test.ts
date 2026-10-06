import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'usage-mod',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  viewport: { columns: 120, rows: 40 },
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 12,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 12 },
    view: {},
  },
} as const

const FOOTER = {
  plugin: 'usage-mod',
  component: 'SessionMode',
  requestId: 'session-mode',
  viewport: { columns: 120, rows: 40 },
  props: { modes: [] },
} as const

const LIMITS = [
  { kind: 'five_hour', percentUsed: 42, resetsAt: new Date(Date.now() + 134 * 60000).toISOString() },
  { kind: 'seven_day', percentUsed: 68, resetsAt: new Date(Date.now() + 3 * 86400000).toISOString() },
]

const THEMES = ['padrao', 'lol', 'cs', 'carro', 'sims', 'pokemon', 'pacman', 'win95']

function setup(on) {
  const saved = new Map<string, unknown>()
  on('store.get', ($, e) => ({ value: saved.get(e.key) }))
  on('store.set', ($, e) => {
    saved.set(e.key, e.value)
    return { value: undefined }
  })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('session.usage', () => ({ value: { rateLimits: LIMITS } }))
  // What Claude Code draws at a site when the mod passes it on
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['drawn by Claude Code'] }))
  return saved
}

test('every texture draws a valid band on the terminal and the desktop', async ($, on) => {
  setup(on)
  await $.session.measure({ context: { window: 200000 }, rateLimits: LIMITS, changed: ['rateLimits'] })

  for (const theme of THEMES) {
    const answer = await $.command.run({ command: 'uso-tema', args: theme })
    expect(answer.text).toMatch(/^Personalização: /)

    const desktop = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await desktop.find({ type: 'Svg' })).toBeDefined()
    expect(await desktop.find({ key: 'texture' })).toBeDefined()
    expect(await desktop.find({ key: 'hide' })).toBeDefined()
    if (theme === 'padrao') {
      expect(await desktop.find({ type: 'Text', text: '42% usado' })).toBeDefined()
    } else {
      // The personalization paints the whole band, with the controls inside it
      expect(await desktop.find({ key: 'texture-band' })).toBeDefined()
      expect(await desktop.find({ key: 'texture-card' })).toBeDefined()
    }
    await desktop.unmount()

    const terminal = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await terminal.find({ type: 'Text', text: /%/ })).toBeDefined()
    expect(await terminal.find({ type: 'Svg' })).toBeUndefined()
    await terminal.unmount()
  }
})

test('hiding empties the band and leaves "▴ uso" in the footer, which brings it back', async ($, on) => {
  const saved = setup(on)
  await $.session.measure({ context: { window: 200000 }, rateLimits: LIMITS, changed: ['rateLimits'] })

  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const footer = await $.ui.mount({ ...FOOTER, surface: 'desktop' })
  expect(await footer.find({ key: 'show' })).toBeUndefined()

  await band.press({ key: 'hide' })
  expect(saved.get('hidden')).toBe(true)
  expect(await band.find({ key: 'texture' })).toBeUndefined()
  expect(await footer.find({ key: 'show' })).toBeDefined()
  // Claude Code's own footer labels stay
  expect(await footer.find({ type: 'Text', text: 'drawn by Claude Code' })).toBeDefined()

  await footer.press({ key: 'show' })
  expect(saved.get('hidden')).toBe(false)
  expect(await band.find({ key: 'texture' })).toBeDefined()
  expect(await footer.find({ key: 'show' })).toBeUndefined()
})

test('the brush opens the picker and picking saves the texture', async ($, on) => {
  const saved = setup(on)
  await $.session.measure({ context: { window: 200000 }, rateLimits: LIMITS, changed: ['rateLimits'] })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'texture' })
  // A grid of tiles, one per texture, each with its thumbnail
  expect(await ui.find({ key: 'texture-menu' })).toBeDefined()
  expect(await ui.find({ key: 'tile-pacman' })).toBeDefined()
  await ui.press({ key: 'pick-win95' })
  expect(saved.get('theme')).toBe('win95')
  expect(await ui.find({ key: 'texture-menu' })).toBeUndefined()
  // Windows 95 draws its title bar inside the rounded card
  expect(await ui.find({ key: 'texture-header' })).toBeDefined()
  expect(await ui.find({ key: 'texture-card' })).toBeDefined()

  // The thumbnail picks too, not only the name
  await ui.press({ key: 'texture' })
  await ui.press({ key: 'thumb-pacman' })
  expect(saved.get('theme')).toBe('pacman')
  expect(await ui.find({ key: 'texture-menu' })).toBeUndefined()
  await ui.press({ key: 'texture' })
  await ui.press({ key: 'pick-win95' })
  expect(saved.get('theme')).toBe('win95')

  // The ✕ closes the menu without changing the texture
  await ui.press({ key: 'texture' })
  await ui.press({ key: 'close-menu' })
  expect(await ui.find({ key: 'texture-menu' })).toBeUndefined()
  expect(saved.get('theme')).toBe('win95')
})

test('without limits yet, the band explains where the numbers come from', async ($, on) => {
  const saved = new Map<string, unknown>()
  on('store.get', ($, e) => ({ value: saved.get(e.key) }))
  on('session.usage', () => ({ value: { rateLimits: [] } }))
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /primeira resposta/ })).toBeDefined()
})

test('when reading the limits fails, the band says they are not there yet', async ($, on) => {
  const saved = new Map<string, unknown>()
  on('store.get', ($, e) => ({ value: saved.get(e.key) }))
  on('session.usage', () => {
    throw new Error('offline')
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /primeira resposta/ })).toBeDefined()
  expect(await ui.find({ key: 'texture' })).toBeDefined()
})

test('/uso-tema with an unknown name lists the personalizations', async ($, on) => {
  setup(on)
  const answer = await $.command.run({ command: 'uso-tema', args: 'nada' })
  expect(answer.text).toMatch(/^Personalizações: /)
  expect(answer.text).not.toMatch(/demo/)
})
