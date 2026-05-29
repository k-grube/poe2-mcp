import { EventEmitter } from 'node:events'
import type { StartEvent, GenEvent, EndEvent } from './wire-types.js'

export type { StartEvent, GenEvent, EndEvent }

interface SearchEventMap {
  start: [StartEvent]
  gen: [GenEvent]
  end: [EndEvent]
}

// single process-wide bus; SSE routes subscribe, stepLoop publishes
export const searchEvents = new EventEmitter<SearchEventMap>()
