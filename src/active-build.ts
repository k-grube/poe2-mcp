import { EventEmitter } from 'node:events'
import type { BuildInfo } from './wire-types.js'

// the single active build's header, held server-side so the sse snapshot can tell
// a late-joining viz what is loaded. set by the shared loadBuild op (either plane).
let current: BuildInfo | null = null

// the build's xml captured when a search starts; what Revert restores. cleared when
// the active build is replaced (new load or a revert), per CONTEXT.md's Baseline.
let baseline: string | null = null

export const buildEvents = new EventEmitter()

export function getActiveBuild(): BuildInfo | null {
  return current
}

export function setActiveBuild(info: BuildInfo): void {
  current = info
  baseline = null
  buildEvents.emit('build', info)
}

export function setBaseline(xml: string): void {
  baseline = xml
}

export function getBaseline(): string | null {
  return baseline
}
