import { z } from 'zod'

// JSON Schema properties for the search tool definitions
export const searchInputProperties: Record<string, object> = {
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
}

const ObjectiveSchema = z.union([
  z.object({ stat: z.string().min(1) }),
  z.object({ weights: z.record(z.string(), z.number()) }),
])

export const SearchInputSchema = z.object({
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

export type SearchInput = z.infer<typeof SearchInputSchema>
