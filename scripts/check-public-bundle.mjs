import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const dist = process.argv[2] || 'dist';
const assets = (await readdir(path.join(dist, 'assets'))).filter(name => name.endsWith('.js'));
assert.ok(assets.length, 'build assets are missing');
const forbidden = /FOR OFFICIAL USE ONLY|CONTROLLED UNCLASSIFIED INFORMATION/i;
for (const name of ['index.html', ...assets.map(name => path.join('assets', name))]) {
    assert.doesNotMatch(await readFile(path.join(dist, name), 'utf8'), forbidden, name);
}
console.log(`No official-use marking in ${assets.length} compiled JS files or the HTML entry`);
