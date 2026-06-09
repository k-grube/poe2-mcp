import { z } from 'zod'
import { defineTool, bridgeCmd } from './define-tool.js'

const Input = z.object({ stat: z.string().min(1) })

export const { definition, handler } = defineTool(
  {
    name: 'explain_stat',
    description:
      'Break a player-level stat into the mod sources building it. Returns { total, base[], increased[], more[], flags[] }; each entry is { value, source, name } where source is PoB\'s tag (e.g. "Item:1:Helmet", "Tree:50459:Heart of the Warrior", "Class:Witch", "Config"). Useful for "where does my +1000 Life come from" questions. Works for raw modDB stats (Life, Mana, ES, Str/Dex/Int, FireResist, ColdResist, LightningResist, ChaosResist, Armour, Evasion, Spirit, ...). Does NOT work for derived calc-pipeline stats (FullDPS, TotalDPS, TotalEHP) — those need sensitivity analysis, not modDB tabulation. Call load_build first.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        stat: {
          type: 'string',
          description: 'modDB key, e.g. "Life", "FireResist", "Strength"',
        },
      },
      required: ['stat'],
    },
  },
  bridgeCmd('explain_stat', Input),
)
