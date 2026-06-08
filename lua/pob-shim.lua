-- lua/pob-shim.lua
-- runs from pob2/src/ via: luajit pob-shim.lua
-- with LUA_PATH set to include ../runtime/lua/

local json = require("dkjson")

-- lua-utf8 is a Windows-only DLL; on Mac/Linux require('lua-utf8') fails.
-- inject a pure-Lua shim so Common.lua gets a working utf8 table.
-- string.* functions are ASCII/byte equivalents -- close enough for PoB2's formatting code.
if not pcall(require, 'lua-utf8') then
  package.preload['lua-utf8'] = function()
    return {
      char    = string.char,
      byte    = string.byte,
      len     = string.len,
      sub     = string.sub,
      find    = string.find,
      gsub    = string.gsub,
      gmatch  = string.gmatch,
      match   = string.match,
      reverse = string.reverse,
      next    = function(s, i) i = (i or 0) + 1; if i > #s then return nil end; return i, s:sub(i,i) end,
    }
  end
end

-- keep io.read patched permanently so PoB2's error dialog prompts never block on stdin
-- our readline loop uses _real_io_read directly
local _real_io_read = io.read
io.read = function(...)
  return ""
end

-- make sibling lua modules (search.lua) requirable, before HeadlessWrapper runs
do
  local shim_dir = (arg and arg[0] or ""):match("^(.*)[/\\]") or "."
  package.path = shim_dir .. "/?.lua;" .. package.path
end

-- boot HeadlessWrapper (cwd = pob2/src/)
dofile("HeadlessWrapper.lua")

-- signal ready
io.write(json.encode({ready = true}) .. "\n")
io.flush()

-- state (global so the engine module can gate on it too)
loaded = false

-- global so the engine module (search.lua) can read it too
function get_output()
  return build.calcsTab.mainOutput
end

-- the displayed/main skill of a socket group, mirage-aware. meta skills (Mirage Deadeye/Archer)
-- emit empty-named mirror placeholders at the front of displaySkillList, so mainActiveSkill lands
-- on a blank buff. fall through to the first real (named) skill, which is the linked attack the
-- mirage mirrors (e.g. Ice Shot). global so gem-search.lua can use it too.
function display_skill(group)
  if not (group and group.displaySkillList) then return nil end
  local list = group.displaySkillList
  local function named(sk)
    local ge = sk and sk.activeEffect and sk.activeEffect.grantedEffect
    return ge ~= nil and ge.name ~= nil and ge.name ~= ""
  end
  local main = list[group.mainActiveSkill or 1]
  if named(main) then return main end
  for _, sk in ipairs(list) do
    if named(sk) then return sk end
  end
  return main
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

handlers["probe_build"] = function(_args)
  if not loaded then return {ok = false, error = "no build loaded"} end
  local b = build
  local sg = b.skillsTab and b.skillsTab.socketGroupList and b.skillsTab.socketGroupList[b.mainSocketGroup]
  local skill = sg and sg.displaySkillList and sg.displaySkillList[sg.mainActiveSkill or 1]
  local calcs_skill = b.calcsTab and b.calcsTab.mainEnv and b.calcsTab.mainEnv.player and b.calcsTab.mainEnv.player.mainSkill
  return {ok = true, data = {
    characterLevel      = b.characterLevel,
    spec_curClassName   = b.spec and b.spec.curClassName,
    spec_curAscend      = b.spec and b.spec.curAscendClassName,
    mainSocketGroup     = b.mainSocketGroup,
    sg_exists           = sg ~= nil,
    sg_mainActiveSkill  = sg and sg.mainActiveSkill,
    skill_exists        = skill ~= nil,
    skill_name          = skill and skill.activeEffect and skill.activeEffect.grantedEffect and skill.activeEffect.grantedEffect.name,
    calcs_skill_name    = calcs_skill and calcs_skill.activeEffect and calcs_skill.activeEffect.grantedEffect and calcs_skill.activeEffect.grantedEffect.name,
  }}
end

handlers["get_socket_groups"] = function(_args)
  if not loaded then return {ok = false, error = "no build loaded"} end
  local groups = {}
  if build.skillsTab and build.skillsTab.socketGroupList then
    for i, sg in ipairs(build.skillsTab.socketGroupList) do
      local main_skill = display_skill(sg)
      -- companion gems share a mutable grantedEffect.name. resolve the specific beast
      -- via the gem's skillMinion -> build.data.minions lookup, falling back to nameSpec.
      local function resolve_gem_name(gem, ge)
        if gem.nameSpec and gem.nameSpec:match("^Companion:") then
          local minion = gem.skillMinion and build.data and build.data.minions
                         and build.data.minions[gem.skillMinion]
          if minion and minion.name then
            return "Companion: " .. minion.name
          end
          return gem.nameSpec
        end
        return (ge and ge.name) or gem.nameSpec or "?"
      end
      local gems = {}
      local main_active_name = nil
      if sg.gemList then
        for _, gem in ipairs(sg.gemList) do
          local ge = gem.grantedEffect or (gem.gemData and gem.gemData.grantedEffect)
          local resolved = resolve_gem_name(gem, ge)
          gems[#gems+1] = {
            name    = resolved,
            support = (ge and ge.support) == true,
            enabled = gem.enabled ~= false,
            level   = gem.level,
            quality = gem.quality,
          }
          if not main_active_name and not (ge and ge.support)
             and gem.nameSpec and gem.nameSpec:match("^Companion:") then
            main_active_name = resolved
          end
        end
      end
      groups[#groups+1] = {
        index               = i,
        label               = sg.label,
        enabled             = sg.enabled == true,
        include_in_full_dps = sg.includeInFullDPS == true,
        is_main             = i == build.mainSocketGroup,
        slot                = sg.slot,
        source              = sg.source,
        main_skill_name     = main_active_name
                              or (main_skill and main_skill.activeEffect and main_skill.activeEffect.grantedEffect and main_skill.activeEffect.grantedEffect.name),
        gem_count           = sg.gemList and #sg.gemList or 0,
        gems                = gems,
      }
    end
  end
  return {ok = true, data = {groups = groups, main_socket_group = build.mainSocketGroup}}
end

-- toggle includeInFullDPS on one group, multiple groups, or all enabled
handlers["set_full_dps_inclusion"] = function(args)
  if not loaded then return {ok = false, error = "no build loaded"} end
  if not (build and build.skillsTab and build.skillsTab.socketGroupList) then
    return {ok = false, error = "socket group list unavailable"}
  end
  if args == nil or args.included == nil then
    return {ok = false, error = "args.included (bool) required"}
  end
  local include = args.included and true or false
  local list = build.skillsTab.socketGroupList
  local touched = {}
  if args.all_enabled then
    for i, sg in ipairs(list) do
      if sg.enabled then
        sg.includeInFullDPS = include
        touched[#touched+1] = i
      end
    end
  elseif args.indices and type(args.indices) == "table" then
    for _, raw in ipairs(args.indices) do
      local i = tonumber(raw)
      local sg = i and list[i] or nil
      if not sg then return {ok = false, error = "no socket group at index " .. tostring(raw)} end
      sg.includeInFullDPS = include
      touched[#touched+1] = i
    end
  elseif args.index ~= nil then
    local i = tonumber(args.index)
    local sg = i and list[i] or nil
    if not sg then return {ok = false, error = "no socket group at index " .. tostring(args.index)} end
    sg.includeInFullDPS = include
    touched[#touched+1] = i
  else
    return {ok = false, error = "provide one of: index, indices[], all_enabled"}
  end
  -- rebuild output so FullDPS / SkillDPS reflect the new flags
  if build.calcsTab and build.calcsTab.BuildOutput then
    build.buildFlag = true
    pcall(function() build.calcsTab:BuildOutput() end)
  end
  return {ok = true, data = {touched_indices = touched, included = include}}
end

-- header fields shared by load_build and get_build_info
local function build_info()
  local b = build
  local sg = b.skillsTab and b.skillsTab.socketGroupList and b.skillsTab.socketGroupList[b.mainSocketGroup]
  local skill = display_skill(sg)
  -- weapon-set point cap: campaign quest points (24) + conversions (Weapon Master)
  local weapon_sets
  if b.spec and b.spec.CountAllocNodes then
    local _u, _a, _sa, _so, ws1, ws2 = b.spec:CountAllocNodes()
    local extra = (b.calcsTab and b.calcsTab.mainOutput and b.calcsTab.mainOutput.PassivePointsToWeaponSetPoints) or 0
    weapon_sets = { set1 = ws1, set2 = ws2, max = (b.maxWeaponSets or 24) + extra }
  end
  return {
    class_name = (b.spec and b.spec.curClassName) or "unknown",
    ascendancy = (b.spec and b.spec.curAscendClassName) or "none",
    level      = b.characterLevel or 0,
    main_skill = (skill and skill.activeEffect and skill.activeEffect.grantedEffect and skill.activeEffect.grantedEffect.name) or "unknown",
    weapon_sets = weapon_sets,
  }
end

-- poe.ninja exports Companion gems with only nameSpec ("Companion: <beast>") set, missing
-- skillId/gemId/skillMinion + the <BeastCompanion id="..."/> Beast Library entries. PoB
-- can't resolve them, so the gem has no minion and contributes 0 DPS. fix it in place:
-- look up the beast metadata id by name in data.minions, write skillId/skillMinion onto
-- the gem, register the beast into build.beastList, re-process + recalc. returns the
-- number of gems we repaired so the caller can report it.
local function fix_broken_companions()
  if not (build and build.skillsTab and build.skillsTab.socketGroupList
          and build.data and build.data.minions) then
    return 0
  end
  -- name -> metadata id; prefer recommendedBeast variants when a name has multiple entries.
  -- cheap to rebuild per load (data.minions is ~600 entries) and stays correct after pob updates.
  local name_to_id = {}
  for id, m in pairs(build.data.minions) do
    if m.name and m.monsterCategory == "Beast" then
      local existing = name_to_id[m.name]
      if not existing then
        name_to_id[m.name] = id
      elseif m.extraFlags and m.extraFlags.recommendedBeast then
        name_to_id[m.name] = id
      end
    end
  end

  local fixed, added_beasts = 0, {}
  for _, sg in ipairs(build.skillsTab.socketGroupList) do
    for _, gem in ipairs(sg.gemList or {}) do
      if gem.nameSpec and gem.nameSpec:match("^Companion:") and not gem.gemData then
        local beast_name = gem.nameSpec:match("^Companion: (.+)$")
        local beast_id = beast_name and name_to_id[beast_name]
        if beast_id then
          gem.skillId = "SummonBeastPlayer"
          gem.skillMinion = beast_id
          gem.skillMinionSkill = gem.skillMinionSkill or 1
          added_beasts[beast_id] = true
          fixed = fixed + 1
        end
      end
    end
  end

  if fixed > 0 then
    build.beastList = build.beastList or {}
    local in_list = {}
    for _, id in ipairs(build.beastList) do in_list[id] = true end
    for id, _ in pairs(added_beasts) do
      if not in_list[id] then table.insert(build.beastList, id) end
    end
    for _, sg in ipairs(build.skillsTab.socketGroupList) do
      build.skillsTab:ProcessSocketGroup(sg)
    end
    build.buildFlag = true
    pcall(function() build.calcsTab:BuildOutput() end)
  end
  return fixed
end

-- node side handles base64+zlib decode; this handler only sees raw XML
handlers["load_build"] = function(args)
  local xml = args and args.code
  if not xml then
    return {ok = false, error = "args.code required"}
  end
  local ok, err = pcall(loadBuildFromXML, xml)
  if not ok then
    return {ok = false, error = tostring(err)}
  end
  if mainObject and mainObject.OnFrame then
    pcall(function() mainObject:OnFrame() end)
  end
  loaded = true
  local fixed = fix_broken_companions()
  local info = build_info()
  if fixed > 0 then info.fixed_companions = fixed end
  return {ok = true, data = info}
end

handlers["get_build_info"] = function(_args)
  if not loaded then return {ok = false, error = "no build loaded"} end
  return {ok = true, data = build_info()}
end

-- serialize the live build to xml; node side zlib+base64 encodes it into a PoB code.
-- also used to snapshot the baseline before a search mutates the build.
handlers["save_build"] = function(_args)
  if not loaded then return {ok = false, error = "no build loaded"} end
  local ok, xml = pcall(function() return build:SaveDB("code") end)
  if not ok or not xml then return {ok = false, error = "save failed"} end
  return {ok = true, data = {xml = xml}}
end

handlers["get_dps"] = function(_args)
  if not loaded then return {ok = false, error = "no build loaded"} end
  local out = get_output()
  -- per-skill breakdown from SkillDPS array; PoB sorts by dps*count desc when displaying
  local skills = {}
  if type(out.SkillDPS) == "table" then
    for _, s in ipairs(out.SkillDPS) do
      local count = s.count or 1
      local name = s.name or "?"
      -- PoB mutates the shared SummonBeastPlayer grantedEffect.name during calc, so every
      -- Companion entry in SkillDPS ends up labelled with whichever beast was processed
      -- last. skill_part is per-entry ("<beast>: <attack>"); recover the specific name.
      if s.skillPart and name:match("^Companion: ") then
        local beast = s.skillPart:match("^(.-): ")
        if beast then name = "Companion: " .. beast end
      end
      local entry = {
        name  = name,
        dps   = (s.dps or 0) * count,
        count = count,
      }
      if s.trigger and s.trigger ~= "" then entry.trigger = s.trigger end
      if s.source  and s.source  ~= "" then entry.source  = s.source end
      if s.skillPart                  then entry.skill_part = s.skillPart end
      skills[#skills+1] = entry
    end
    table.sort(skills, function(a, b) return a.dps > b.dps end)
  end
  return {ok = true, data = {
    full_dps     = safe_num(out, "FullDPS"),       -- aggregate of all enabled damage skills
    full_dot_dps = safe_num(out, "FullDotDPS"),
    main_dps     = safe_num(out, "TotalDPS"),      -- main socket group only
    main_avg_hit = safe_num(out, "AverageDamage"),
    main_dot_dps = safe_num(out, "TotalDotDPS"),
    minion_dps   = safe_num(out, "MinionDPS") + safe_num(out, "TotalMinionDPS"),
    skills       = skills,
  }}
end

-- swap a Companion gem's beast (skillMinion) across a candidate list, run BuildOutput
-- per swap, record the minion's TotalDPS, then restore the original beast. used to
-- answer "which beast in my library would do the most damage in this socket group?"
handlers["compare_companions"] = function(args)
  if not loaded then return {ok = false, error = "no build loaded"} end
  local gi = (args and tonumber(args.group)) or build.mainSocketGroup
  local sg = build.skillsTab and build.skillsTab.socketGroupList and build.skillsTab.socketGroupList[gi]
  if not sg then return {ok = false, error = "no such socket group: " .. tostring(gi)} end

  local companion_gem
  for _, gem in ipairs(sg.gemList or {}) do
    if gem.nameSpec and gem.nameSpec:match("^Companion:") then
      companion_gem = gem
      break
    end
  end
  if not companion_gem then return {ok = false, error = "no Companion gem in group " .. gi} end

  -- candidates: explicit list, the user's beast library, or every beast PoB knows about
  local candidates
  if args and args.beasts and type(args.beasts) == "table" then
    candidates = args.beasts
  elseif args and args.scope == "all" then
    candidates = {}
    if build.data and build.data.minions then
      for id, m in pairs(build.data.minions) do
        if m.monsterCategory == "Beast" then candidates[#candidates+1] = id end
      end
    end
  else
    candidates = build.beastList or {}
  end

  local orig_minion = companion_gem.skillMinion
  local orig_skill  = companion_gem.skillMinionSkill

  local function find_active_skill()
    local env = build.calcsTab and build.calcsTab.mainEnv
    if not (env and env.player and env.player.activeSkillList) then return nil end
    for _, sk in ipairs(env.player.activeSkillList) do
      if sk.activeEffect and sk.activeEffect.srcInstance == companion_gem then
        return sk
      end
    end
    return nil
  end

  local function rebuild()
    build.buildFlag = true
    pcall(function() build.calcsTab:BuildOutput() end)
  end

  local results = {}
  for _, beast_id in ipairs(candidates) do
    local mdata = build.data and build.data.minions and build.data.minions[beast_id]
    if mdata then
      -- the beast must be in build.beastList for CalcActiveSkill to pick it
      local already_in_list = false
      if build.beastList then
        for _, id in ipairs(build.beastList) do
          if id == beast_id then already_in_list = true break end
        end
      end
      if not already_in_list then
        build.beastList = build.beastList or {}
        table.insert(build.beastList, beast_id)
      end

      companion_gem.skillMinion = beast_id
      companion_gem.skillMinionSkill = 1
      rebuild()
      local sk = find_active_skill()
      local n_skills = (sk and sk.minion and sk.minion.activeSkillList and #sk.minion.activeSkillList) or 0

      local best_dps, best_skill_name, best_skill_index = 0, nil, nil
      if n_skills > 0 then
        -- skill 1 is already computed
        for ski = 1, n_skills do
          if ski > 1 then
            companion_gem.skillMinionSkill = ski
            rebuild()
            sk = find_active_skill()
          end
          local mdps = (sk and sk.minion and sk.minion.output and sk.minion.output.TotalDPS) or 0
          if mdps > best_dps then
            best_dps = mdps
            best_skill_index = ski
            local ms = sk and sk.minion and sk.minion.mainSkill
            best_skill_name = ms and ms.activeEffect and ms.activeEffect.grantedEffect and ms.activeEffect.grantedEffect.name
            local part = ms and ms.skillPartName
            if part and part ~= "" then best_skill_name = (best_skill_name or "?") .. ": " .. part end
          end
        end
      end

      results[#results+1] = {
        beast_id         = beast_id,
        beast_name       = mdata.name,
        dps              = best_dps,
        best_skill       = best_skill_name,
        best_skill_index = best_skill_index,
        skills_evaluated = n_skills,
      }

      if not already_in_list and build.beastList then
        for i = #build.beastList, 1, -1 do
          if build.beastList[i] == beast_id then table.remove(build.beastList, i); break end
        end
      end
    end
  end

  companion_gem.skillMinion = orig_minion
  companion_gem.skillMinionSkill = orig_skill
  rebuild()

  table.sort(results, function(a, b) return a.dps > b.dps end)
  return {ok = true, data = {
    group     = gi,
    gem       = companion_gem.nameSpec,
    candidates_evaluated = #results,
    results   = results,
  }}
end

-- list every Companion gem's available minion skills, indexed for use as
-- gem_search { minion_skill_index } or set_minion_skill { skill_index }. each entry has
-- the socket group + beast + the list of minion skill names with their 1-based index.
handlers["get_minion_skills"] = function(_args)
  if not loaded then return {ok = false, error = "no build loaded"} end
  local env = build.calcsTab and build.calcsTab.mainEnv
  if not (env and env.player and env.player.activeSkillList) then
    return {ok = false, error = "no activeSkillList"}
  end
  local out = {}
  if build.skillsTab and build.skillsTab.socketGroupList then
    for gi, sg in ipairs(build.skillsTab.socketGroupList) do
      local companion = nil
      for _, gem in ipairs(sg.gemList or {}) do
        if gem.nameSpec and gem.nameSpec:match("^Companion:") then
          companion = gem
          break
        end
      end
      if companion then
        local sk_ref
        for _, sk in ipairs(env.player.activeSkillList) do
          if sk.activeEffect and sk.activeEffect.srcInstance == companion then
            sk_ref = sk
            break
          end
        end
        local skills = {}
        if sk_ref and sk_ref.minion and sk_ref.minion.activeSkillList then
          for i, ms in ipairs(sk_ref.minion.activeSkillList) do
            local name = ms.activeEffect and ms.activeEffect.grantedEffect and ms.activeEffect.grantedEffect.name
            local part = ms.skillPartName
            local label = name or "?"
            if part and part ~= "" then label = label .. ": " .. part end
            skills[#skills+1] = { index = i, name = label }
          end
        end
        local beast_name = companion.skillMinion and build.data and build.data.minions
                           and build.data.minions[companion.skillMinion]
                           and build.data.minions[companion.skillMinion].name
        out[#out+1] = {
          group = gi,
          gem = companion.nameSpec,
          beast = beast_name,
          current_skill_index = companion.skillMinionSkill or 1,
          skills = skills,
        }
      end
    end
  end
  return {ok = true, data = {companions = out}}
end

-- set which socket group is the build's "main" (drives main_skill in build_info, main_dps in
-- get_dps, etc). 1-based index into build.skillsTab.socketGroupList.
handlers["set_main_socket_group"] = function(args)
  if not loaded then return {ok = false, error = "no build loaded"} end
  local i = args and tonumber(args.index)
  if not i then return {ok = false, error = "args.index (1-based) required"} end
  local sg = build.skillsTab and build.skillsTab.socketGroupList and build.skillsTab.socketGroupList[i]
  if not sg then return {ok = false, error = "no socket group at index " .. i} end
  build.mainSocketGroup = i
  build.buildFlag = true
  pcall(function() build.calcsTab:BuildOutput() end)
  return {ok = true, data = {main_socket_group = i}}
end

-- set the minion skill index for a Companion gem in a specific socket group, then rebuild
-- so the choice is reflected in get_dps and downstream metrics.
handlers["set_minion_skill"] = function(args)
  if not loaded then return {ok = false, error = "no build loaded"} end
  local gi = args and tonumber(args.group)
  local ski = args and tonumber(args.skill_index)
  if not gi or not ski or ski < 1 then
    return {ok = false, error = "args.group (1-based) and args.skill_index (>=1) required"}
  end
  local sg = build.skillsTab and build.skillsTab.socketGroupList and build.skillsTab.socketGroupList[gi]
  if not sg then return {ok = false, error = "no socket group at index " .. gi} end
  local companion
  for _, gem in ipairs(sg.gemList or {}) do
    if gem.nameSpec and gem.nameSpec:match("^Companion:") then
      companion = gem
      break
    end
  end
  if not companion then return {ok = false, error = "no Companion gem in group " .. gi} end
  companion.skillMinionSkill = ski
  build.buildFlag = true
  pcall(function() build.calcsTab:BuildOutput() end)
  return {ok = true, data = {group = gi, skill_index = ski}}
end

handlers["get_ehp"] = function(_args)
  if not loaded then return {ok = false, error = "no build loaded"} end
  local out = get_output()
  return {ok = true, data = {
    life           = safe_num(out, "Life"),
    es             = safe_num(out, "EnergyShield"),
    ward           = safe_num(out, "Ward"),
    total_ehp      = safe_num(out, "TotalEHP"),
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
  if spec.allocNodes then
    for _, node in pairs(spec.allocNodes) do
      if node.isKeystone then
        keystones[#keystones+1] = node.name or "?"
      elseif node.isNotable then
        notables[#notables+1] = node.name or "?"
      end
    end
  end
  -- normal passive points as PoB shows them: non-ascendancy/non-start nodes less
  -- the shared weapon-set allocation (weapon-set points have their own indicator)
  local points_used = 0
  if spec.CountAllocNodes then
    local used, _asc, _sasc, _sock, ws1, ws2 = spec:CountAllocNodes()
    points_used = used - math.min(ws1 or 0, ws2 or 0)
  end
  return {ok = true, data = {
    points_used = points_used,
    keystones   = keystones,
    notables    = notables,
  }}
end

local function node_type(node)
  if node.isKeystone        then return "keystone" end
  if node.isNotable         then return "notable" end
  if node.isMastery         then return "mastery" end
  if node.isJewelSocket or node.type == "Socket" then return "jewel_socket" end
  if node.type == "ClassStart"      then return "class_start" end
  if node.type == "AscendClassStart" then return "ascend_start" end
  if node.ascendancyName    then return "ascendancy" end
  return "normal"
end

local function count_alloc()
  local n = 0
  if build and build.spec and build.spec.allocNodes then
    for _ in pairs(build.spec.allocNodes) do n = n + 1 end
  end
  return n
end

handlers["get_allocated_nodes"] = function(_args)
  if not loaded then return {ok = false, error = "no build loaded"} end
  local spec = build.spec
  if not spec then return {ok = false, error = "no passive spec loaded"} end
  local nodes = {}
  if spec.allocNodes then
    for id, node in pairs(spec.allocNodes) do
      nodes[#nodes+1] = {
        id         = id,
        name       = node.name or "?",
        type       = node_type(node),
        ascendancy = node.ascendancyName,
        stats      = node.sd, -- short description / stat lines
        alloc_mode = node.allocMode or 0, -- 0 normal, 1 weapon set 1, 2 weapon set 2
      }
    end
  end
  local used, asc_used = 0, 0
  if spec.CountAllocNodes then
    used, asc_used = spec:CountAllocNodes()
  end
  return {ok = true, data = {
    points_used            = used,
    ascendancy_points_used = asc_used,
    nodes                  = nodes,
  }}
end

handlers["get_tree_layout"] = function(_args)
  if not loaded then return {ok = false, error = "no build loaded"} end
  local spec = build.spec
  if not (spec and spec.nodes) then return {ok = false, error = "no passive spec loaded"} end
  local nodes, edges, seen = {}, {}, {}
  local minX, minY, maxX, maxY = math.huge, math.huge, -math.huge, -math.huge
  for id, node in pairs(spec.nodes) do
    if node.x and node.y then
      nodes[#nodes+1] = {
        id = id,
        type = node_type(node),
        x = node.x,
        y = node.y,
        name = node.name or "?",
        ascendancy = node.ascendancyName,
        stats = node.sd,
      }
      if node.x < minX then minX = node.x end
      if node.y < minY then minY = node.y end
      if node.x > maxX then maxX = node.x end
      if node.y > maxY then maxY = node.y end
      if node.linkedId then
        for _, other in ipairs(node.linkedId) do
          local a, b = id, other
          if a > b then a, b = b, a end
          local key = a .. ":" .. b
          if not seen[key] and spec.nodes[other] then
            seen[key] = true
            edges[#edges+1] = {a, b}
          end
        end
      end
    end
  end
  return {ok = true, data = {
    nodes = nodes,
    edges = edges,
    bounds = {minX = minX, minY = minY, maxX = maxX, maxY = maxY},
  }}
end

handlers["allocate_node"] = function(args)
  if not loaded then return {ok = false, error = "no build loaded"} end
  local id = args and tonumber(args.id)
  if not id then return {ok = false, error = "args.id required (numeric)"} end
  local node = build.spec.nodes[id]
  if not node then return {ok = false, error = "node " .. id .. " not in tree"} end
  if node.alloc or build.spec.allocNodes[id] then
    return {ok = false, error = "node " .. id .. " already allocated"}
  end
  if not node.path then
    return {ok = false, error = "node " .. id .. " not reachable from current allocation"}
  end
  local before = count_alloc()
  local ok, err = pcall(function() build.spec:AllocNode(node) end)
  if not ok then return {ok = false, error = "AllocNode failed: " .. tostring(err)} end
  build.spec:BuildAllDependsAndPaths()
  build.buildFlag = true
  -- recalc directly; OnFrame's BuildOutput is the same path but goes via mode dispatch
  pcall(function() build.calcsTab:BuildOutput() end)
  local after = count_alloc()
  return {ok = true, data = {
    target_node  = {id = id, name = node.name, type = node_type(node)},
    path_added   = after - before, -- nodes allocated along the path (incl. target)
  }}
end

handlers["deallocate_node"] = function(args)
  if not loaded then return {ok = false, error = "no build loaded"} end
  local id = args and tonumber(args.id)
  if not id then return {ok = false, error = "args.id required (numeric)"} end
  local node = build.spec.allocNodes[id]
  if not node then return {ok = false, error = "node " .. id .. " is not allocated"} end
  local before = count_alloc()
  local ok, err = pcall(function() build.spec:DeallocNode(node) end)
  if not ok then return {ok = false, error = "DeallocNode failed: " .. tostring(err)} end
  build.buildFlag = true
  pcall(function() build.calcsTab:BuildOutput() end)
  local after = count_alloc()
  return {ok = true, data = {
    deallocated_node = {id = id, name = node.name, type = node_type(node)},
    chain_removed    = before - after, -- target + any orphaned dependents
  }}
end

-- wraps PoB's CalcsTab:PowerBuilder to score every unallocated node by stat delta
handlers["analyze_tree"] = function(args)
  if not loaded then return {ok = false, error = "no build loaded"} end
  local stat = args and args.objective_stat
  if not stat or stat == "" then
    return {ok = false, error = "args.objective_stat required (e.g. 'FullDPS', 'TotalEHP', 'Life')"}
  end
  local max_hops = args and tonumber(args.max_hops) or nil
  local top_n    = args and tonumber(args.top_n) or 25

  local ct = build.calcsTab
  if not ct then return {ok = false, error = "calcsTab unavailable"} end
  ct.powerStat         = {stat = stat}
  ct.nodePowerMaxDepth = max_hops
  ct.powerBuildFlag    = true

  -- drive the coroutine to completion; PoB's UI yields ~every 100ms, we loop
  local guard = 0
  repeat
    ct:BuildPower()
    guard = guard + 1
    if guard > 500 then break end
  until ct.powerBuilder == nil

  local candidates = {}
  for id, node in pairs(build.spec.nodes) do
    if not node.alloc and node.power
       and node.power.pathPower and node.power.pathPower ~= 0
       and (not max_hops or (node.pathDist and node.pathDist <= max_hops)) then
      local dist = node.pathDist or 1
      candidates[#candidates+1] = {
        id              = id,
        name            = node.name,
        type            = node_type(node),
        single_stat     = node.power.singleStat,
        path_power      = node.power.pathPower,
        path_dist       = dist,
        power_per_point = dist > 0 and (node.power.pathPower / dist) or node.power.pathPower,
      }
    end
  end
  table.sort(candidates, function(a, b) return (a.path_power or 0) > (b.path_power or 0) end)
  local top = {}
  for i = 1, math.min(top_n, #candidates) do top[i] = candidates[i] end

  return {ok = true, data = {
    objective_stat   = stat,
    max_hops         = max_hops,
    iterations       = guard,
    total_candidates = #candidates,
    top              = top,
  }}
end

-- clear every allocated passive (keeps class + ascendancy). useful for
-- "start from scratch" SA where the input is just a class + gear.
handlers["reset_tree"] = function(_args)
  if not loaded then return {ok = false, error = "no build loaded"} end
  if not (build and build.spec) then return {ok = false, error = "no spec"} end
  local before = count_alloc()
  pcall(function() build.spec:ResetNodes() end)
  build.spec:BuildAllDependsAndPaths()
  build.buildFlag = true
  pcall(function() build.calcsTab:BuildOutput() end)
  local after = count_alloc()
  local used, asc_used = 0, 0
  if build.spec.CountAllocNodes then used, asc_used = build.spec:CountAllocNodes() end
  return {ok = true, data = {
    removed = before - after,
    points_used = used,
    ascendancy_points_used = asc_used,
  }}
end

-- search + ga engine (see search.lua)
local engine = require("search")
local search, ga = engine.search, engine.ga

-- gem-support optimizer (see gem-search.lua)
local gem = require("gem-search")

handlers["search_tree_neighborhood"] = function(args)
  local state, err = ga.init_state(args)
  if not state then return {ok = false, error = err} end
  for _ = 1, state.generations do ga.evolve_one(state) end
  return {ok = true, data = ga.finalize(state)}
end

-- one active resumable search at a time (one live build state)
local active_search = nil

handlers["search_start"] = function(args)
  local state, err = ga.init_state(args)
  if not state then return {ok = false, error = err} end
  active_search = state
  return {ok = true, data = {
    initial = { score = state.initial_member.score, stats = state.initial_member.stats },
    total_generations = state.generations,
    point_budget = state.point_budget,
  }}
end

handlers["search_step"] = function(_args)
  local state = active_search
  if not state then return {ok = false, error = "no active search; call search_start first"} end
  if state.finished then return {ok = false, error = "search already finished; call search_result"} end

  local entry = ga.evolve_one(state)
  local data = {
    done = false,
    generation = entry.generation,
    best_score = entry.best_score,
    avg_score = entry.avg_score,
    champion_score = entry.champion_score,
    elapsed_s = entry.elapsed_s,
    champion_node_ids = state.champion.node_ids,
    champion_node_modes = state.champion.node_modes,
    champion_stats = state.champion.stats,
    points_used = state.champion.points_used,
  }
  if state.gen >= state.generations then
    local result = ga.finalize(state)  -- restores champion to live build
    state.finished = true
    data.done = true
    data.best = result.best
    data.initial = result.initial
    data.total_evals = result.total_evals
  else
    search.restore(state.champion.xml)  -- keep live build coherent between steps
  end
  return {ok = true, data = data}
end

handlers["search_cancel"] = function(_args)
  active_search = nil
  return {ok = true, data = {cancelled = true}}
end

-- gem-support optimization. greedy + GA polish runs synchronously in one call (fast in-process).
handlers["get_valid_supports"] = function(args)
  if not loaded then return {ok = false, error = "no build loaded"} end
  local gi = (args and tonumber(args.group)) or build.mainSocketGroup
  local group = build.skillsTab.socketGroupList[gi]
  if not group then return {ok = false, error = "no such socket group"} end
  local mode = { idealized = not (args and args.as_imported) }
  if not mode.idealized then
    local out = get_output()
    mode.str, mode.dex, mode.int = out.Str or 0, out.Dex or 0, out.Int or 0
  end
  local list = {}
  for _, s in ipairs(gem.valid_supports(group, mode)) do
    list[#list+1] = { id = s.id, name = s.name, lineage = s.lineage, family = s.family }
  end
  return {ok = true, data = {group = gi, supports = list}}
end

handlers["gem_search"] = function(args)
  if not loaded then return {ok = false, error = "no build loaded"} end
  local ok, res = pcall(function() return gem.run(args or {}) end)
  if not ok then return {ok = false, error = tostring(res)} end
  return {ok = true, data = res}
end

-- async gem search: one resumable run at a time (one live build state), driven by the TS
-- job loop. step does one socket-fill or one GA generation and returns progress.
local active_gem = nil

handlers["gem_search_start"] = function(args)
  if not loaded then return {ok = false, error = "no build loaded"} end
  local ok, state = pcall(function() return gem.start(args or {}) end)
  if not ok then return {ok = false, error = tostring(state)} end
  active_gem = state
  return {ok = true, data = {total_groups = #state.groups, groups = state.groups}}
end

handlers["gem_search_step"] = function(_args)
  if not active_gem then return {ok = false, error = "no active gem search; call gem_search_start first"} end
  local ok, p = pcall(function() return gem.step(active_gem) end)
  if not ok then
    active_gem = nil
    return {ok = false, error = tostring(p)}
  end
  if p.done then active_gem = nil end
  return {ok = true, data = p}
end

handlers["gem_search_cancel"] = function(_args)
  active_gem = nil
  return {ok = true, data = {cancelled = true}}
end

-- readline loop
while true do
  local line = _real_io_read("*l")
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
