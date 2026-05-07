#!/usr/bin/env node
/**
 * Maintainer tool: recompute SHA-256 for every URL in native-artifacts.manifest.json
 * and rewrite the file. Run after upstream version bumps or when integrity checks fail.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { sha256Url } from './lib/verified-download.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const manifestPath = path.join(__dirname, 'native-artifacts.manifest.json')

async function main() {
  const raw = fs.readFileSync(manifestPath, 'utf8')
  const manifest = JSON.parse(raw)
  const entries = Object.entries(manifest.artifacts ?? {})

  console.log(`Refreshing ${entries.length} artifact hashes...`)

  const updated = JSON.parse(JSON.stringify(manifest))

  for (const [key, meta] of Object.entries(updated.artifacts ?? {})) {
    const url = meta?.url
    if (!url) {
      console.warn(`Skipping ${key}: no url`)
      continue
    }
    process.stdout.write(`  ${key} ... `)
    try {
      const digest = await sha256Url(url, { label: key })
      meta.sha256 = digest
      console.log(digest)
    } catch (e) {
      console.log(`FAILED: ${e.message}`)
      console.error('Aborting without writing manifest (fix network or URL, then retry).')
      process.exit(1)
    }
  }

  fs.writeFileSync(manifestPath, JSON.stringify(updated, null, 2) + '\n', 'utf8')
  console.log(`Wrote ${manifestPath}`)
}

main()
