// Tool-level policy for database writes. Connection authorization is checked separately.
export function writePermissionDecision(preset, spec, connection, sql) {
  if (!spec || preset === 'custom') {
    return { kind: 'deny', reason: '当前会话权限组合未匹配预设，数据库写入已拒绝' }
  }
  if (spec.sandbox === 'read-only') {
    return { kind: 'deny', reason: '当前会话为只读权限，禁止数据库写入' }
  }
  if (preset === 'danger-full-access' && spec.sandbox === 'danger-full-access' && spec.approval === 'never') {
    return { kind: 'allow' }
  }
  if (spec.approval === 'ask') {
    return { kind: 'ask', reason: '数据库写入 ' + connection + '：' + String(sql || '').slice(0, 1000) }
  }
  return { kind: 'deny', reason: '当前会话禁止审批且不属于完全权限，数据库写入已拒绝' }
}
