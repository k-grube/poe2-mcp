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
      local main_skill = sg.displaySkillList and sg.displaySkillList[sg.mainActiveSkill or 1]
      groups[#groups+1] = {
        index               = i,
        label               = sg.label,
        enabled             = sg.enabled == true,
        include_in_full_dps = sg.includeInFullDPS == true,
        is_main             = i == build.mainSocketGroup,
        slot                = sg.slot,
        source              = sg.source,
        main_skill_name     = main_skill and main_skill.activeEffect and main_skill.activeEffect.grantedEffect and main_skill.activeEffect.grantedEffect.name,
        gem_count           = sg.gemList and #sg.gemList or 0,
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
  local b = build
  local sg = b.skillsTab and b.skillsTab.socketGroupList and b.skillsTab.socketGroupList[b.mainSocketGroup]
  local skill = sg and sg.displaySkillList and sg.displaySkillList[sg.mainActiveSkill or 1]
  return {ok = true, data = {
    class_name  = (b.spec and b.spec.curClassName) or "unknown",
    ascendancy  = (b.spec and b.spec.curAscendClassName) or "none",
    level       = b.characterLevel or 0,
    main_skill  = (skill and skill.activeEffect and skill.activeEffect.grantedEffect and skill.activeEffect.grantedEffect.name) or "unknown",
  }}
end

handlers["get_dps"] = function(_args)
  if not loaded then return {ok = false, error = "no build loaded"} end
  local out = get_output()
  -- per-skill breakdown from SkillDPS array; PoB sorts by dps*count desc when displaying
  local skills = {}
  if type(out.SkillDPS) == "table" then
    for _, s in ipairs(out.SkillDPS) do
      local count = s.count or 1
      local entry = {
        name  = s.name or "?",
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
  local points_used = 0
  if spec.allocNodes then
    for _, node in pairs(spec.allocNodes) do
      points_used = points_used + 1
      if node.isKeystone then
        keystones[#keystones+1] = node.name or "?"
      elseif node.isNotable then
        notables[#notables+1] = node.name or "?"
      end
    end
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
