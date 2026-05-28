import { z } from 'zod'
import type { LuaBridge } from '../lua-bridge.js'
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js'

export const definition: Tool = {
  name: 'search_tree_neighborhood',
  description:
    'Memetic genetic algorithm over the passive tree. Maintains a population of candidate builds, evolves them via tournament selection + crossover (union of node sets + random merge + connectivity repair) + mutation (random leaf swap) + hill-climbing local search. Returns the champion build with full per-generation trajectory. ' +
    'objective: { stat: "FullDPS" } or { weights: { FullDPS: 1.0, TotalEHP: 0.3 } }. ' +
    'constraints: { min?, max? } — violations make a state infeasible (score = -inf). ' +
    'start_mode "fresh" resets the tree first (loses ascendancy nodes). ' +
    'Total evaluations roughly = population_size + generations * (population_size - elitism) * (2 + hill_climb_depth). ' +
    'Call load_build first.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      objective: {
        oneOf: [
          { type: 'object', properties: { stat: { type: 'string' } }, required: ['stat'] },
          {
            type: 'object',
            properties: { weights: { type: 'object', additionalProperties: { type: 'number' } } },
            required: ['weights'],
          },
        ],
      },
      constraints: {
        type: 'object',
        properties: {
          min: { type: 'object', additionalProperties: { type: 'number' } },
          max: { type: 'object', additionalProperties: { type: 'number' } },
        },
      },
      point_budget: { type: 'number', description: 'PoB-counted alloc cap; default = current allocated count' },
      start_mode: { type: 'string', enum: ['current', 'fresh'] },
      population_size: { type: 'number', description: 'population size; default 8' },
      generations: { type: 'number', description: 'number of GA generations; default 10' },
      hill_climb_depth: {
        type: 'number',
        description: 'random leaf-swap attempts per child for local search; default 3',
      },
      elitism: { type: 'number', description: 'top N preserved per gen; default 2' },
      crossover_rate: { type: 'number', description: 'probability of crossover vs clone+mutate; default 0.7' },
      tournament_size: { type: 'number', description: 'K candidates per tournament selection; default 3' },
      seed: { type: 'number', description: 'rng seed for reproducibility' },
    },
    required: ['objective'],
  },
}

const ObjectiveSchema = z.union([
  z.object({ stat: z.string().min(1) }),
  z.object({ weights: z.record(z.string(), z.number()) }),
])

const InputSchema = z.object({
  objective: ObjectiveSchema,
  constraints: z
    .object({
      min: z.record(z.string(), z.number()).optional(),
      max: z.record(z.string(), z.number()).optional(),
    })
    .optional(),
  point_budget: z.number().int().positive().optional(),
  start_mode: z.enum(['current', 'fresh']).optional(),
  population_size: z.number().int().min(2).optional(),
  generations: z.number().int().positive().optional(),
  hill_climb_depth: z.number().int().nonnegative().optional(),
  elitism: z.number().int().nonnegative().optional(),
  crossover_rate: z.number().min(0).max(1).optional(),
  tournament_size: z.number().int().min(1).optional(),
  seed: z.number().optional(),
})

export async function handler(bridge: LuaBridge, args: unknown): Promise<CallToolResult> {
  try {
    const parsed = InputSchema.parse(args)
    // GA can take 10+ minutes for non-trivial pop/gen. 30 min ceiling.
    const resp = await bridge.send({ cmd: 'search_tree_neighborhood', args: parsed, timeoutMs: 1_800_000 })
    return { content: [{ type: 'text', text: JSON.stringify(resp.data, null, 2) }] }
  } catch (err) {
    return {
      content: [{ type: 'text', text: String(err instanceof Error ? err.message : err) }],
      isError: true,
    }
  }
}
