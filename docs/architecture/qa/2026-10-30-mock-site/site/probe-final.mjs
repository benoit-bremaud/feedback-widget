import { createRequire } from 'node:module'
const require = createRequire(
  '/home/vev/Documents/tests-responsive-ci/package.json',
)
const { chromium } = require('playwright-core')
const SHOT =
  '/home/vev/Documents/02_personal/feedback-widget/.claude/worktrees/audit-defauts-categories-123e70/docs/architecture/qa/2026-10-30-mock-site'
const B = await chromium.launch({
  executablePath:
    process.env.HOME +
    '/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
})
const out = []
async function open(w, h, root, y, mobile) {
  const ctx = await B.newContext({
    viewport: { width: w, height: h },
    isMobile: !!mobile,
  })
  const p = await ctx.newPage()
  const errs = []
  p.on(
    'console',
    (m) => ['error', 'warning'].includes(m.type()) && errs.push(m.text()),
  )
  p.on('pageerror', (e) => errs.push(e.message))
  await p.goto('http://127.0.0.1:4173/?root=' + root)
  await p.evaluate((y) => {
    document.documentElement.style.scrollBehavior = 'auto'
    scrollTo(0, y)
  }, y)
  await p.waitForTimeout(300)
  await p.locator('feedback-widget [data-action=open]').click()
  await p.locator('feedback-widget [data-action=reject-target]').click()
  await p.locator('feedback-widget .fw-pointing-bar').waitFor()
  return { p, ctx, errs }
}
async function pick(p, sel, dx = 10, dy = 10) {
  const r = await p.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect()
    return { x: r.x, y: r.y }
  }, sel)
  await p.mouse.click(r.x + dx, r.y + dy)
  await p.waitForTimeout(300)
}
// 1 default root desktop y=2200: hover header (no highlight), click logo -> navigates
{
  const { p, ctx } = await open(1440, 900, 'default', 2200)
  const r = await p.evaluate(() => {
    const r = document.getElementById('nav-products').getBoundingClientRect()
    return { x: r.x + 5, y: r.y + 5 }
  })
  await p.mouse.move(r.x, r.y)
  await p.waitForTimeout(300)
  out.push({
    case: 'default y2200 hover nav',
    bg: await p.evaluate(
      () =>
        getComputedStyle(document.getElementById('nav-products'))
          .backgroundColor,
    ),
    pointingOn: await p.evaluate(
      () => document.querySelector('.fw-pointing')?.tagName,
    ),
  })
  await p.screenshot({ path: SHOT + '/final-d-default-y2200-header-hover.png' })
  await p.mouse.click(r.x, r.y)
  await p.waitForTimeout(500)
  out.push({ case: 'default click nav', url: p.url() })
  await p.screenshot({ path: SHOT + '/final-d-default-navigated.png' })
  await ctx.close()
}
// 2 default root: cta click fires page action
{
  const { p, ctx } = await open(1440, 900, 'default', 0)
  await pick(p, '#cta', 20, 10)
  out.push({
    case: 'default click cta',
    events: await p.evaluate(() => window.__events),
    still: await p.locator('feedback-widget .fw-pointing-bar').count(),
  })
  await p.screenshot({ path: SHOT + '/final-d-default-cta-action.png' })
  await ctx.close()
}
// 3 body root y2200: header pickable, highlighted, picked preview
{
  const { p, ctx } = await open(1440, 900, 'body', 2200)
  const r = await p.evaluate(() => {
    const r = document.getElementById('cta').getBoundingClientRect()
    return { x: r.x + 10, y: r.y + 10 }
  })
  await p.mouse.move(r.x, r.y)
  await p.waitForTimeout(300)
  await p.screenshot({ path: SHOT + '/final-d-body-y2200-header-hover.png' })
  await p.mouse.click(r.x, r.y)
  await p.waitForTimeout(300)
  out.push({
    case: 'body y2200 cta',
    events: await p.evaluate(() => window.__events),
    preview: await p.locator('feedback-widget .fw-target-preview').innerText(),
  })
  await p.screenshot({ path: SHOT + '/final-d-body-y2200-cta-picked.png' })
  await ctx.close()
}
// 4 keyboard Enter on focused link in pointing mode, body root
{
  const { p, ctx } = await open(1440, 900, 'body', 0)
  await p.evaluate(() => document.getElementById('nav-products').focus())
  const u = p.url()
  await p.keyboard.press('Enter')
  await p.waitForTimeout(500)
  out.push({
    case: 'keyboard Enter on nav link (body root)',
    navigated: p.url() !== u,
    picked: await p
      .locator('feedback-widget [data-action=confirm-target]')
      .count(),
  })
  await ctx.close()
}
// 4b keyboard Enter default root focused header link
{
  const { p, ctx } = await open(1440, 900, 'default', 0)
  await p.evaluate(() => document.getElementById('nav-products').focus())
  const u = p.url()
  await p.keyboard.press('Enter')
  await p.waitForTimeout(500)
  out.push({
    case: 'keyboard Enter on nav link (default root)',
    navigated: p.url() !== u,
  })
  await ctx.close()
}
// 5 mobile default: pointing bar vs content; header
{
  const { p, ctx } = await open(375, 812, 'default', 1200, true)
  const bar = await p.evaluate(() => {
    const b = document
      .querySelector('feedback-widget')
      .shadowRoot.querySelector('.fw-pointing-bar')
      .getBoundingClientRect()
    return {
      top: Math.round(b.top),
      h: Math.round(b.height),
      w: Math.round(b.width),
    }
  })
  out.push({ case: 'mobile pointing bar', bar, vh: 812 })
  await p.screenshot({ path: SHOT + '/final-m-default-pointing-bar.png' })
  await ctx.close()
}
// 6 mobile body: burger open, dropdown, pick dd item
{
  const { p, ctx } = await open(375, 812, 'body', 900, true)
  await p.evaluate(() => {
    document.getElementById('main-nav').classList.add('show')
    document.getElementById('dd').classList.add('open')
  })
  await p.waitForTimeout(200)
  await pick(p, '#dd-docs', 10, 10)
  out.push({
    case: 'mobile body dd item',
    preview: await p
      .locator('feedback-widget .fw-target-preview')
      .innerText()
      .catch(() => '-'),
  })
  await p.screenshot({ path: SHOT + '/final-m-body-dd-item-picked.png' })
  await ctx.close()
}
// 7 wrapped heading: auto + pick
{
  const { p, ctx } = await open(1440, 900, 'default', 0)
  await pick(p, '#news-p', 10, 5)
  out.push({
    case: 'wrapped heading p#news-p',
    preview: await p
      .locator('feedback-widget .fw-target-preview')
      .innerText()
      .catch(() => '-'),
  })
  await ctx.close()
}
// 8 sanity leak: pre-filled textarea + contenteditable
for (const sel of ['#f-notes', '#f-rich']) {
  const { p, ctx } = await open(1440, 900, 'body', 0)
  await p.evaluate(() => {
    document.getElementById('f-rich').textContent = 'SECRET-RICH-TYPED-TEXT'
  })
  await p.evaluate(
    (s) => document.querySelector(s).scrollIntoView({ block: 'start' }),
    sel,
  )
  await p.evaluate(() => scrollBy(0, -300))
  await pick(p, sel, 10, 10)
  await p.locator('feedback-widget [data-action=confirm-target]').click()
  await p.locator('feedback-widget [data-category=bug]').click()
  await p.locator('feedback-widget [data-sub-category=crash]').click()
  await p.locator('feedback-widget textarea').fill('leak probe ' + sel + ' ok')
  await p.locator('feedback-widget .fw-btn-primary').last().click()
  await p.waitForTimeout(800)
  const posts = await (
    await p.request.get('http://127.0.0.1:4173/__posts')
  ).json()
  const last = posts.filter(
    (x) => x.message && x.message.includes('leak probe ' + sel),
  )[0]
  out.push({ case: 'leak ' + sel, target: last && last.target })
  await ctx.close()
}
console.log(JSON.stringify(out, null, 1))
await B.close()
