#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontend = path.join(root, 'frontend');
const bundle = path.join(root, 'bundle');
const buildOutput = path.join(frontend, 'dist', 'snip-frontend', 'browser');
const shouldPush = process.argv.slice(2).includes('--push');
const unknownArgs = process.argv.slice(2).filter((arg) => arg !== '--push');

if (unknownArgs.length > 0) {
  throw new Error(`Unknown argument(s): ${unknownArgs.join(', ')}`);
}

function run(command, args, cwd) {
  const executable = process.platform === 'win32' ? `${command}.cmd` : command;
  const result = spawnSync(executable, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function git(args, cwd = root) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  }
  return result.stdout.trim();
}

if (git(['rev-parse', '--show-toplevel']) !== root) {
  throw new Error('Run this script from the main superproject checkout.');
}
if (git(['branch', '--show-current']) !== 'main') {
  throw new Error('The superproject must be on the main branch.');
}
if (git(['diff', '--cached', '--name-only'], root)) {
  throw new Error('Commit or unstage existing superproject index changes before building.');
}

run('git', ['submodule', 'update', '--init', '--remote', 'backend', 'frontend', 'cli'], root);

const bundleChanges = git(['status', '--porcelain', '--untracked-files=all'], bundle);
if (bundleChanges) {
  throw new Error('The bundle checkout has local changes; preserve or commit them before rebuilding.');
}

run('npm', ['install'], frontend);
run('npx', ['ng', 'build'], frontend);

const builtIndex = path.join(buildOutput, 'index.html');
if (!existsSync(builtIndex)) {
  throw new Error(`Angular build output is missing ${builtIndex}`);
}

rmSync(path.join(bundle, 'public'), { recursive: true, force: true });
mkdirSync(bundle, { recursive: true });
cpSync(path.join(root, 'backend', 'server.js'), path.join(bundle, 'server.js'));
cpSync(path.join(root, 'cli', 'cli.js'), path.join(bundle, 'cli.js'));
cpSync(buildOutput, path.join(bundle, 'public'), { recursive: true });
writeFileSync(path.join(bundle, '.env'), 'PUBLIC_DIR=./public\n');
writeFileSync(
  path.join(bundle, 'package.json'),
  `${JSON.stringify({ name: 'snip-bundle', private: true, scripts: { start: 'bun server.js' } }, null, 2)}\n`,
);
writeFileSync(
  path.join(bundle, 'Dockerfile'),
  'FROM oven/bun:1-alpine\nCOPY . .\nENV PORT=3000\nEXPOSE 3000\nCMD ["bun", "server.js"]\n',
);
writeFileSync(
  path.join(bundle, '.dockerignore'),
  '.git\n.gitignore\n.gitmodules\nnode_modules\nnpm-debug.log\n',
);
writeFileSync(
  path.join(bundle, 'railway.json'),
  `${JSON.stringify({ '$schema': 'https://railway.com/railway.schema.json', build: { builder: 'DOCKERFILE', dockerfilePath: 'Dockerfile' } }, null, 2)}\n`,
);

git(['add', '--', '.env', '.dockerignore', 'Dockerfile', 'README.md', 'cli.js', 'package.json', 'public', 'railway.json', 'server.js'], bundle);
if (!git(['diff', '--cached', '--name-only'], bundle)) {
  console.log('Bundle unchanged.');
} else {
  run('git', ['commit', '-m', 'Build generated Snip bundle', '-m', 'Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>', '-m', 'Co-authored-by: OpenBot <335604065+openbotgit[bot]@users.noreply.github.com>'], bundle);
}

git(['add', '--', 'backend', 'frontend', 'cli', 'bundle'], root);
if (!git(['diff', '--cached', '--name-only'], root)) {
  console.log('Superproject pointers unchanged.');
} else {
  run('git', ['commit', '-m', 'Bump generated bundle and component pointers', '-m', 'Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>', '-m', 'Co-authored-by: OpenBot <335604065+openbotgit[bot]@users.noreply.github.com>'], root);
}

if (shouldPush) {
  run('git', ['push', 'origin', 'HEAD:bundle'], bundle);
  run('git', ['push', 'origin', 'main'], root);
} else {
  console.log('Not pushing. Re-run with --push to publish bundle and main.');
}
