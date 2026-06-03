import { EventEmitter } from 'node:events'
import type { GemStartEvent, GemProgressEvent, GemEndEvent } from './wire-types.js'

export type { GemStartEvent, GemProgressEvent, GemEndEvent }

interface GemEventMap {
  'gem:start': [GemStartEvent]
  'gem:progress': [GemProgressEvent]
  'gem:end': [GemEndEvent]
}

// single process-wide bus; the SSE route subscribes, gemStepLoop publishes
export const gemEvents = new EventEmitter<GemEventMap>()
