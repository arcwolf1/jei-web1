import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const submoduleRoot = path.join(repoRoot, 'submodules', 'FreskyZ-flow-vue');
const requiredFile = path.join(submoduleRoot, 'src', 'FreskyLineFlowView.vue');
const submodulePath = path.relative(repoRoot, submoduleRoot).replace(/\\/g, '/');

function isRegisteredSubmodule() {
  const tracked = spawnSync(
    'git',
    ['ls-files', '--stage', '--', submodulePath],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: process.platform === 'win32',
    },
  );

  if (tracked.status !== 0) return false;
  const output = (tracked.stdout ?? '').trim();
  return output.length > 0;
}

if (process.env.SKIP_SUBMODULE_SYNC === '1') {
  console.log('[submodule] SKIP_SUBMODULE_SYNC=1, skip sync');
  process.exit(0);
}

if (!existsSync(path.join(repoRoot, '.git'))) {
  if (existsSync(requiredFile)) {
    console.log('[submodule] no git metadata, using existing submodule files');
    process.exit(0);
  }
  console.error('[submodule] .git not found and required renderer files are missing');
  process.exit(1);
}

if (!isRegisteredSubmodule()) {
  if (existsSync(requiredFile)) {
    console.warn(
      `[submodule] ${submodulePath} is not registered in current git index, using existing files`,
    );
    process.exit(0);
  }
  console.error(
    `[submodule] ${submodulePath} is not registered in current git index and required files are missing`,
  );
  process.exit(1);
}

const git = spawnSync(
  'git',
  ['submodule', 'update', '--init', '--recursive', '--', submodulePath],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

if (git.status !== 0) {
  // Common case: local changes in submodule would be overwritten by checkout.
  const dirty = spawnSync(
    'git',
    ['status', '--porcelain'],
    {
      cwd: submoduleRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: process.platform === 'win32',
    },
  );

  if ((dirty.stdout ?? '').trim()) {
    if (!existsSync(requiredFile)) {
      console.error('[submodule] submodule has local changes and required renderer file is missing');
      process.exit(git.status ?? 1);
    }
    console.warn(
      `[submodule] ${submodulePath} has local changes, skip checkout to avoid overwriting.\n` +
        `[submodule] If you need to sync to recorded commit, commit/stash first: git -C ${submodulePath} status`,
    );
    process.exit(0);
  }

  process.exit(git.status ?? 1);
}

if (!existsSync(requiredFile)) {
  console.error(`[submodule] missing required file after sync: ${path.relative(repoRoot, requiredFile)}`);
  process.exit(1);
}

console.log('[submodule] synced FreskyZ-flow-vue');
