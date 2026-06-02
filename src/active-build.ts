import { EventEmitter } from 'node:events'
import type { BuildInfo } from './wire-types.js'

// the single active build's header, held server-side so the sse snapshot can tell
// a late-joining viz what is loaded. set by the shared loadBuild op (either plane).
let current: BuildInfo | null = null

export const buildEvents = new EventEmitter()

export function getActiveBuild(): BuildInfo | null {
  return current
}

export function setActiveBuild(info: BuildInfo): void {
  current = info
  buildEvents.emit('build', info)
}
