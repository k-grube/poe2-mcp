-- gem-support optimizer. required by pob-shim.lua. reads globals: build, get_output, calcLib.
-- leans on PoB for the rules: canGrantedEffectSupportActiveSkill (validity), the calc's own
-- dedup, lineageSupportGemLimitWarning (lineage), reqStr/Dex/Int + Spirit (feasibility).

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

-- greedy forward-selection for one group. adds the best-scoring valid support each round
-- until k sockets fill. `lineage` is a shared { family -> remaining } budget across skills;
-- only lineage picks consume it (non-lineage supports carry a family tag but don't). returns
-- the chosen support ids + final score.
function gem.greedy(group, objective, mode, lineage, cap)
  local pool = gem.valid_supports(group, mode)
  local k = gem.socket_count(group, mode)
  local chosen, chosen_set = {}, {}
  for _ = 1, k do
    local best_id, best_family, best_lineage, best_score = nil, nil, false, -math.huge
    for _, s in ipairs(pool) do
      local lineage_ok = not s.lineage or not s.family or lineage_remaining(lineage, s.family, cap) > 0
      if not chosen_set[s.id] and lineage_ok then
        local trial = {}
        for _, id in ipairs(chosen) do trial[#trial+1] = id end
        trial[#trial+1] = s.id
        gem.set_supports(group, trial, mode)
        local sc = gem.score(objective)
        if sc > best_score then best_id, best_family, best_lineage, best_score = s.id, s.family, s.lineage, sc end
      end
    end
    if not best_id then break end
    chosen[#chosen+1] = best_id
    chosen_set[best_id] = true
    if best_lineage and best_family then
      lineage[best_family] = lineage_remaining(lineage, best_family, cap) - 1
    end
  end
  gem.set_supports(group, chosen, mode) -- leave the group on its greedy result
  return chosen, gem.score(objective)
end

-- GA polish: refine one group's support set with the genome-agnostic engine (require("search").ga).
-- genome = an ordered support-id subset, fitness = recalc score (lineage violations score -inf so
-- the engine rejects them). small budget by default. returns the best set + its score.
function gem.polish(group, objective, mode, lineage, cap, seed_ids, gens, pop_size)
  local ga = require("search").ga
  local pool = gem.valid_supports(group, mode)
  local k = gem.socket_count(group, mode)
  local function random_set()
    local ids, seen = {}, {}
    local tries = 0
    while #ids < k and tries < k * 4 do
      tries = tries + 1
      local s = pool[math.random(#pool)]
      if s and not seen[s.id] then seen[s.id] = true; ids[#ids+1] = s.id end
    end
    return ids
  end
  local function capture(ids)
    gem.set_supports(group, ids, mode)
    return { ids = ids, score = gem.score(objective) }
  end
  local ops = {
    hc_evals = 1,
    initial = function() return capture(seed_ids) end,
    random = function() return capture(random_set()) end,
    clone = function(p) return capture(p.ids) end,
    crossover = function(a, b)
      local ids, seen = {}, {}
      for _, id in ipairs(a.ids) do if #ids < k and not seen[id] then seen[id] = true; ids[#ids+1] = id end end
      for _, id in ipairs(b.ids) do if #ids < k and not seen[id] then seen[id] = true; ids[#ids+1] = id end end
      return capture(ids)
    end,
    mutate = function(m)
      local ids = {}
      for _, id in ipairs(m.ids) do ids[#ids+1] = id end
      if #ids > 0 and #pool > 0 then ids[math.random(#ids)] = pool[math.random(#pool)].id end
      return capture(ids)
    end,
    hill_climb = function(m) return m end,
  }
  local state = ga.seed({ pop_size = pop_size or 6, generations = gens or 5, elitism = 2,
    crossover_rate = 0.7, tournament_size = 3 }, ops)
  for _ = 1, (gens or 5) do ga.evolve_one(state) end
  gem.set_supports(group, state.champion.ids, mode)
  return state.champion.ids, gem.score(objective)
end

-- orchestrate a run: pick the in-scope groups, greedy + polish each, return per-skill results.
-- args: { objective, mode = {idealized=bool}, scope = "main"|"all"|{indices} }.
function gem.run(args)
  local objective = args.objective or { stat = "FullDPS" }
  local mode = args.mode or { idealized = true }
  if not mode.idealized then
    local out = get_output()
    mode.str, mode.dex, mode.int = out.Str or 0, out.Dex or 0, out.Int or 0
  end
  local groups = gem.scope_groups(args.scope)
  -- MaxLineageCount (base 1) caps lineage supports per family character-wide
  local cap = 1
  local env = build.calcsTab.mainEnv
  if env and env.modDB then
    local ok, v = pcall(function() return env.modDB:Sum("BASE", nil, "MaxLineageCount") end)
    if ok and v and v >= 1 then cap = v end
  end
  local lineage = {}
  local results = {}
  for _, gi in ipairs(groups) do
    local group = build.skillsTab.socketGroupList[gi]
    if group and gem.active_skill(group) then
      local before = gem.score(objective)
      local chosen = gem.greedy(group, objective, mode, lineage, cap)
      local polished, after = gem.polish(group, objective, mode, lineage, cap, chosen)
      results[#results+1] = { group = gi, supports = polished, score = after, score_before = before }
    end
  end
  return { results = results }
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
