-- companion gem helpers. required by pob-shim.lua and gem-search.lua. reads the global
-- build (set by HeadlessWrapper), same as the other engine modules.
--
-- PoB shares one mutable grantedEffect.name across every Companion gem, so reading
-- activeEffect.grantedEffect.name for a Companion returns whichever beast was processed
-- last. resolve the real beast via gem.skillMinion -> build.data.minions[id].name instead.
local companions = {}

-- a gem is a Companion when its nameSpec is tagged "Companion: <beast>"
function companions.is_companion(gem)
  return gem ~= nil and gem.nameSpec ~= nil and gem.nameSpec:match("^Companion:") ~= nil
end

-- the beast metadata table for a companion gem, or nil
function companions.minion(gem)
  local id = gem and gem.skillMinion
  if not (id and build.data and build.data.minions) then return nil end
  return build.data.minions[id]
end

-- the beast's true name (no prefix), or nil when it can't be resolved
function companions.beast_name(gem)
  local m = companions.minion(gem)
  return m and m.name or nil
end

-- display name for a gem. Companion -> "Companion: <beast>" via the skillMinion lookup,
-- nameSpec when the beast is unresolved. non-Companion -> the granted-effect name (pass the
-- gem's resolved grantedEffect as ge), then nameSpec, then "?".
function companions.display_name(gem, ge)
  if companions.is_companion(gem) then
    local name = companions.beast_name(gem)
    if name then return "Companion: " .. name end
    return gem.nameSpec
  end
  return (ge and ge.name) or (gem and gem.nameSpec) or "?"
end

-- first Companion gem in a socket group, or nil
function companions.find(group)
  for _, gem in ipairs(group and group.gemList or {}) do
    if companions.is_companion(gem) then return gem end
  end
  return nil
end

return companions
