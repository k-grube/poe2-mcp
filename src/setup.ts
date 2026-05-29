import { execFile as execFileCb } from 'node:child_process'
import { platform } from 'node:os'
import { promisify } from 'node:util'
import { cloneOrPull, verifyPob2 } from './pob-manager.js'

const execFile = promisify(execFileCb)

const LUAJIT_INSTALL: Record<string, string> = {
  darwin: 'brew install luajit',
  win32: 'winget install DEVCOM.LuaJIT',
  linux: 'sudo apt install luajit  (or: sudo pacman -S luajit)',
}

async function checkBin(name: string): Promise<boolean> {
  try {
    const cmd = platform() === 'win32' ? 'where' : 'which'
    await execFile(cmd, [name])
    return true
  } catch {
    return false
  }
}

async function main() {
  let ok = true

  const hasGit = await checkBin('git')
  if (hasGit) {
    console.log('✓ git found')
  } else {
    console.error('✗ git not found: install from https://git-scm.com/downloads')
    ok = false
  }

  const luajitBin = platform() === 'win32' ? 'luajit.exe' : 'luajit'
  const hasLuajit = await checkBin(luajitBin)
  if (hasLuajit) {
    console.log('✓ luajit found')
  } else {
    const hint = LUAJIT_INSTALL[platform()] ?? 'install luajit for your platform'
    console.error(`✗ luajit not found, run: ${hint}`)
    ok = false
  }

  if (!ok) {
    console.error('\nFix the above, then re-run: npm run setup')
    process.exit(1)
  }

  console.log('\nChecking PathOfBuilding-PoE2…')
  try {
    const result = await cloneOrPull()
    console.log(`✓ pob2 ${result.action} @ ${result.head}`)
  } catch (err) {
    console.error('✗ pob2 clone/pull failed:', err instanceof Error ? err.message : err)
    process.exit(1)
  }

  try {
    await verifyPob2()
    console.log('✓ HeadlessWrapper.lua present')
  } catch (err) {
    console.error('✗', err instanceof Error ? err.message : err)
    process.exit(1)
  }

  console.log('\nSetup complete. Run: npm run dev')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
