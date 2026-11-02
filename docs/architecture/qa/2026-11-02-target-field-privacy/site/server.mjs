// QA mock server for #136: serves the mock page, the local bundle and a stub /ingest (127.0.0.1 only).
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const dir = path.dirname(new URL(import.meta.url).pathname)
const bundle = process.argv[2]
const posts = []
const cors = {
  'Access-Control-Allow-Origin': 'http://127.0.0.1:4173',
  'Access-Control-Allow-Headers': 'content-type,x-feedback-token',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
}
http
  .createServer((req, res) => {
    const u = new URL(req.url, 'http://x')
    if (u.pathname === '/ingest' || u.pathname === '/ingest-fail') {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, cors)
        return res.end()
      }
      let b = ''
      req.on('data', (d) => (b += d))
      req.on('end', () => {
        posts.push({ path: u.pathname, raw: b })
        const fail = u.pathname === '/ingest-fail'
        res.writeHead(fail ? 500 : 200, {
          ...cors,
          'content-type': 'application/json',
        })
        res.end(fail ? '{"error":"stub failure"}' : '{"ok":true}')
      })
      return
    }
    if (u.pathname === '/__posts') {
      res.writeHead(200)
      return res.end(JSON.stringify(posts))
    }
    if (u.pathname === '/feedback-widget.js') {
      res.writeHead(200, { 'content-type': 'text/javascript' })
      return res.end(fs.readFileSync(bundle))
    }
    const f = path.join(
      dir,
      u.pathname === '/' ? 'index.html' : u.pathname.slice(1),
    )
    if (!f.startsWith(dir) || !f.endsWith('.html') || !fs.existsSync(f)) {
      res.writeHead(404)
      return res.end('nf')
    }
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(fs.readFileSync(f))
  })
  .listen(4173, '127.0.0.1')
