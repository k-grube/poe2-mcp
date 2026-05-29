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

-- boot HeadlessWrapper (cwd = pob2/src/)
dofile("HeadlessWrapper.lua")

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
-- excludes class start, ascend start, ascendancy nodes (those are pinned).
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
  pcall(function() build.spec:DeallocNode(node) end)
  local candidates = search.adjacent_unallocated(2)
  local added
  if #candidates > 0 then
    local target_id = candidates[math.random(#candidates)]
    local t = build.spec.nodes[target_id]
    if t then
      pcall(function() build.spec:AllocNode(t) end)
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
    local t = build.spec.nodes[cand.id]
    if t and not t.alloc then
      pcall(function() build.spec:AllocNode(t) end)
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
    local t = build.spec.nodes[cand.id]
    if t and not t.alloc then
      pcall(function() build.spec:AllocNode(t) end)
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

-- build a resumable search state: parse args, seed population, pick champion.
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
  local initial_member = capture_member(stats_keys, obj, constraints)

  io.stderr:write(string.format(
    "[ga] start pop=%d gens=%d hc=%d budget=%d mode=%s initial_score=%.2f\n",
    pop_size, generations, hc_depth, point_budget, start_mode, initial_member.score))
  io.stderr:flush()

  local pop = { initial_member }
  for i = 2, pop_size do
    local m = ga.random_build(point_budget, stats_keys, obj, constraints, base_xml)
    pop[i] = m
    io.stderr:write(string.format("[ga] init %d/%d score=%.0f pts=%d\n", i, pop_size, m.score, m.points_used))
    io.stderr:flush()
  end

  local champion = pop[1]
  for _, m in ipairs(pop) do
    if m.score > champion.score then champion = m end
  end

  return {
    obj = obj, constraints = constraints,
    pop_size = pop_size, generations = generations, hc_depth = hc_depth,
    elitism = elitism, crossover_rate = crossover_rate, tournament_size = tournament_size,
    point_budget = point_budget, base_xml = base_xml, stats_keys = stats_keys,
    initial_member = initial_member, pop = pop, champion = champion,
    trajectory = {}, total_evals = pop_size - 1, gen = 0, t0 = os.time(), finished = false,
  }
end

-- run exactly one generation, mutating state. returns the trajectory entry.
function ga.evolve_one(state)
  state.gen = state.gen + 1
  local gen = state.gen
  local pop = state.pop
  table.sort(pop, function(a, b) return a.score > b.score end)
  local new_pop = {}
  for i = 1, state.elitism do new_pop[#new_pop+1] = pop[i] end

  while #new_pop < state.pop_size do
    local p1 = ga.tournament_pick(pop, state.tournament_size)
    local p2 = ga.tournament_pick(pop, state.tournament_size)
    local child
    if math.random() < state.crossover_rate then
      child = ga.crossover(p1, p2, state.point_budget, state.stats_keys, state.obj, state.constraints, state.base_xml)
      state.total_evals = state.total_evals + 1
    else
      pcall(loadBuildFromXML, p1.xml)
      search.rebuild()
      child = capture_member(state.stats_keys, state.obj, state.constraints)
      state.total_evals = state.total_evals + 1
    end
    child = ga.mutate(child, state.stats_keys, state.obj, state.constraints)
    state.total_evals = state.total_evals + 1
    child = ga.hill_climb(child, state.hc_depth, state.stats_keys, state.obj, state.constraints)
    state.total_evals = state.total_evals + state.hc_depth
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
