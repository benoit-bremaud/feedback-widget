import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const dir = path.dirname(new URL(import.meta.url).pathname),
  bundle = process.argv[2],
  posts = []
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type,x-feedback-token',
  'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
}
http
  .createServer((req, res) => {
    const u = new URL(req.url, 'http://x')
    if (u.pathname === '/ingest') {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, cors)
        return res.end()
      }
      let b = ''
      req.on('data', (d) => (b += d))
      req.on('end', () => {
        try {
          posts.push(JSON.parse(b))
        } catch {
          posts.push({ raw: b })
        }
        res.writeHead(200, { ...cors, 'content-type': 'application/json' })
        res.end('{"ok":true}')
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
    if (!f.startsWith(dir) || !fs.existsSync(f) || f.endsWith('server.mjs')) {
      res.writeHead(404)
      return res.end('nf')
    }
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(fs.readFileSync(f))
  })
  .listen(4173, '127.0.0.1')
