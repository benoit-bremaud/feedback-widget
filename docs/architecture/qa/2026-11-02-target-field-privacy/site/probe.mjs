// QA probe for #136: picks each field / container in pointing mode, checks preview + POST body for SECRET.
// Usage: node probe.mjs <bundle path> <screenshot dir>
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import path from 'node:path'
const require = createRequire(
  '/home/vev/Documents/tests-responsive-ci/package.json',
)
const { chromium } = require('playwright-core')
const [bundle, SHOT] = process.argv.slice(2)
const here = path.dirname(new URL(import.meta.url).pathname)
const srv = spawn(process.execPath, [path.join(here, 'server.mjs'), bundle], {
  stdio: 'inherit',
})
await new Promise((r) => setTimeout(r, 600))
const B = await chromium.launch({
  executablePath:
    process.env.HOME +
    '/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
})
const BASE = 'http://127.0.0.1:4173/'
const out = { cases: [], console: [], hosts: new Set(), failedReq: [] }
async function newPage(q = '', w = 1280, h = 800) {
  const ctx = await B.newContext({ viewport: { width: w, height: h } })
  const p = await ctx.newPage()
  p.on('console', (m) => out.console.push(`${m.type()}: ${m.text()}`))
  p.on('pageerror', (e) => out.console.push('pageerror: ' + e.message))
  p.on('request', (r) => out.hosts.add(new URL(r.url()).host))
  p.on('requestfailed', (r) => out.failedReq.push(r.url()))
  p.on(
    'response',
    (r) => r.status() >= 400 && out.failedReq.push(r.status() + ' ' + r.url()),
  )
  await p.goto(BASE + q)
  await p.evaluate(
    () => (document.documentElement.style.scrollBehavior = 'auto'),
  )
  await p.locator('feedback-widget [data-action=open]').waitFor()
  return { p, ctx }
}
async function enterPointing(p) {
  await p.locator('feedback-widget [data-action=open]').click()
  await p.locator('feedback-widget [data-action=reject-target]').click()
  await p.locator('feedback-widget .fw-pointing-bar').waitFor()
}
async function pickAt(p, sel, mode) {
  await p.evaluate((s) => {
    document.querySelector(s).scrollIntoView({ block: 'center' })
  }, sel)
  await p.waitForTimeout(150)
  const pt = await p.evaluate(
    ([s, mode]) => {
      const el = document.querySelector(s)
      const r = el.getBoundingClientRect()
      const cands =
        mode === 'pad'
          ? [
              [r.x + 3, r.y + 3],
              [r.right - 3, r.bottom - 3],
              [r.x + 3, r.bottom - 3],
            ]
          : [
              [
                r.x + Math.min(10, r.width / 2),
                r.y + Math.min(8, r.height / 2),
              ],
              [r.x + r.width / 2, r.y + r.height / 2],
            ]
      for (const [x, y] of cands)
        if (document.elementFromPoint(x, y) === el) return { x, y, hit: true }
      const [x, y] = cands[0]
      const e = document.elementFromPoint(x, y)
      return { x, y, hit: false, got: e && (e.id || e.tagName) }
    },
    [sel, mode],
  )
  await p.mouse.click(pt.x, pt.y)
  await p.waitForTimeout(250)
  return pt
}
async function previewText(p) {
  return p.evaluate(() => {
    const sr = document.querySelector('feedback-widget').shadowRoot
    const pv =
      sr.querySelector('.fw-target-preview') || sr.querySelector('.fw-subtitle')
    return pv ? pv.textContent.replace(/\s+/g, ' ').trim() : null
  })
}
async function submit(p, tag) {
  await p.locator('feedback-widget [data-action=confirm-target]').click()
  await p.locator('feedback-widget [data-category=bug]').click()
  await p.locator('feedback-widget [data-sub-category=crash]').click()
  await p
    .locator('feedback-widget textarea')
    .fill('probe ' + tag + ' message text')
  await p.locator('feedback-widget .fw-form button[type=submit]').click()
  await p.waitForTimeout(700)
  const posts = await (await p.request.get(BASE + '__posts')).json()
  return posts.filter((x) => x.raw.includes('probe ' + tag + ' '))
}
const CASES = [
  ['#ta', 'el'],
  ['#ce', 'pad'],
  ['#ce-inner', 'el'],
  ['#ce-deep', 'el'],
  ['#ce-empty-attr', 'el'],
  ['#ce-pt', 'el'],
  ['#sel', 'el'],
  ['#rt', 'el'],
  ['#cb', 'el'],
  ['#inp', 'el'],
  ['#typed', 'el'],
  ['#f', 'pad'],
  ['#contact', 'pad'],
  ['#card-box', 'pad'],
  ['#card', 'pad'],
  ['#h-ce', 'el'],
  ['#after-ce', 'el'],
  ['#h-mixed', 'el'],
  ['#after-mixed', 'el'],
  // regression
  ['#p1', 'el'],
  ['#h-intro', 'el'],
  ['#btn1', 'el'],
  ['#link1', 'el'],
  ['#nav', 'el'],
  ['#cta', 'el'],
  ['#ce-false', 'el'],
  ['#xss', 'el'],
  ['#long-p', 'el'],
  ['#ft', 'el'],
]
const SHOTS = {
  '#ta': '01-textarea-preview',
  '#ce-inner': '02-contenteditable-inner-preview',
  '#sel': '03-select-preview',
  '#f': '04-form-container-preview',
  '#after-ce': '05-editable-heading-context',
  '#after-mixed': '06-mixed-heading-context',
  '#nav': '07-header-nav-body-root',
  '#p1': '08-paragraph-regression',
  '#xss': '09-xss-text-escaped',
}
for (const [sel, mode] of CASES) {
  const { p, ctx } = await newPage()
  await p.fill('#typed', 'TYPED-SECRET')
  await p.evaluate(() => {
    document.getElementById('ta').value = 'TYPED-TA-SECRET'
  })
  await enterPointing(p)
  const pt = await pickAt(p, sel, mode)
  const preview = await previewText(p)
  if (SHOTS[sel]) await p.screenshot({ path: `${SHOT}/${SHOTS[sel]}.png` })
  const url = p.url()
  const events = await p.evaluate(() => window.__events.slice())
  const xss = await p.evaluate(() => window.__xss ?? null)
  const tag = sel.slice(1)
  const posts = await submit(p, tag)
  const body = posts[0] ? JSON.parse(posts[0].raw) : null
  out.cases.push({
    sel,
    hit: pt.hit,
    got: pt.got,
    preview,
    previewSecret: /SECRET/.test(preview ?? ''),
    postSecret: posts.some((x) => /SECRET/.test(x.raw)),
    posts: posts.length,
    target: body && body.target,
    url,
    events,
    xss,
  })
  await ctx.close()
}
// auto-detected target: paragraph inside contenteditable in the middle band
{
  const { p, ctx } = await newPage()
  await p.evaluate(() => {
    document.getElementById('ce-inner').scrollIntoView({ block: 'center' })
  })
  await p.waitForTimeout(400)
  await p.locator('feedback-widget [data-action=open]').click()
  await p.waitForTimeout(300)
  const preview = await previewText(p)
  await p.screenshot({ path: `${SHOT}/10-auto-target-over-form.png` })
  const posts = await submit(p, 'auto-ce')
  out.cases.push({
    sel: 'AUTO@#ce-inner',
    preview,
    previewSecret: /SECRET/.test(preview ?? ''),
    postSecret: posts.some((x) => /SECRET/.test(x.raw)),
    posts: posts.length,
    target: posts[0] && JSON.parse(posts[0].raw).target,
  })
  await ctx.close()
}
// outbox: failing endpoint, form container picked; localStorage must hold no SECRET
{
  const { p, ctx } = await newPage('?ep=fail')
  await enterPointing(p)
  await pickAt(p, '#f', 'pad')
  let posts = await submit(p, 'outbox-f')
  for (let i = 0; i < 40; i++) {
    const has = await p.evaluate(() =>
      Object.values(localStorage).some((v) => v.includes('outbox-f')),
    )
    if (has) break
    await p.waitForTimeout(500)
  }
  posts = (await (await p.request.get(BASE + '__posts')).json()).filter((x) =>
    x.raw.includes('probe outbox-f '),
  )
  const ui = await p.evaluate(() =>
    document
      .querySelector('feedback-widget')
      .shadowRoot.querySelector('[role=dialog]')
      ?.textContent.replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200),
  )
  await p.screenshot({ path: `${SHOT}/11-outbox-error-state.png` })
  const ls = await p.evaluate(() =>
    Object.fromEntries(
      Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]),
    ),
  )
  const cookies = await p.evaluate(() => document.cookie)
  out.cases.push({
    sel: 'OUTBOX@#f',
    posts: posts.length,
    postSecret: posts.some((x) => /SECRET/.test(x.raw)),
    lsKeys: Object.keys(ls),
    lsSecret: Object.values(ls).some((v) => /SECRET/.test(v)),
    lsHasTarget: Object.values(ls).some((v) => v.includes('"target"')),
    cookies,
    ui,
  })
  await ctx.close()
}
// phone width: form container preview
{
  const { p, ctx } = await newPage('', 390, 844)
  await enterPointing(p)
  await pickAt(p, '#f', 'pad')
  const preview = await previewText(p)
  await p.screenshot({ path: `${SHOT}/12-form-preview-390.png` })
  const sw = await p.evaluate(() => document.documentElement.scrollWidth)
  out.cases.push({
    sel: 'M390@#f',
    preview,
    previewSecret: /SECRET/.test(preview ?? ''),
    scrollWidth: sw,
  })
  await ctx.close()
}
out.hosts = [...out.hosts]
console.log(JSON.stringify(out, null, 1))
await B.close()
srv.kill()
