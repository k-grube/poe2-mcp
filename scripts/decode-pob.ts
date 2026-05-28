// scripts/decode-pob.ts — decode a PoB share code in Node and dump the XML
// usage: tsx scripts/decode-pob.ts tests/test-build
import { readFileSync, writeFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('usage: tsx scripts/decode-pob.ts <path>')
  process.exit(1)
}

const code = readFileSync(inputPath, 'utf8').trim()
console.log(`raw len: ${code.length}`)
console.log(`first 80: ${code.slice(0, 80)}`)
console.log(`last  80: ${code.slice(-80)}`)

// pob share code: url-safe base64 (- and _ instead of + and /)
const standardB64 = code.replace(/-/g, '+').replace(/_/g, '/')
console.log(`first 80 (b64-fixed): ${standardB64.slice(0, 80)}`)

const compressed = Buffer.from(standardB64, 'base64')
console.log(`compressed bytes: ${compressed.length}`)
console.log(`first 8 bytes hex: ${compressed.slice(0, 8).toString('hex')}`)

let xml: string
try {
  xml = inflateSync(compressed).toString('utf8')
} catch (e) {
  console.error('zlib inflate failed:', e instanceof Error ? e.message : e)
  process.exit(1)
}

console.log(`xml bytes: ${xml.length}`)
console.log(`xml first 400 chars:\n${xml.slice(0, 400)}`)
console.log(`---`)
console.log(`xml last  200 chars:\n${xml.slice(-200)}`)

writeFileSync(inputPath + '.xml', xml)
console.log(`wrote ${inputPath}.xml`)
