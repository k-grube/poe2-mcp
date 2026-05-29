-- exercises the generic GA engine (ga.seed / ga.evolve_one / ga.tournament_pick)
-- with a toy number-genome fitness -- no PoB, no subprocess. this is what makes
-- the engine's `ops` seam real (a second adapter besides ga.pob_ops).
-- run: luajit scripts/ga-toy-test.lua   (from the repo root)

package.path = "lua/?.lua;" .. package.path
local ga = require("search").ga

math.randomseed(1)

-- genome = a number x; fitness peaks at x = 42
local function member(x) return { x = x, score = -((x - 42) ^ 2) } end
local function clamp(x) return math.max(-200, math.min(200, x)) end

local ops = {
  hc_evals = 2,
  initial = function() return member(0) end,
  random = function() return member(math.random(-200, 200)) end,
  clone = function(p) return member(p.x) end,
  crossover = function(a, b) return member(clamp(math.floor((a.x + b.x) / 2))) end,
  mutate = function(m) return member(clamp(m.x + math.random(-5, 5))) end,
  hill_climb = function(m)
    local best = m
    for _, dx in ipairs({ -1, 1 }) do
      local c = member(clamp(m.x + dx))
      if c.score > best.score then best = c end
    end
    return best
  end,
}

local state = ga.seed(
  { pop_size = 10, generations = 60, elitism = 2, crossover_rate = 0.7, tournament_size = 3 },
  ops
)
for _ = 1, state.generations do ga.evolve_one(state) end

local champ = state.champion
io.stderr:flush()
print(string.format("champion x=%d score=%.2f (target x=42)", champ.x, champ.score))
assert(#state.trajectory == state.generations, "one trajectory entry per generation")
assert(state.trajectory[#state.trajectory].champion_score == champ.score, "trajectory tracks champion")
assert(champ.score > -25, "GA should converge within ~5 of x=42, got x=" .. champ.x)
print("GA TOY TEST OK")
