-- smoke test: gem-search.lua loads and its pure helpers behave. PoB-dependent paths
-- (enumeration, recalc) are verified live, not here.
package.path = package.path .. ";./lua/?.lua"
-- require() guards parse for the whole module, so later appended functions (set_supports,
-- score, greedy, polish, run) are syntax-checked here even without explicit asserts.
local gem = require("gem-search")
assert(type(gem.active_skill) == "function", "active_skill missing")
assert(type(gem.valid_supports) == "function", "valid_supports missing")
assert(type(gem.feasible) == "function", "feasible missing")
-- feasible(): idealized mode ignores attribute reqs
local g = { reqStr = 999, reqDex = 999, reqInt = 999 }
assert(gem.feasible(g, { idealized = true, str = 0, dex = 0, int = 0 }) == true, "idealized should ignore attr reqs")
assert(gem.feasible(g, { idealized = false, str = 0, dex = 0, int = 0 }) == false, "as-imported should reject unmet reqs")
print("GEM TOY TEST OK")
