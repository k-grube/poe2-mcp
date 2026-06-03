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

return gem
