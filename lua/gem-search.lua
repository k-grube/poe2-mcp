-- gem-support optimizer. required by pob-shim.lua. reads globals: build, get_output, calcLib.
-- leans on PoB for the rules: canGrantedEffectSupportActiveSkill (validity), the calc's own
-- dedup, lineageSupportGemLimitWarning (lineage), reqStr/Dex/Int + Spirit (feasibility).
-- the search is a resumable state machine: gem.start sets up, gem.step advances one greedy
-- socket-fill or one GA generation, gem.run drives steps to completion synchronously.

local gem = {}

-- the active skill object for a socket group (nil if the group has no active gem)
function gem.active_skill(group)
  if not (group and group.displaySkillList) then return nil end
  return group.displaySkillList[group.mainActiveSkill or 1]
end

-- attribute feasibility. idealized mode assumes a maxed character meets attr reqs;
-- as-imported compares against the character's Str/Dex/Int. Spirit is checked post-recalc.
function gem.feasible(gemData, mode)
  if not gemData then return false end
  if mode.idealized then return true end
  local rs, rd, ri = gemData.reqStr or 0, gemData.reqDex or 0, gemData.reqInt or 0
  return (mode.str or 0) >= rs and (mode.dex or 0) >= rd and (mode.int or 0) >= ri
end

-- every support gem PoB says can support this group's active skill, filtered by attribute
-- feasibility. returns a list of { id, name, gemData, lineage, family }. family/lineage come
-- off grantedEffect (gemFamily is an array there, the same source CalcSetup lineage logic reads).
function gem.valid_supports(group, mode)
  local out = {}
  local active = gem.active_skill(group)
  if not active then return out end
  for gemId, gemData in pairs(build.data.gems) do
    local ge = gemData.grantedEffect
    if ge and ge.support and calcLib.canGrantedEffectSupportActiveSkill(ge, active)
       and gem.feasible(gemData, mode) then
      out[#out+1] = {
        id = gemId, name = ge.name, gemData = gemData,
        lineage = ge.isLineage == true,
        family = (ge.gemFamily and ge.gemFamily[1]) or (ge.isLineage and ge.name) or nil,
      }
    end
  end
  return out
end

-- rebuild the group's gem list as [its active gems] + [the chosen support ids], then
-- reprocess + recalc. support_ids is an ordered list of gem DB ids. idealized stamps level
-- 20 / quality 20 (PoB clamps support level to 1, quality is honored). ProcessSocketGroup
-- derives skillId/nameSpec/gemData/reqs from gemId, so the instance only needs these fields.
function gem.set_supports(group, support_ids, mode)
  local kept = {}
  for _, inst in ipairs(group.gemList) do
    local ge = inst.grantedEffect or (inst.gemData and inst.gemData.grantedEffect)
    if not (ge and ge.support) then kept[#kept+1] = inst end
  end
  group.gemList = kept
  local lvl = mode.idealized and 20 or nil
  local qual = mode.idealized and 20 or nil
  for _, id in ipairs(support_ids) do
    local gemData = build.data.gems[id]
    if gemData then
      group.gemList[#group.gemList+1] = {
        gemId = id, level = lvl or gemData.naturalMaxLevel or 20, quality = qual or 0, enabled = true,
      }
    end
  end
  build.skillsTab:ProcessSocketGroup(group)
  build.buildFlag = true
  pcall(function() build.calcsTab:BuildOutput() end)
end

-- objective score of the current build state (same shape as search.lua: objective.stat or
-- objective.weights). -inf when a lineage limit is violated, so greedy/polish reject it.
function gem.score(objective)
  local env = build.calcsTab.mainEnv
  if env and env.itemWarnings and env.itemWarnings.lineageSupportGemLimitWarning
     and #env.itemWarnings.lineageSupportGemLimitWarning > 0 then
    return -math.huge
  end
  local out = get_output()
  if objective.stat then return out[objective.stat] or 0 end
  if objective.weights then
    local total = 0
    for stat, w in pairs(objective.weights) do total = total + w * (out[stat] or 0) end
    return total
  end
  return 0
end

-- socket count for a group: idealized = 5, as-imported = the support slots the build's
-- active gem currently exposes.
function gem.socket_count(group, mode)
  if mode.idealized then return 5 end
  local n = 0
  for _, inst in ipairs(group.gemList) do
    local ge = inst.grantedEffect or (inst.gemData and inst.gemData.grantedEffect)
    if ge and ge.support then n = n + 1 end
  end
  return n
end

-- shared lineage budget: remaining slots for a family (cap until first spent, then tracked).
local function lineage_remaining(lineage, family, cap)
  if lineage[family] == nil then return cap or 1 end
  return lineage[family]
end

-- set up state for the next in-scope group, or finish. captures the before-supports (for
-- kept/removed), the candidate pool, the socket count, and resets greedy progress.
function gem._advance_group(state)
  state.gi = state.gi + 1
  local gi = state.groups[state.gi]
  if not gi then
    state.group, state.finished = nil, true
    return
  end
  local group = build.skillsTab.socketGroupList[gi]
  state.group, state.group_index = group, gi
  local a = gem.active_skill(group)
  state.skill_name = (a and a.activeEffect and a.activeEffect.grantedEffect and a.activeEffect.grantedEffect.name) or "?"
  state.prev = {}
  for _, inst in ipairs(group.gemList) do
    local ge = inst.grantedEffect or (inst.gemData and inst.gemData.grantedEffect)
    if ge and ge.support and inst.gemId then state.prev[inst.gemId] = ge.name or "?" end
  end
  state.before_score = gem.score(state.objective)
  state.pool = gem.valid_supports(group, state.mode)
  state.k = gem.socket_count(group, state.mode)
  state.chosen, state.chosen_set, state.socket = {}, {}, 0
  state.phase, state.ga, state.gen = "greedy", nil, 0
end

-- fill one socket: pick the best valid+budgeted support not already chosen, append it,
-- spend the lineage budget if it was a lineage pick, leave the build on the new best.
function gem._greedy_socket(state)
  local best_id, best_family, best_lineage, best_score = nil, nil, false, -math.huge
  for _, s in ipairs(state.pool) do
    local lineage_ok = not s.lineage or not s.family or lineage_remaining(state.lineage, s.family, state.cap) > 0
    if not state.chosen_set[s.id] and lineage_ok then
      local trial = {}
      for _, id in ipairs(state.chosen) do
        trial[#trial+1] = id
      end
      trial[#trial+1] = s.id
      gem.set_supports(state.group, trial, state.mode)
      local sc = gem.score(state.objective)
      if sc > best_score then
        best_id, best_family, best_lineage, best_score = s.id, s.family, s.lineage, sc
      end
    end
  end
  if best_id then
    state.chosen[#state.chosen+1] = best_id
    state.chosen_set[best_id] = true
    if best_lineage and best_family then
      state.lineage[best_family] = lineage_remaining(state.lineage, best_family, state.cap) - 1
    end
  end
  state.socket = state.socket + 1
  gem.set_supports(state.group, state.chosen, state.mode)
end

-- seed the genome-agnostic GA (require("search").ga) with the greedy result. one generation
-- is driven per step. genome = an ordered support-id subset, fitness = recalc score (lineage
-- violations score -inf so the engine rejects them).
function gem._polish_init(state)
  local ga = require("search").ga
  local group, objective, mode, pool, k = state.group, state.objective, state.mode, state.pool, state.k
  local function random_set()
    local ids, seen, tries = {}, {}, 0
    while #ids < k and tries < k * 4 do
      tries = tries + 1
      local s = pool[math.random(#pool)]
      if s and not seen[s.id] then
        seen[s.id] = true
        ids[#ids+1] = s.id
      end
    end
    return ids
  end
  local function capture(ids)
    gem.set_supports(group, ids, mode)
    return { ids = ids, score = gem.score(objective) }
  end
  local seed_ids = state.chosen
  local ops = {
    hc_evals = 1,
    initial = function() return capture(seed_ids) end,
    random = function() return capture(random_set()) end,
    clone = function(p) return capture(p.ids) end,
    crossover = function(a, b)
      local ids, seen = {}, {}
      for _, id in ipairs(a.ids) do
        if #ids < k and not seen[id] then seen[id] = true; ids[#ids+1] = id end
      end
      for _, id in ipairs(b.ids) do
        if #ids < k and not seen[id] then seen[id] = true; ids[#ids+1] = id end
      end
      return capture(ids)
    end,
    mutate = function(m)
      local ids = {}
      for _, id in ipairs(m.ids) do
        ids[#ids+1] = id
      end
      if #ids > 0 and #pool > 0 then ids[math.random(#ids)] = pool[math.random(#pool)].id end
      return capture(ids)
    end,
    hill_climb = function(m) return m end,
  }
  return ga.seed({ pop_size = state.polish_pop, generations = state.polish_gens, elitism = 2,
    crossover_rate = 0.7, tournament_size = 3 }, ops)
end

-- record the finished group: final supports (kept flag), the removed originals, scores.
function gem._finalize_group(state, final_ids)
  gem.set_supports(state.group, final_ids, state.mode)
  local after = gem.score(state.objective)
  local supports, kept_set = {}, {}
  for _, id in ipairs(final_ids) do
    kept_set[id] = true
    local gd = build.data.gems[id]
    local ge = gd and gd.grantedEffect
    supports[#supports+1] = { id = id, name = (ge and ge.name) or "?", kept = state.prev[id] ~= nil }
  end
  local removed = {}
  for id, name in pairs(state.prev) do
    if not kept_set[id] then removed[#removed+1] = { id = id, name = name } end
  end
  state.results[#state.results+1] = {
    group = state.group_index, main_skill = state.skill_name,
    supports = supports, removed = removed, score = after, score_before = state.before_score,
  }
end

-- progress snapshot for the current step (consumed by the shim/job, streamed to the viz)
function gem._progress(state)
  if state.finished then
    return { done = true, results = state.results }
  end
  local ids = (state.phase == "polish" and state.ga) and state.ga.champion.ids or state.chosen
  local cur = {}
  for _, id in ipairs(ids or {}) do
    local gd = build.data.gems[id]
    local ge = gd and gd.grantedEffect
    cur[#cur+1] = { id = id, name = (ge and ge.name) or "?" }
  end
  local best = (state.phase == "polish" and state.ga) and state.ga.champion.score or gem.score(state.objective)
  return {
    done = false,
    group = state.group_index, main_skill = state.skill_name, phase = state.phase,
    step = (state.phase == "greedy") and state.socket or state.gen,
    total_steps = (state.phase == "greedy") and state.k or state.polish_gens,
    best_score = best, score_before = state.before_score,
    current_supports = cur, done_results = state.results,
    group_ordinal = state.gi, total_groups = #state.groups,
  }
end

-- begin a run: resolve objective/mode/scope/lineage cap, set up the first group.
function gem.start(args)
  local objective = args.objective or { stat = "FullDPS" }
  local mode = args.mode or { idealized = true }
  if not mode.idealized then
    local out = get_output()
    mode.str, mode.dex, mode.int = out.Str or 0, out.Dex or 0, out.Int or 0
  end
  local cap = 1
  local env = build.calcsTab.mainEnv
  if env and env.modDB then
    local ok, v = pcall(function() return env.modDB:Sum("BASE", nil, "MaxLineageCount") end)
    if ok and v and v >= 1 then cap = v end
  end
  local groups = {}
  for _, gi in ipairs(gem.scope_groups(args.scope)) do
    local group = build.skillsTab.socketGroupList[gi]
    if group and gem.active_skill(group) then groups[#groups+1] = gi end
  end
  local state = {
    objective = objective, mode = mode, cap = cap, lineage = {}, groups = groups, gi = 0,
    polish_gens = tonumber(args.polish_generations) or 5,
    polish_pop = tonumber(args.polish_population) or 6,
    results = {}, finished = false,
  }
  gem._advance_group(state)
  return state
end

-- advance one unit of work: one greedy socket, one GA generation, or finalize + advance.
function gem.step(state)
  if state.finished then
    return { done = true, results = state.results }
  end
  if state.phase == "greedy" then
    if state.socket < state.k then
      gem._greedy_socket(state)
    end
    if state.socket >= state.k then
      state.ga = gem._polish_init(state)
      state.phase, state.gen = "polish", 0
    end
  elseif state.phase == "polish" then
    if state.gen < state.polish_gens then
      require("search").ga.evolve_one(state.ga)
      state.gen = state.gen + 1
      gem.set_supports(state.group, state.ga.champion.ids, state.mode)
    end
    if state.gen >= state.polish_gens then
      gem._finalize_group(state, state.ga.champion.ids)
      gem._advance_group(state)
    end
  end
  return gem._progress(state)
end

-- synchronous driver (MCP one-shot, tests): loop steps to completion.
function gem.run(args)
  local state = gem.start(args)
  while not state.finished do
    gem.step(state)
  end
  return { results = state.results }
end

-- resolve scope to a list of socket-group indices
function gem.scope_groups(scope)
  if type(scope) == "table" then return scope end
  if scope == "main" or scope == nil then return { build.mainSocketGroup } end
  local out = {}
  for i, sg in ipairs(build.skillsTab.socketGroupList) do
    if sg.includeInFullDPS or i == build.mainSocketGroup then out[#out+1] = i end
  end
  return out
end

return gem
