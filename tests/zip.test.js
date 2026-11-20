import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { crc32, createZip } from '../src/zip.js';

test('crc32 matches the reference check value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  assert.equal(crc32(new Uint8Array()), 0);
});

test('createZip writes a valid STORE archive', () => {
  const files = [
    { name: 'a.png', data: new Uint8Array([1, 2, 3, 4]) },
    { name: 'b.png', data: new TextEncoder().encode('hello world') },
  ];
  const zip = createZip(files);
  const view = new DataView(zip.buffer);

  assert.equal(view.getUint32(0, true), 0x04034b50, 'local header signature');
  const eocd = zip.length - 22;
  assert.equal(view.getUint32(eocd, true), 0x06054b50, 'end of central directory');
  assert.equal(view.getUint16(eocd + 10, true), 2, 'entry count');

  // Walk the central directory and check the stored data.
  let p = view.getUint32(eocd + 16, true);
  for (const f of files) {
    assert.equal(view.getUint32(p, true), 0x02014b50);
    const size = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const localOff = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nameLen));
    assert.equal(name, f.name);
    assert.equal(size, f.data.length);
    const dataStart = localOff + 30 + view.getUint16(localOff + 26, true);
    assert.deepEqual(zip.subarray(dataStart, dataStart + size), f.data);
    assert.equal(view.getUint32(p + 16, true), crc32(f.data));
    p += 46 + nameLen;
  }
});

test('archive passes `unzip -t` when unzip is available', (t) => {
  try {
    execFileSync('unzip', ['-v'], { stdio: 'ignore' });
  } catch {
    t.skip('unzip not installed');
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), 'zip-test-'));
  try {
    const path = join(dir, 'out.zip');
    writeFileSync(path, createZip([{ name: 'photo-1.png', data: new Uint8Array(1000).fill(7) }]));
    const out = execFileSync('unzip', ['-t', path]).toString();
    assert.match(out, /No errors detected/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
