// cli for the update_pob2 mcp tool. pulls the latest pob2 tip from github.
// optional first arg is the branch (default dev). always pulls -- the 7-day
// staleness gate in cloneOrPull is for the server's auto path, not an explicit
// human update, so the cli bypasses it.
import { cloneOrPull, getHead } from '../src/pob-manager.js'

const branch = process.argv.slice(2).find((a) => !a.startsWith('-'))

let before = ''
try {
  before = await getHead()
} catch {
  // not cloned yet
}

const result = await cloneOrPull(branch, true)
const effective = branch ?? process.env.POB2_BRANCH ?? 'dev'
console.log(`pob2 ${result.action} -> ${result.head}  (branch ${effective})`)
if (result.head !== before) {
  console.log('restart a running server (or call the update_pob2 tool) to load the new code')
}
