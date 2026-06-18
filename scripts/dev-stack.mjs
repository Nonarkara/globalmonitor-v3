import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const loadEnvFile = (filename) => {
    const filePath = path.join(ROOT_DIR, filename);
    if (!fs.existsSync(filePath)) return;
    for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq < 0) continue;
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
    }
};

loadEnvFile('.env.local');
loadEnvFile('.env');

const children = [];

const start = (label, command, args) => {
    const child = spawn(command, args, {
        stdio: 'inherit',
        shell: false,
        env: process.env
    });

    child.on('exit', (code) => {
        if (code !== 0) {
            console.error(`${label} exited with code ${code}`);
        }
        process.exitCode = process.exitCode || code || 0;
    });

    children.push(child);
};

const shutdown = () => {
    children.forEach((child) => {
        if (!child.killed) {
            child.kill('SIGTERM');
        }
    });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start('api', process.execPath, ['server/index.mjs']);
start('web', process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev']);
