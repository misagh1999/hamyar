import { spawn } from 'node:child_process';
import process from 'node:process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const children = [];

function startChild(command, args, label) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (signal || code !== 0) {
      console.log(`[${label}] exited with ${signal ?? code}`);
      shutdown(signal ?? code ?? 0);
    }
  });

  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

startChild(npmCommand, ['exec', 'vite', '--', '--host', '0.0.0.0'], 'vite');
startChild(process.execPath, ['server/eitaa-monitor.mjs'], 'eitaa-monitor');
