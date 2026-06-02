import { searchInputProperties } from './search-schema.js'
import { searchStart } from '../ops/search.js'
import { defineTool } from './define-tool.js'

export const { definition, handler } = defineTool(
  {
    name: 'search_start',
    description:
      'Start an async memetic-GA tree search and return a job_id immediately. The search runs server-side in the background and survives client disconnect. Poll search_status({job_id}) for progress (~every 5s), then search_result({job_id}) for the champion build. Only one search runs at a time. ' +
      'objective: { stat: "FullDPS" } or { weights: { FullDPS: 1.0, TotalEHP: 0.3 } }. ' +
      'start_mode "fresh" resets the tree first (loses ascendancy nodes). ' +
      'Call load_build first.',
    inputSchema: { type: 'object' as const, properties: searchInputProperties, required: ['objective'] },
  },
  searchStart,
)
