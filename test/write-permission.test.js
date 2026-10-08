import test from 'node:test'
import assert from 'node:assert/strict'
import { writePermissionDecision } from '../lib/write-permission.js'

const sql = "UPDATE items SET name='ok' WHERE id=1"

test('full-access preset auto-allows without requesting approval', () => {
  assert.deepEqual(writePermissionDecision('danger-full-access', {
    sandbox: 'danger-full-access', approval: 'never',
  }, 'local', sql), { kind: 'allow' })
})

test('workspace preset requests the native approval channel', () => {
  const result = writePermissionDecision('workspace-write', {
    sandbox: 'workspace-write', approval: 'ask',
  }, 'local', sql)
  assert.equal(result.kind, 'ask')
  assert.match(result.reason, /local.*UPDATE items/)
})

test('read-only and unknown combinations fail closed', () => {
  const cases = [
    ['read-only', { sandbox: 'read-only', approval: 'ask' }],
    ['custom', null],
    ['workspace-write', { sandbox: 'workspace-write', approval: 'never' }],
  ]
  for (const [preset, spec] of cases) {
    assert.equal(writePermissionDecision(preset, spec, 'local', sql).kind, 'deny')
  }
})

test('a configured ask preset asks even with full file access', () => {
  assert.equal(writePermissionDecision('full-with-approval', {
    sandbox: 'danger-full-access', approval: 'ask',
  }, 'local', sql).kind, 'ask')
})
