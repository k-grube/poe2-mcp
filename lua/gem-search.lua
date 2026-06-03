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

return gem
