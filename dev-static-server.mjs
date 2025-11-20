import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const outDir = path.join(__dirname, 'out')
const port = process.env.PORT || 3000

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
}

const server = http.createServer((req, res) => {
  try {
    const url = req.url || '/'
    const [pathnameRaw] = url.split('?')
    const originalPath = decodeURIComponent(pathnameRaw || '/')

    const candidates = []

    if (originalPath === '/') {
      candidates.push('/index.html')
    } else {
      if (originalPath.endsWith('/')) {
        candidates.push(path.join(originalPath, 'index.html'))
      }
      // As-is (e.g. /_next/static/...)
      candidates.push(originalPath)
      // .html variant for route paths like /scan -> /scan.html
      candidates.push(`${originalPath}.html`)
      // index.html inside directory for paths like /scan -> /scan/index.html
      candidates.push(path.join(originalPath, 'index.html'))
    }

    const tryNext = (index) => {
      if (index >= candidates.length) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end('Not found')
        return
      }

      const candidatePath = candidates[index]
      const filePath = path.join(outDir, candidatePath)

      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          tryNext(index + 1)
          return
        }

        const ext = path.extname(filePath).toLowerCase()
        const mimeType = mimeTypes[ext] || 'application/octet-stream'

        res.statusCode = 200
        res.setHeader('Content-Type', mimeType)

        const stream = fs.createReadStream(filePath)
        stream.on('error', () => {
          res.statusCode = 500
          res.end('Internal server error')
        })
        stream.pipe(res)
      })
    }

    tryNext(0)
  } catch (error) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Internal server error')
  }
})

server.listen(port, () => {
  console.log(`[ryn-static] Serving ${outDir} at http://localhost:${port}`)
})
