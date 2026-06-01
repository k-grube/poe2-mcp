-- GA + search engine for the passive tree. required by pob-shim.lua.
-- reads globals set at boot: build, loadBuildFromXML, get_output.

-- =========================================================================
-- search_tree_neighborhood: in-process simulated annealing over tree allocs
-- =========================================================================

local search = {}

function search.compute_score(objective)
  local out = get_output()
  if objective.stat then
    return out[objective.stat] or 0
  elseif objective.weights then
    local total = 0
    for stat, weight in pairs(objective.weights) do
      total = total + weight * (out[stat] or 0)
    end
    return total
  end
  return 0
end

function search.check_constraints(constraints)
  if not constraints then return {} end
  local out = get_output()
  local violations = {}
  if constraints.min then
    for stat, thr in pairs(constraints.min) do
      local v = out[stat] or 0
      if v < thr then violations[#violations+1] = stat .. ":" .. v .. "<" .. thr end
    end
  end
  if constraints.max then
    for stat, thr in pairs(constraints.max) do
      local v = out[stat] or 0
      if v > thr then violations[#violations+1] = stat .. ":" .. v .. ">" .. thr end
    end
  end
  return violations
end

function search.pob_count()
  if build.spec.CountAllocNodes then return (build.spec:CountAllocNodes()) end
  return 0
end

-- weapon-set points (allocMode 1/2) are separate pools that convert regular points.
-- captured from the loaded build at search start; the GA optimizes placement within
-- each pool and never exceeds the character's ws points or shifts them across pools.
search.ws_budget = { [1] = 0, [2] = 0 }

function search.ws_used(mode)
  if not (build.spec and build.spec.CountAllocNodes) then return 0 end
  local _u, _a, _s, _so, ws1, ws2 = build.spec:CountAllocNodes()
  if mode == 1 then return ws1 end
  if mode == 2 then return ws2 end
  return 0
end

-- alloc node in the given pool (0 normal, 1/2 weapon set), respecting the total
-- budget and, for weapon sets, the pool cap. returns true if it allocated.
function search.alloc_in_mode(node, mode, budget)
  if not node or node.alloc then return false end
  if search.pob_count() >= budget then return false end
  if mode and mode > 0 and search.ws_used(mode) >= (search.ws_budget[mode] or 0) then
    return false
  end
  local prev = build.spec.allocMode
  build.spec.allocMode = mode or 0
  pcall(function() build.spec:AllocNode(node) end)
  build.spec.allocMode = prev
  return node.alloc == true
end

function search.rebuild()
  build.buildFlag = true
  pcall(function() build.calcsTab:BuildOutput() end)
end

-- PoB's snapshot mechanism: SaveDB returns the full build XML; loadBuildFromXML
-- re-loads it. note: SaveSpec doesn't exist on `build` (it's a TS-side typo
-- inherited from compare_gem_swap which silently fell into its error path).
function search.snapshot()
  if build.SaveDB then
    local ok, xml = pcall(function() return build:SaveDB("code") end)
    if ok and xml then return xml end
  end
  return nil
end

function search.restore(xml)
  if not xml then return false end
  local ok = pcall(loadBuildFromXML, xml)
  if ok then
    search.rebuild()
    return true
  end
  return false
end

function search.gather_stats(keys)
  local out = get_output()
  local r = {}
  for _, k in ipairs(keys) do r[k] = out[k] or 0 end
  return r
end

-- top N unallocated nodes ranked by power_per_point
function search.top_unallocated(stat, max_hops, n)
  local ct = build.calcsTab
  ct.powerStat         = {stat = stat}
  ct.nodePowerMaxDepth = max_hops
  ct.powerBuildFlag    = true
  local guard = 0
  repeat
    ct:BuildPower()
    guard = guard + 1
    if guard > 500 then break end
  until ct.powerBuilder == nil

  local cands = {}
  for id, node in pairs(build.spec.nodes) do
    if not node.alloc and node.power and node.power.pathPower and node.power.pathPower ~= 0
       and (not max_hops or (node.pathDist and node.pathDist <= max_hops)) then
      local d = node.pathDist or 1
      cands[#cands+1] = {
        id = id, name = node.name, path_power = node.power.pathPower,
        path_dist = d, power_per_point = d > 0 and (node.power.pathPower / d) or node.power.pathPower,
      }
    end
  end
  table.sort(cands, function(a, b) return a.power_per_point > b.power_per_point end)
  local top = {}
  for i = 1, math.min(n or 10, #cands) do top[i] = cands[i] end
  return top
end

-- allocated nodes that are true leaves (depends contains only self).
-- excludes class start, ascend start, ascendancy (pinned). weapon-set nodes are
-- included; the ops capture each node's allocMode and realloc the freed point in the
-- same pool, so weapon-set placements get optimized without crossing pools.
function search.true_leaves()
  local r = {}
  if not (build.spec and build.spec.allocNodes) then return r end
  for id, node in pairs(build.spec.allocNodes) do
    if node.type ~= "ClassStart" and node.type ~= "AscendClassStart"
       and not node.ascendancyName and node.depends and #node.depends == 1 then
      r[#r+1] = id
    end
  end
  return r
end

function search.allocated_notables()
  local r = {}
  if not (build.spec and build.spec.allocNodes) then return r end
  for id, node in pairs(build.spec.allocNodes) do
    if node.isNotable and not node.ascendancyName then r[#r+1] = id end
  end
  return r
end

-- greedy: allocate the single best by power_per_point. returns added id or nil.
function search.greedy_alloc(objective, max_hops)
  local stat = objective.stat or "FullDPS" -- weighted: use FullDPS for analyze sort
  local top = search.top_unallocated(stat, max_hops, 1)
  if #top == 0 then return nil end
  local target = build.spec.nodes[top[1].id]
  pcall(function() build.spec:AllocNode(target) end)
  build.spec:BuildAllDependsAndPaths()
  search.rebuild()
  return top[1].id
end

-- candidates within max_hops of the allocated set; excludes class/ascend
-- starts. used by leaf_swap for cheap random adjacent picks (no PowerBuilder).
function search.adjacent_unallocated(max_hops)
  local r = {}
  local cap = max_hops or 2
  for id, node in pairs(build.spec.nodes) do
    if not node.alloc and node.pathDist and node.pathDist <= cap
       and node.type ~= "ClassStart" and node.type ~= "AscendClassStart"
       and not node.ascendancyName then
      r[#r+1] = id
    end
  end
  return r
end

-- op: dealloc random true leaf, alloc random adjacent unallocated.
-- skips PowerBuilder entirely; SA acceptance does the value filtering.
function search.op_leaf_swap(_objective)
  local leaves = search.true_leaves()
  if #leaves == 0 then return nil, "no leaves" end
  local pick = leaves[math.random(#leaves)]
  local node = build.spec.allocNodes[pick]
  if not node then return nil, "leaf gone" end
  local mode = node.allocMode or 0 -- realloc the freed point in the same pool
  local budget = search.pob_count()
  pcall(function() build.spec:DeallocNode(node) end)
  local candidates = search.adjacent_unallocated(2)
  local added
  if #candidates > 0 then
    local target_id = candidates[math.random(#candidates)]
    local t = build.spec.nodes[target_id]
    if search.alloc_in_mode(t, mode, budget) then
      build.spec:BuildAllDependsAndPaths()
      added = target_id
    end
  end
  search.rebuild()
  return { op = "leaf_swap", removed = pick, added = added }
end

-- op: dealloc random notable, greedy refill to budget
function search.op_notable_swap(objective, budget)
  local notables = search.allocated_notables()
  if #notables == 0 then return nil, "no notables" end
  local pick = notables[math.random(#notables)]
  local node = build.spec.allocNodes[pick]
  if not node then return nil, "notable gone" end
  local mode = node.allocMode or 0 -- refill the freed points in the same pool
  local before = search.pob_count()
  pcall(function() build.spec:DeallocNode(node) end)
  local after_dealloc = search.pob_count()
  io.stderr:write(string.format("[search.op_notable_swap] dealloc=%s chain=%d budget=%d\n",
    node.name or "?", before - after_dealloc, budget))
  io.stderr:flush()
  -- ONE PowerBuilder pass; iterate the pre-ranked list. avoids per-step recompute
  -- which is the slow path for FullDPS objectives.
  local stat = objective.stat or "FullDPS"
  local candidates = search.top_unallocated(stat, 4, 20)
  io.stderr:write(string.format("[search.op_notable_swap] %d candidates\n", #candidates))
  io.stderr:flush()
  local added = {}
  for _, cand in ipairs(candidates) do
    if search.pob_count() >= budget then break end
    if search.alloc_in_mode(build.spec.nodes[cand.id], mode, budget) then
      added[#added+1] = cand.id
    end
  end
  build.spec:BuildAllDependsAndPaths()
  search.rebuild()
  return { op = "notable_swap", removed = pick, added_n = #added }
end

-- op: dealloc deep cluster head (high depends count), greedy refill
function search.op_subtree_swap(objective, budget)
  local notables = search.allocated_notables()
  if #notables == 0 then return nil, "no notables" end
  local with_deps = {}
  for _, id in ipairs(notables) do
    local n = build.spec.allocNodes[id]
    if n and n.depends then with_deps[#with_deps+1] = {id = id, count = #n.depends} end
  end
  table.sort(with_deps, function(a, b) return a.count > b.count end)
  local pool = math.max(1, math.floor(#with_deps * 0.25))
  local pick = with_deps[math.random(pool)].id
  local node = build.spec.allocNodes[pick]
  if not node then return nil, "head gone" end
  local mode = node.allocMode or 0 -- refill the freed points in the same pool
  local before = search.pob_count()
  pcall(function() build.spec:DeallocNode(node) end)
  local after_dealloc = search.pob_count()
  io.stderr:write(string.format("[search.op_subtree_swap] dealloc=%s chain=%d budget=%d\n",
    node.name or "?", before - after_dealloc, budget))
  io.stderr:flush()
  local stat = objective.stat or "FullDPS"
  local candidates = search.top_unallocated(stat, 4, 30)
  io.stderr:write(string.format("[search.op_subtree_swap] %d candidates\n", #candidates))
  io.stderr:flush()
  local added = {}
  for _, cand in ipairs(candidates) do
    if search.pob_count() >= budget then break end
    if search.alloc_in_mode(build.spec.nodes[cand.id], mode, budget) then
      added[#added+1] = cand.id
    end
  end
  build.spec:BuildAllDependsAndPaths()
  search.rebuild()
  return { op = "subtree_swap", removed = pick, added_n = #added }
end

-- safe acceptance probability: avoid divide-by-zero when current_score ~= 0
local function sa_accept(delta, T, current_score)
  if delta > 0 then return true end
  if delta == -math.huge then return false end
  local denom = T * math.abs(current_score)
  if denom < 1e-6 then denom = T end -- fallback when score near zero
  local p = math.exp(delta / denom)
  return math.random() < p
end

-- =========================================================================
-- GA helpers
-- =========================================================================

local ga = {}

-- snapshot current build state into a population member shape
local function capture_member(stats_keys, objective, constraints)
  local node_ids = {}
  for id in pairs(build.spec.allocNodes) do node_ids[#node_ids+1] = id end
  local m = {
    xml = build:SaveDB("code"),
    node_ids = node_ids,
    points_used = search.pob_count(),
    stats = search.gather_stats(stats_keys),
    score = search.compute_score(objective),
  }
  local v = search.check_constraints(constraints)
  if #v > 0 then m.score = -math.huge; m.violations = v end
  return m
end

-- generate a random build by resetting then random-fill to budget.
-- assumes caller will restore state afterward.
function ga.random_build(budget, stats_keys, objective, constraints, base_xml)
  pcall(loadBuildFromXML, base_xml)
  pcall(function() build.spec:ResetNodes() end)
  build.spec:BuildAllDependsAndPaths()
  search.rebuild()
  local safety = 0
  while search.pob_count() < budget do
    safety = safety + 1
    if safety > budget * 3 then break end
    local cands = search.adjacent_unallocated(3)
    if #cands == 0 then break end
    local pick = cands[math.random(#cands)]
    local n = build.spec.nodes[pick]
    if n then pcall(function() build.spec:AllocNode(n) end) end
  end
  build.spec:BuildAllDependsAndPaths()
  search.rebuild()
  return capture_member(stats_keys, objective, constraints)
end

-- crossover: union both parents, randomly include unique nodes, repair to budget
function ga.crossover(a, b, budget, stats_keys, objective, constraints, base_xml)
  local a_set, b_set = {}, {}
  for _, id in ipairs(a.node_ids) do a_set[id] = true end
  for _, id in ipairs(b.node_ids) do b_set[id] = true end

  pcall(loadBuildFromXML, base_xml)
  pcall(function() build.spec:ResetNodes() end)
  build.spec:BuildAllDependsAndPaths()
  search.rebuild()

  -- pass 1: common nodes (both parents agree)
  for id, _ in pairs(a_set) do
    if b_set[id] then
      local n = build.spec.nodes[id]
      if n and not n.alloc and search.pob_count() < budget then
        pcall(function() build.spec:AllocNode(n) end)
      end
    end
  end
  -- pass 2: unique nodes from either parent, 50/50
  for id, _ in pairs(a_set) do
    if not b_set[id] and math.random() < 0.5 and search.pob_count() < budget then
      local n = build.spec.nodes[id]
      if n and not n.alloc then pcall(function() build.spec:AllocNode(n) end) end
    end
  end
  for id, _ in pairs(b_set) do
    if not a_set[id] and math.random() < 0.5 and search.pob_count() < budget then
      local n = build.spec.nodes[id]
      if n and not n.alloc then pcall(function() build.spec:AllocNode(n) end) end
    end
  end
  -- repair: fill any remaining budget with random adjacent
  local safety = 0
  while search.pob_count() < budget do
    safety = safety + 1
    if safety > budget * 2 then break end
    local cands = search.adjacent_unallocated(3)
    if #cands == 0 then break end
    local pick = cands[math.random(#cands)]
    local n = build.spec.nodes[pick]
    if n then pcall(function() build.spec:AllocNode(n) end) end
  end
  -- trim if over budget (remove random leaves)
  safety = 0
  while search.pob_count() > budget do
    safety = safety + 1
    if safety > 50 then break end
    local leaves = search.true_leaves()
    if #leaves == 0 then break end
    local pick = leaves[math.random(#leaves)]
    local n = build.spec.allocNodes[pick]
    if n then pcall(function() build.spec:DeallocNode(n) end) end
  end
  build.spec:BuildAllDependsAndPaths()
  search.rebuild()
  return capture_member(stats_keys, objective, constraints)
end

-- mutate: single random leaf swap
function ga.mutate(member, stats_keys, objective, constraints)
  pcall(loadBuildFromXML, member.xml)
  search.rebuild()
  local leaves = search.true_leaves()
  if #leaves > 0 then
    local pick = leaves[math.random(#leaves)]
    local n = build.spec.allocNodes[pick]
    if n then pcall(function() build.spec:DeallocNode(n) end) end
    local cands = search.adjacent_unallocated(2)
    if #cands > 0 then
      local target_id = cands[math.random(#cands)]
      local t = build.spec.nodes[target_id]
      if t then pcall(function() build.spec:AllocNode(t) end) end
    end
    build.spec:BuildAllDependsAndPaths()
  end
  search.rebuild()
  return capture_member(stats_keys, objective, constraints)
end

-- hill climb: K random leaf swaps, accept only if score improves
function ga.hill_climb(member, depth, stats_keys, objective, constraints)
  pcall(loadBuildFromXML, member.xml)
  search.rebuild()
  local current = search.compute_score(objective)
  local improved = 0
  for _ = 1, depth do
    local pre_xml = build:SaveDB("code")
    local leaves = search.true_leaves()
    if #leaves == 0 then break end
    local pick = leaves[math.random(#leaves)]
    local n = build.spec.allocNodes[pick]
    if not n then break end
    pcall(function() build.spec:DeallocNode(n) end)
    local cands = search.adjacent_unallocated(2)
    if #cands == 0 then
      pcall(loadBuildFromXML, pre_xml)
      search.rebuild()
    else
      local target = cands[math.random(#cands)]
      local t = build.spec.nodes[target]
      if t then pcall(function() build.spec:AllocNode(t) end) end
      build.spec:BuildAllDependsAndPaths()
      search.rebuild()
      local new_score = search.compute_score(objective)
      local v = search.check_constraints(constraints)
      if #v > 0 then new_score = -math.huge end
      if new_score > current then
        current = new_score
        improved = improved + 1
      else
        pcall(loadBuildFromXML, pre_xml)
        search.rebuild()
      end
    end
  end
  member = capture_member(stats_keys, objective, constraints)
  member.hc_improvements = improved
  return member
end

-- tournament select 1 individual from `pop` (size N, K=tournament_size)
function ga.tournament_pick(pop, k)
  local best
  for _ = 1, k do
    local cand = pop[math.random(#pop)]
    if not best or cand.score > best.score then best = cand end
  end
  return best
end

-- generic engine: seed a population from an `ops` table and pick the champion.
-- ops = { initial, random, clone, crossover, mutate, hill_climb, hc_evals } where
-- each op returns an opaque member carrying a numeric `.score`. genome-agnostic,
-- so a toy fitness can drive it without PoB (see scripts/ga-toy-test.lua).
function ga.seed(config, ops)
  local pop = { ops.initial() }
  for i = 2, config.pop_size do pop[i] = ops.random() end
  local champion = pop[1]
  for _, m in ipairs(pop) do
    if m.score > champion.score then champion = m end
  end
  return {
    ops = ops,
    pop_size = config.pop_size,
    generations = config.generations,
    elitism = config.elitism,
    crossover_rate = config.crossover_rate,
    tournament_size = config.tournament_size,
    pop = pop, champion = champion, initial_member = pop[1],
    trajectory = {}, total_evals = config.pop_size - 1, gen = 0, t0 = os.time(), finished = false,
  }
end

-- PoB-backed strategies for the generic engine: members are full builds.
function ga.pob_ops(stats_keys, objective, constraints, base_xml, budget, hc_depth)
  return {
    hc_evals = hc_depth,
    initial = function() return capture_member(stats_keys, objective, constraints) end,
    random = function() return ga.random_build(budget, stats_keys, objective, constraints, base_xml) end,
    clone = function(parent)
      pcall(loadBuildFromXML, parent.xml)
      search.rebuild()
      return capture_member(stats_keys, objective, constraints)
    end,
    crossover = function(a, b) return ga.crossover(a, b, budget, stats_keys, objective, constraints, base_xml) end,
    mutate = function(m) return ga.mutate(m, stats_keys, objective, constraints) end,
    hill_climb = function(m) return ga.hill_climb(m, hc_depth, stats_keys, objective, constraints) end,
  }
end

-- PoB adapter: parse args, set up the build, build pob_ops, seed via ga.seed.
-- returns (state) or (nil, error_string).
function ga.init_state(args)
  if not loaded then return nil, "no build loaded" end
  if not args or not args.objective then return nil, "args.objective required" end
  local obj = args.objective
  if not (obj.stat or obj.weights) then return nil, "objective.stat or objective.weights required" end
  local constraints = args.constraints
  local start_mode = args.start_mode or "current"
  local pop_size = tonumber(args.population_size) or 8
  local generations = tonumber(args.generations) or 10
  local hc_depth = tonumber(args.hill_climb_depth) or 3
  local elitism = math.min(tonumber(args.elitism) or 2, pop_size - 1)
  local crossover_rate = tonumber(args.crossover_rate) or 0.7
  local tournament_size = tonumber(args.tournament_size) or 3
  if args.seed then math.randomseed(args.seed) end

  local stats_keys = {
    "FullDPS", "TotalEHP", "Life", "EnergyShield", "Ward", "Evasion", "Armour",
    "FireResist", "ColdResist", "LightningResist", "ChaosResist",
    "BlockChance", "SpellSuppressionChance", "CritChance",
  }
  local seen = {}
  for _, k in ipairs(stats_keys) do seen[k] = true end
  local function add_key(k) if not seen[k] then seen[k] = true; stats_keys[#stats_keys+1] = k end end
  if obj.stat then add_key(obj.stat) end
  if obj.weights then for k, _ in pairs(obj.weights) do add_key(k) end end
  if constraints and constraints.min then for k, _ in pairs(constraints.min) do add_key(k) end end
  if constraints and constraints.max then for k, _ in pairs(constraints.max) do add_key(k) end end

  if start_mode == "fresh" then
    pcall(function() build.spec:ResetNodes() end)
    build.spec:BuildAllDependsAndPaths()
    search.rebuild()
  end
  local base_xml = build:SaveDB("code")
  local point_budget = tonumber(args.point_budget) or search.pob_count()
  search.ws_budget = { [1] = search.ws_used(1), [2] = search.ws_used(2) }

  local ops = ga.pob_ops(stats_keys, obj, constraints, base_xml, point_budget, hc_depth)
  local state = ga.seed({
    pop_size = pop_size, generations = generations, elitism = elitism,
    crossover_rate = crossover_rate, tournament_size = tournament_size,
  }, ops)
  -- fields finalize + the resumable handlers read
  state.obj, state.constraints, state.stats_keys = obj, constraints, stats_keys
  state.base_xml, state.point_budget, state.hc_depth = base_xml, point_budget, hc_depth

  io.stderr:write(string.format(
    "[ga] start pop=%d gens=%d hc=%d budget=%d mode=%s initial_score=%.2f\n",
    pop_size, generations, hc_depth, point_budget, start_mode, state.initial_member.score))
  io.stderr:flush()
  return state
end

-- run exactly one generation, mutating state. returns the trajectory entry.
function ga.evolve_one(state)
  state.gen = state.gen + 1
  local gen = state.gen
  local pop = state.pop
  table.sort(pop, function(a, b) return a.score > b.score end)
  local new_pop = {}
  for i = 1, state.elitism do new_pop[#new_pop+1] = pop[i] end

  local ops = state.ops
  while #new_pop < state.pop_size do
    local p1 = ga.tournament_pick(pop, state.tournament_size)
    local p2 = ga.tournament_pick(pop, state.tournament_size)
    local child
    if math.random() < state.crossover_rate then
      child = ops.crossover(p1, p2)
    else
      child = ops.clone(p1)
    end
    state.total_evals = state.total_evals + 1
    child = ops.mutate(child)
    state.total_evals = state.total_evals + 1
    child = ops.hill_climb(child)
    state.total_evals = state.total_evals + (ops.hc_evals or 1)
    new_pop[#new_pop+1] = child
  end
  state.pop = new_pop

  local gen_best, gen_avg = -math.huge, 0
  for _, m in ipairs(new_pop) do
    if m.score > gen_best then gen_best = m.score end
    gen_avg = gen_avg + (m.score == -math.huge and 0 or m.score)
    if m.score > state.champion.score then state.champion = m end
  end
  gen_avg = gen_avg / state.pop_size

  local entry = {
    generation = gen,
    best_score = gen_best,
    avg_score = gen_avg,
    champion_score = state.champion.score,
    elapsed_s = os.time() - state.t0,
  }
  state.trajectory[#state.trajectory+1] = entry
  io.stderr:write(string.format("[ga] gen=%d best=%.0f avg=%.0f champion=%.0f elapsed=%ds\n",
    gen, gen_best, gen_avg, state.champion.score, entry.elapsed_s))
  io.stderr:flush()
  return entry
end

-- restore champion to live build and return the result block.
function ga.finalize(state)
  search.restore(state.champion.xml)
  io.stderr:write(string.format("[ga] done evals=%d initial=%.2f best=%.2f elapsed=%ds\n",
    state.total_evals, state.initial_member.score, state.champion.score, os.time() - state.t0))
  io.stderr:flush()
  return {
    best = {
      score = state.champion.score,
      stats = state.champion.stats,
      node_ids = state.champion.node_ids,
      points_used = state.champion.points_used,
    },
    initial = { score = state.initial_member.score, stats = state.initial_member.stats },
    trajectory = state.trajectory,
    total_evals = state.total_evals,
    elapsed_s = os.time() - state.t0,
  }
end

return { search = search, ga = ga }
