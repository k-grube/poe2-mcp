import { execFile as execFileCb } from 'node:child_process';
import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function execFile(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFileCb(cmd, args, (err, stdout, stderr) => {
      if (err) { reject(err); return; }
      resolve({ stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const POB2_REPO = 'https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2';
const STALE_DAYS = 7;

export function getPob2Dir(): string {
  return path.join(PROJECT_ROOT, 'pob2');
}

export function getPob2SrcDir(): string {
  return path.join(getPob2Dir(), 'src');
}

export async function verifyPob2(): Promise<void> {
  const wrapper = path.join(getPob2SrcDir(), 'HeadlessWrapper.lua');
  try {
    await access(wrapper);
  } catch {
    throw new Error(
      `HeadlessWrapper.lua not found at ${wrapper}.\n` +
      `Run \`npm run setup\` to clone PathOfBuilding-PoE2.`
    );
  }
}

export async function needsPull(): Promise<boolean> {
  try {
    const { stdout } = await execFile('git', [
      '-C', getPob2Dir(),
      'log', '-1', '--format=%cI',
    ]);
    const lastCommit = new Date(stdout.trim());
    const ageMs = Date.now() - lastCommit.getTime();
    return ageMs > STALE_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return true;
  }
}

export async function cloneOrPull(branch = process.env.POB2_BRANCH ?? 'dev'): Promise<{ action: 'cloned' | 'pulled' | 'skipped'; head: string }> {
  const dir = getPob2Dir();

  let exists = false;
  try {
    await access(path.join(dir, '.git'));
    exists = true;
  } catch {
    // not cloned yet
  }

  if (!exists) {
    await mkdir(dir, { recursive: true });
    await execFile('git', ['clone', '--branch', branch, '--depth', '1', POB2_REPO, dir]);
    const { stdout } = await execFile('git', ['-C', dir, 'rev-parse', '--short', 'HEAD']);
    return { action: 'cloned', head: stdout.trim() };
  }

  const stale = await needsPull();
  if (!stale) {
    const { stdout } = await execFile('git', ['-C', dir, 'rev-parse', '--short', 'HEAD']);
    return { action: 'skipped', head: stdout.trim() };
  }

  await execFile('git', ['-C', dir, 'pull']);
  const { stdout: newHead } = await execFile('git', ['-C', dir, 'rev-parse', '--short', 'HEAD']);
  return { action: 'pulled', head: newHead.trim() };
}

export async function getHead(): Promise<string> {
  const { stdout } = await execFile('git', ['-C', getPob2Dir(), 'rev-parse', '--short', 'HEAD']);
  return stdout.trim();
}
