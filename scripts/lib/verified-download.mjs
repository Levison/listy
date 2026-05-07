/**
 * Verified HTTPS downloads: stream to disk while computing SHA-256 and fail on mismatch.
 * Used for native artifacts and other externally fetched binaries.
 */

import { createHash } from 'crypto'
import { createWriteStream, unlinkSync, existsSync } from 'fs'
import { PassThrough } from 'stream'
import http from 'http'
import https from 'https'
import { URL } from 'url'

const DEFAULT_UA = 'listy-native-artifacts/1.0 (+https://github.com/pmbstyle/alice)'

function requestModuleForUrl(url) {
  const u = new URL(url)
  return u.protocol === 'http:' ? http : https
}

/**
 * @param {string} url
 * @param {string} destPath
 * @param {string} expectedSha256Hex Lowercase hex SHA-256 of exact response body (after redirects).
 * @param {{ label?: string, maxRedirects?: number }} [options]
 * @returns {Promise<void>}
 */
export function downloadVerified(url, destPath, expectedSha256Hex, options = {}) {
  const label = options.label ?? url
  const maxRedirects = options.maxRedirects ?? 20

  return new Promise((resolve, reject) => {
    const follow = (currentUrl, redirectsLeft) => {
      if (redirectsLeft < 0) {
        reject(new Error(`Too many redirects while downloading ${label}`))
        return
      }

      const mod = requestModuleForUrl(currentUrl)
      const req = mod.get(
        currentUrl,
        {
          headers: { 'User-Agent': DEFAULT_UA },
        },
        res => {
          if (
            res.statusCode === 301 ||
            res.statusCode === 302 ||
            res.statusCode === 303 ||
            res.statusCode === 307 ||
            res.statusCode === 308
          ) {
            const loc = res.headers.location
            res.resume()
            if (!loc) {
              reject(new Error(`Redirect without Location for ${label}`))
              return
            }
            const next = new URL(loc, currentUrl).toString()
            follow(next, redirectsLeft - 1)
            return
          }

          if (res.statusCode !== 200) {
            res.resume()
            reject(
              new Error(
                `Download failed for ${label}: HTTP ${res.statusCode} ${res.statusMessage ?? ''}`.trim()
              )
            )
            return
          }

          const hash = createHash('sha256')
          const pass = new PassThrough()
          const file = createWriteStream(destPath)

          pass.on('data', chunk => hash.update(chunk))
          pass.pipe(file)

          const cleanup = err => {
            file.close(() => {
              try {
                if (existsSync(destPath)) unlinkSync(destPath)
              } catch {
                /* ignore */
              }
              reject(err)
            })
          }

          res.on('error', cleanup)
          file.on('error', cleanup)

          file.on('finish', () => {
            const actual = hash.digest('hex')
            if (actual !== expectedSha256Hex.toLowerCase()) {
              try {
                if (existsSync(destPath)) unlinkSync(destPath)
              } catch {
                /* ignore */
              }
              reject(
                new Error(
                  `Integrity check failed for ${label}: expected sha256 ${expectedSha256Hex}, got ${actual}. ` +
                    `Upstream may have changed; update scripts/native-artifacts.manifest.json (run npm run artifacts:refresh-hashes).`
                )
              )
              return
            }
            resolve()
          })

          res.pipe(pass)
        }
      )

      req.on('error', reject)
    }

    follow(url, maxRedirects)
  })
}

/**
 * Compute SHA-256 of the full response body (after redirects) without persisting to disk.
 * For maintainer scripts that refresh native-artifacts.manifest.json.
 *
 * @param {string} url
 * @param {{ label?: string, maxRedirects?: number }} [options]
 * @returns {Promise<string>} Lowercase hex digest
 */
export function sha256Url(url, options = {}) {
  const label = options.label ?? url
  const maxRedirects = options.maxRedirects ?? 20

  return new Promise((resolve, reject) => {
    const follow = (currentUrl, redirectsLeft) => {
      if (redirectsLeft < 0) {
        reject(new Error(`Too many redirects while hashing ${label}`))
        return
      }

      const mod = requestModuleForUrl(currentUrl)
      const req = mod.get(
        currentUrl,
        { headers: { 'User-Agent': DEFAULT_UA } },
        res => {
          if (
            res.statusCode === 301 ||
            res.statusCode === 302 ||
            res.statusCode === 303 ||
            res.statusCode === 307 ||
            res.statusCode === 308
          ) {
            const loc = res.headers.location
            res.resume()
            if (!loc) {
              reject(new Error(`Redirect without Location for ${label}`))
              return
            }
            follow(new URL(loc, currentUrl).toString(), redirectsLeft - 1)
            return
          }

          if (res.statusCode !== 200) {
            res.resume()
            reject(
              new Error(
                `Hash fetch failed for ${label}: HTTP ${res.statusCode} ${res.statusMessage ?? ''}`.trim()
              )
            )
            return
          }

          const hash = createHash('sha256')
          res.on('data', chunk => hash.update(chunk))
          res.on('end', () => resolve(hash.digest('hex')))
          res.on('error', reject)
        }
      )
      req.on('error', reject)
    }

    follow(url, maxRedirects)
  })
}
