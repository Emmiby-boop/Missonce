/* Minimal integration test for adUnitId catalog using CloudBase CLI.
   Requires: logged-in CloudBase CLI and correct env id. */
const { spawnSync } = require('child_process');
const path = require('path');

const ENV = 'missonce-99-1gfaff6n002f6ac1';

function invoke(payload) {
  const cli = path.join(__dirname, '..', 'node_modules', '.bin', process.platform === 'win32' ? 'tcb.cmd' : 'tcb');
  const args = ['functions:invoke', 'adConfigManager', '-e', ENV, '-d', JSON.stringify(payload)];
  const r = spawnSync(cli, args, { encoding: 'utf-8' });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    console.error(r.stdout);
    console.error(r.stderr);
    throw new Error('Invoke failed');
  }
  const out = (r.stdout || '').trim();
  console.log(out);
  return out;
}

console.log('== List before ==');
invoke({ action: 'adUnit:list' });

console.log('== Add temp unit ==');
const name = '测试单元';
const adUnitId = 'adunit-1234567890abcdef';
invoke({ action: 'adUnit:add', name, adUnitId, type: 'native_top', notes: '自动化测试' });

console.log('== List after add ==');
invoke({ action: 'adUnit:list' });

console.log('== Backup ==');
invoke({ action: 'adUnit:backup' });

console.log('== Done ==');
