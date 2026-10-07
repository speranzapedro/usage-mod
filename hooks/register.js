// Usage Mod: shows the 5-hour and weekly plan limits in the band above the prompt,
// with a picker of personalizations (textures) and a way to hide it completely.
import { THEMES, isTheme, figures, windows, themeParts, plainBar, plainColor, themeThumb, topLeftCorner, bottomLeftCorner, marginPiece, spacerSvg, controlIcon } from './themes.js'

// What the band shows, shared by every hook below
let theme = 'padrao'
let hidden = false
let menuOpen = false
let limits = []

const themeLabel = (id) => THEMES.find((t) => t.id === id)?.label ?? id

// The band's margins past the rows, in pixels, measured on the desktop app with the
// mouse wheel (Claude Code 2.1.288): a bottom margin of 10px is the most that doesn't
// make the band scroll (10.25px already does), and the right one takes 9px. If a later
// app changes the band's frame, a sliver or the scroll may come back: tune these.
const RIGHT_MARGIN = 9
const BOTTOM_MARGIN = 10

export function register(on) {
  on('session.start', async ($, e, next) => {
    const savedTheme = await $.store.get('theme')
    if (typeof savedTheme === 'string' && isTheme(savedTheme)) theme = savedTheme
    hidden = (await $.store.get('hidden')) === true

    await $.command.register({ name: 'uso', description: 'Mostra ou esconde a barra de uso acima do chat (app desktop)', immediate: true })
    await $.command.register({
      name: 'uso-tema',
      description: 'Troca a personalização da barra de uso (app desktop): ' + THEMES.map((t) => t.id).join(', '),
      immediate: true,
    })

    // The reset countdowns move even when nothing else does
    $.clock.every(30000, () => $.ui.invalidate('ui.render'))
    return next(e)
  })

  // Claude Code pushes fresh limits after each turn and when a window moves a point
  on('session.measure', async ($, e, next) => {
    limits = e.rateLimits ?? []
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('command.run', { command: 'uso' }, async ($) => {
    hidden = !hidden
    menuOpen = false
    await $.store.set('hidden', hidden)
    $.ui.invalidate('ui.render')
    return { text: hidden ? 'Barra de uso escondida. Use "▴ uso" no rodapé ou /uso para mostrar de novo.' : 'Barra de uso visível.' }
  })

  on('command.run', { command: 'uso-tema' }, async ($, e) => {
    const wanted = String(e.args ?? '').trim().toLowerCase()
    if (!isTheme(wanted)) {
      return { text: 'Personalizações: ' + THEMES.map((t) => `${t.id} (${t.label})`).join(', ') + `. Atual: ${theme}.` }
    }
    theme = wanted
    hidden = false
    await $.store.set('theme', theme)
    await $.store.set('hidden', false)
    $.ui.invalidate('ui.render')
    return { text: `Personalização: ${themeLabel(theme)}.` }
  })

  // Hidden: the band is gone (anything drawn there gets the app's full-width frame),
  // and a small "▴ uso" sits among the prompt's footer labels to bring it back
  // The mod draws on the desktop app only: in a terminal, Claude Code goes on as without it
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    if (!hidden || e.surface === 'terminal') return next(e)
    const { Box, Button } = $.ui.resolve(e)
    const theirs = await next(e)
    return Box({
      flexDirection: 'row',
      columnGap: 2,
      alignItems: 'center',
      children: [
        theirs,
        Button({
          key: 'show',
          label: '▴ uso',
          plain: true,
          dimColor: true,
          onPress: async () => {
            hidden = false
            await $.store.set('hidden', false)
            $.ui.invalidate('ui.render')
          },
        }),
      ],
    })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // A survey holds the band, the person hid it, or a terminal draws it: draw nothing here
    if (e.props.hasSurvey || hidden || e.surface === 'terminal') return next(e)
    const els = $.ui.resolve(e)
    if (!els.Svg) return next(e)
    const { Box, Text, Button } = els

    // Before the first turn's measure, ask for the limits; if that fails, the band
    // says the numbers aren't there yet rather than breaking
    let rateLimits = limits
    if (rateLimits.length === 0) {
      try {
        rateLimits = (await $.session.usage()).rateLimits ?? []
      } catch {
        rateLimits = []
      }
    }
    const f = figures(rateLimits, Date.now())
    const spacer = Box({ flexGrow: 1 })

    const svg = (d) => els.Svg({ source: d.source, alt: d.alt, width: d.width, height: d.height })
    // A blank of a drawing's size, for the copies that only hold space or show a color
    const blank = (d) => svg(spacerSvg(d.width, d.height))
    const toggleMenu = () => {
      menuOpen = !menuOpen
      $.ui.invalidate('ui.render')
    }
    const hide = async () => {
      hidden = true
      menuOpen = false
      await $.store.set('hidden', true)
      $.ui.invalidate('ui.render')
    }

    // A drawing that takes clicks: the Svg, and a native button with a blank label lying
    // over it. One blank only: a longer label overflowed the small controls and the app
    // drew its "…"
    const clickable = (key, drawing, onPress) =>
      Box({
        key: key + '-control',
        position: 'relative',
        children: [
          svg(drawing),
          Box({
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            flexDirection: 'column',
            children: [Button({ key, label: '⠀', plain: true, onPress })],
          }),
        ],
      })
    // The brush and the chevron, in the personalization's own button style
    const control = (key, kind, onPress) => clickable(key, controlIcon(theme, kind), onPress)
    const controls = Box({ flexDirection: 'row', columnGap: 1, alignItems: 'center', children: [control('texture', 'brush', toggleMenu), control('hide', 'chevron', hide)] })

    // The menu: a grid of tiles with a thumbnail each, the current one outlined
    const pick = async (id) => {
      theme = id
      menuOpen = false
      await $.store.set('theme', theme)
      $.ui.invalidate('ui.render')
    }
    // Both the thumbnail and the name pick: the name is a native button, and the
    // thumbnail is drawn like the controls, with a blank button over it. (A blank button
    // over the whole tile, inside it or beside it, took no clicks on the desktop and
    // blocked the ones below it.)
    const tile = (t) =>
      Box({
        key: 'tile-' + t.id,
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 1,
        paddingX: 1,
        width: '24%',
        borderStyle: 'round',
        borderColor: t.id === theme ? '#d97757' : '#d6d4cc',
        hover: { backgroundColor: 'rgba(128,128,128,0.14)' },
        children: [
          clickable('thumb-' + t.id, themeThumb(t.id), () => pick(t.id)),
          Button({ key: 'pick-' + t.id, label: t.label, plain: true, onPress: () => pick(t.id) }),
        ],
      })
    const rowsOf = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n))
    const menu = menuOpen
      ? Box({
          key: 'texture-menu',
          flexDirection: 'column',
          rowGap: 1,
          children: [
            Box({
              flexDirection: 'row',
              alignItems: 'center',
              children: [
                Text({ dimColor: true, children: ['PERSONALIZAÇÃO'] }),
                spacer,
                Button({ key: 'close-menu', label: '✕', plain: true, dimColor: true, onPress: () => { menuOpen = false; $.ui.invalidate('ui.render') } }),
              ],
            }),
            ...rowsOf(THEMES, 4).map((row, i) => Box({ key: 'tiles-' + i, flexDirection: 'row', columnGap: 1, children: row.map(tile) })),
          ],
        })
      : null
    // The band has a height limit (e.props.maxRows): stacked over the card, the menu
    // pushed the card past it and the app cut it off. Open, the menu takes the card's place.
    const withMenu = (band) => menu ?? band

    if (!f) {
      return withMenu(
        Box({
          flexDirection: 'row',
          columnGap: 2,
          alignItems: 'center',
          children: [
            Text({ dimColor: true, wrap: 'truncate-end', children: ['Uso do plano: aparece depois da primeira resposta do Claude.'] }),
            spacer,
            controls,
          ],
        }),
      )
    }


    const parts = themeParts(theme, f)

    // Plain theme: native text in aligned columns, on the app's own rounded band
    if (!parts) {
      const col = (key, children) => Box({ key, flexDirection: 'column', children })
      const value = (used) => Text({ bold: true, ...(plainColor(used) ? { color: plainColor(used) } : {}), children: [`${used}% usado`] })
      const rows = windows(f)
      return withMenu(
        Box({
          flexDirection: 'row',
          columnGap: 2,
          alignItems: 'center',
          children: [
            col('labels', rows.map((r) => Text({ dimColor: true, children: [r.label] }))),
            col('bars', rows.map((r) => svg(plainBar(r.used)))),
            col('values', rows.map((r) => value(r.used))),
            col('resets', rows.map((r) => Text({ dimColor: true, children: [r.reset] }))),
            spacer,
            controls,
          ],
        }),
      )
    }

    // A personalization paints the whole band, the app's own frame included. The app
    // draws the band in a gray card with a margin, and scrolls it when anything reaches
    // past that margin to the right or below, by a fraction of a pixel even. A mod's tree
    // sits inside the margin and offsets count whole cells (8.7px wide, 20px tall), so
    // only the margins above and to the left can be reached by offset (the app clips
    // what goes past them). The other two are painted to the pixel:
    //   1. the rows in the flow, as blanks of the drawings' sizes, holding the band's size;
    //   2. over them, from one row up and one cell left (clipped at the frame's top and
    //      left edges) to the rows' right edge, a column of: a row in the top color, the
    //      rows themselves with their controls, and the bottom margin;
    //   3. beside that column, past the rows' right edge, a column painting the right
    //      margin: its top, the left edge of a blank copy of the rows (so the title
    //      bar's color lines up), its bottom.
    // The four corners are masked in the page's color, so the band rounds like the
    // chat box.
    const head = parts.header
    const topColor = head ? head.bg : parts.bg
    // `draw` turns a drawing into an element: the drawing itself, or a blank of its size
    const rows = (id, draw, ctl) =>
      Box({
        key: id + '-card',
        flexDirection: 'column',
        flexGrow: 1,
        children: [
          ...(head ? [Box({ key: id + '-header', flexDirection: 'row', paddingX: 1, backgroundColor: head.bg, children: [draw(head.title), spacer, ctl] })] : []),
          Box({
            key: id + '-main',
            flexDirection: 'row',
            alignItems: 'center',
            paddingX: 1,
            backgroundColor: parts.bg,
            children: [draw(parts.left), spacer, ...(head ? [] : [Box({ paddingLeft: 2, children: [ctl] })])],
          }),
        ],
      })
    // The blank copies hold the controls' size without their buttons, so each key is
    // pressed once; each sits in a Box like a real control's, for the same height
    const blankControl = (kind) => Box({ position: 'relative', children: [blank(controlIcon(theme, kind))] })
    const blankControls = Box({ flexDirection: 'row', columnGap: 1, alignItems: 'center', children: [blankControl('brush'), blankControl('chevron')] })
    const body = Box({
      flexDirection: 'column',
      flexShrink: 0,
      width: '100%',
      children: [
        // 20px tall from its corner, like the right margin's top: a row height of 1 can
        // round to a fraction of a pixel apart and step the title bar's edge
        Box({ flexDirection: 'row', backgroundColor: topColor, children: [svg(topLeftCorner())] }),
        rows('texture', svg, controls),
        Box({ flexDirection: 'row', backgroundColor: parts.bg, children: [svg(bottomLeftCorner(BOTTOM_MARGIN))] }),
      ],
    })
    const rightMargin = Box({
      flexDirection: 'column',
      flexShrink: 0,
      overflow: 'hidden',
      children: [
        svg(marginPiece(RIGHT_MARGIN, 20, topColor, 'tr')),
        Box({
          flexGrow: 1,
          position: 'relative',
          overflow: 'hidden',
          children: [svg(spacerSvg(RIGHT_MARGIN, 1)), Box({ position: 'absolute', top: 0, bottom: 0, left: 0, flexDirection: 'row', children: [rows('texture-edge', blank, blankControls)] })],
        }),
        svg(marginPiece(RIGHT_MARGIN, BOTTOM_MARGIN, parts.bg, 'br')),
      ],
    })
    const card = Box({
      key: 'texture-band',
      flexGrow: 1,
      position: 'relative',
      children: [
        rows('texture-space', blank, blankControls),
        Box({ position: 'absolute', top: -1, left: -1, right: 0, flexDirection: 'row', children: [body, rightMargin] }),
      ],
    })
    return withMenu(card)
  })
}
