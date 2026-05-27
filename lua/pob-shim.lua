-- lua/pob-shim.lua
-- runs from pob2/src/ via: luajit pob-shim.lua
-- with LUA_PATH set to include ../runtime/lua/

local json = require("dkjson")

-- prevent HeadlessWrapper's promptMsg io.read from consuming a command line
local _real_io_read = io.read
io.read = function(...)
  return ""
end

-- boot HeadlessWrapper (cwd = pob2/src/)
dofile("HeadlessWrapper.lua")

-- restore io.read for our readline loop
io.read = _real_io_read

-- signal ready
io.write(json.encode({ready = true}) .. "\n")
io.flush()

-- state
local loaded = false

local function get_output()
  return build.calcsTab.mainOutput
end

local function safe_num(t, key)
  local v = t and t[key]
  return (type(v) == "number") and v or 0
end

local handlers = {}

handlers["ping"] = function(_args)
  return {ok = true, data = {pong = true}}
end

handlers["probe_output"] = function(_args)
  if not loaded then
    return {ok = false, error = "no build loaded"}
  end
  local out = get_output()
  local keys = {}
  for k, v in pairs(out) do
    if type(v) == "number" then
      keys[k] = v
    end
  end
  return {ok = true, data = keys}
end

handlers["load_build"] = function(args)
  local code = args and args.code
  if not code then
    return {ok = false, error = "args.code required"}
  end
  local ok, err = pcall(loadBuildFromXML, code)
  if not ok then
    return {ok = false, error = tostring(err)}
  end
  if mainObject and mainObject.OnFrame then
    pcall(function() mainObject:OnFrame() end)
  end
  loaded = true
  local b = build
  return {ok = true, data = {
    class_name = b.data and b.data.className or "unknown",
    ascendancy = b.data and b.data.ascendClassName or "none",
    level      = b.data and b.data.level or 0,
    main_skill = (b.skillsTab and b.skillsTab.mainSkill and
                  b.skillsTab.mainSkill.activeEffect and
                  b.skillsTab.mainSkill.activeEffect.grantedEffect and
                  b.skillsTab.mainSkill.activeEffect.grantedEffect.name) or "unknown",
  }}
end

handlers["get_dps"] = function(_args)
  if not loaded then return {ok = false, error = "no build loaded"} end
  local out = get_output()
  return {ok = true, data = {
    full_dps   = safe_num(out, "TotalDPS"),
    avg_hit    = safe_num(out, "AverageDamage"),
    dot_dps    = safe_num(out, "TotalDotDPS"),
    minion_dps = safe_num(out, "MinionDPS") + safe_num(out, "TotalMinionDPS"),
  }}
end

handlers["get_ehp"] = function(_args)
  if not loaded then return {ok = false, error = "no build loaded"} end
  local out = get_output()
  local life = safe_num(out, "Life")
  local es   = safe_num(out, "EnergyShield")
  local ward = safe_num(out, "Ward")
  return {ok = true, data = {
    life           = life,
    es             = es,
    ward           = ward,
    total_ehp      = life + es + ward,
    armour         = safe_num(out, "Armour"),
    evasion        = safe_num(out, "Evasion"),
    block_chance   = safe_num(out, "BlockChance"),
    spell_suppress = safe_num(out, "SpellSuppressionChance"),
  }}
end

handlers["get_breakpoints"] = function(_args)
  if not loaded then return {ok = false, error = "no build loaded"} end
  local out = get_output()
  return {ok = true, data = {
    crit_chance          = safe_num(out, "CritChance"),
    crit_capped          = (safe_num(out, "CritChance") >= 100),
    hit_chance           = safe_num(out, "HitChance"),
    fire_res             = safe_num(out, "FireResist"),
    cold_res             = safe_num(out, "ColdResist"),
    lightning_res        = safe_num(out, "LightningResist"),
    chaos_res            = safe_num(out, "ChaosResist"),
    fire_res_capped      = (safe_num(out, "FireResist")      >= 75),
    cold_res_capped      = (safe_num(out, "ColdResist")      >= 75),
    lightning_res_capped = (safe_num(out, "LightningResist") >= 75),
  }}
end

handlers["compare_gem_swap"] = function(args)
  if not loaded then return {ok = false, error = "no build loaded"} end
  local origXml = build.SaveSpec and build:SaveSpec() or nil
  if not origXml then
    return {ok = false, error = "build:SaveSpec() not available"}
  end
  local slot    = tostring(args and args.slot or "")
  local new_gem = tostring(args and args.gem  or "")
  if slot == "" or new_gem == "" then
    return {ok = false, error = "args.slot and args.gem required"}
  end
  local before_dps = safe_num(get_output(), "TotalDPS")
  local pattern = '(slot="' .. slot .. '"[^>]*skillId=")([^"]+)(")'
  local swapped_xml, n = string.gsub(origXml, pattern, function(pre, _old, post)
    return pre .. new_gem .. post
  end)
  if n == 0 then
    return {ok = false, error = 'slot "' .. slot .. '" not found in build XML'}
  end
  local ok, err = pcall(loadBuildFromXML, swapped_xml)
  if not ok then
    pcall(loadBuildFromXML, origXml)
    return {ok = false, error = "failed to load swapped build: " .. tostring(err)}
  end
  if mainObject and mainObject.OnFrame then pcall(function() mainObject:OnFrame() end) end
  local after_dps = safe_num(get_output(), "TotalDPS")
  pcall(loadBuildFromXML, origXml)
  if mainObject and mainObject.OnFrame then pcall(function() mainObject:OnFrame() end) end
  local delta_pct = before_dps > 0 and ((after_dps - before_dps) / before_dps * 100) or 0
  return {ok = true, data = {
    before    = {full_dps = before_dps},
    after     = {full_dps = after_dps},
    delta_pct = delta_pct,
  }}
end

handlers["get_tree_summary"] = function(_args)
  if not loaded then return {ok = false, error = "no build loaded"} end
  local spec = build.spec
  if not spec then return {ok = false, error = "no passive spec loaded"} end
  local keystones, notables = {}, {}
  if spec.nodes then
    for _, node in pairs(spec.nodes) do
      if node.isKeystone then
        keystones[#keystones+1] = node.name or "?"
      elseif node.isNotable then
        notables[#notables+1] = node.name or "?"
      end
    end
  end
  return {ok = true, data = {
    points_used = spec.allocNodes and #spec.allocNodes or 0,
    keystones   = keystones,
    notables    = notables,
  }}
end

-- readline loop
while true do
  local line = io.read("*l")
  if not line then break end
  line = line:match("^%s*(.-)%s*$")
  if line == "" then goto continue end

  local req, _, decode_err = json.decode(line)
  if not req then
    io.write(json.encode({seq = 0, ok = false, error = "json parse error: " .. tostring(decode_err)}) .. "\n")
    io.flush()
    goto continue
  end

  local cmd = req.cmd
  local seq = req.seq or 0
  local handler = handlers[cmd]
  local resp
  if handler then
    local ok, result = pcall(handler, req.args)
    if ok then
      resp = result
    else
      resp = {ok = false, error = tostring(result)}
    end
  else
    resp = {ok = false, error = "unknown command: " .. tostring(cmd)}
  end
  resp.seq = seq
  io.write(json.encode(resp) .. "\n")
  io.flush()

  ::continue::
end
