/**
 * dsh-dbq 宿主半 —— 数据库连接查询（永久插件）
 *
 * 职责：
 *  1. 声明 tool-dbq 插件 Config（连接清单 + 默认限额），通过 profile 配置表单原生读写；
 *  2. 注册 4 个模型工具：db_connections / db_tables / db_describe / db_query；
 *  3. 通过 Go 网关 dbq.exe（默认 $DSH_HOME/dbq/dbq.exe，设置页可自定义）执行查询，
 *     配置经 stdin 传入；网关二进制经发布页 Releases 分发，仅支持 Windows；
 *  4. 密码来源：inline（profile patch 明文，本地单用户可接受）| env（网关进程环境变量）
 *     | credential（DSH 凭据服务，ref 默认 dbq/<连接id>）。
 *
 * 安全模型在网关侧强制：语句白名单（SELECT/WITH/SHOW/EXPLAIN/DESC）、禁止多语句、
 * 会话级只读、超时、行数/单元格/结果字节限额、连接级 denyTables。
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir, platform } from 'node:os'
import { fileURLToPath } from 'node:url'
import z from '@deepseek-ai/schemastery'

export const SETTINGS_NS = 'tool-dbq'

const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')
const DBQ_HOME = join(DSH_HOME, 'dbq')
const DBQ_EXE = join(DBQ_HOME, 'dbq.exe')

/** 随插件内置的网关副本（vendor/dbq.exe，npm / git 安装均自带）。解析失败时置空，仅回退默认位置。 */
let VENDORED_EXE = ''
try { VENDORED_EXE = fileURLToPath(new URL('../vendor/dbq.exe', import.meta.url)) } catch (e) { VENDORED_EXE = '' }

/** 网关缺失时的安装指引（工具错误与 /dbq-api/status 共用）。 */
const GATEWAY_HINT = '安装：网关 dbq.exe 已随插件内置（vendor/）。若内置副本缺失，从插件仓库下载 dbq.exe 放入 ' + DBQ_HOME + ' ，或在 设置 → 数据库连接 → 网关 中填写 dbq.exe 完整路径。'

const DEFAULT_LIMITS = { maxRows: 200, timeoutMs: 8000, cellChars: 2000, resultBytes: 262144 }

/** Editable live fields of the tool-dbq plugin entry. */
export const Config = z.object({
  defaults: z.object({
    maxRows: z.number().default(DEFAULT_LIMITS.maxRows),
    timeoutMs: z.number().default(DEFAULT_LIMITS.timeoutMs),
    cellChars: z.number().default(DEFAULT_LIMITS.cellChars),
    resultBytes: z.number().default(DEFAULT_LIMITS.resultBytes),
  }).default({}).volatile(),
  dbqPath: z.string().default('').volatile(),
  connections: z.array(z.object({
    id: z.string(),
    label: z.string().default(''),
    type: z.string().default('mysql'),
    host: z.string().default(''),
    port: z.number().default(0),
    database: z.string().default(''),
    user: z.string().default(''),
    passwordSource: z.string().default('inline'),
    passwordValue: z.string().default(''),
    passwordEnv: z.string().default(''),
    passwordRef: z.string().default(''),
    readOnly: z.boolean().default(true),
    enabled: z.boolean().default(true),
    maxRows: z.number().default(0),
    timeoutMs: z.number().default(0),
    denyTables: z.array(z.string()).default([]),
    allowSchemas: z.array(z.string()).default([]),
    note: z.string().default(''),
  })).default([]).volatile(),
})

function readConfig(config) {
  return normalizeConfig({
    defaults: config.defaults.get(),
    dbqPath: config.dbqPath.get(),
    connections: config.connections.get(),
  })
}

/** 凭据服务（可选）：ctx.inject(['credentials']) 捕获，用于 credential 来源密码。 */
let credentialsSvc = null

/** 把设置文档里的 section 规整为可信结构（防御畸形数据）。 */
function normalizeConfig(raw) {
  const src = raw !== null && typeof raw === 'object' ? raw : {}
  const d = src.defaults !== null && typeof src.defaults === 'object' ? src.defaults : {}
  const num = (v, def) => {
    const n = Math.floor(Number(v))
    return n === n && n > 0 ? n : def
  }
  const list = Array.isArray(src.connections) ? src.connections : []
  return {
    defaults: {
      maxRows: num(d.maxRows, DEFAULT_LIMITS.maxRows),
      timeoutMs: num(d.timeoutMs, DEFAULT_LIMITS.timeoutMs),
      cellChars: num(d.cellChars, DEFAULT_LIMITS.cellChars),
      resultBytes: num(d.resultBytes, DEFAULT_LIMITS.resultBytes),
    },
    dbqPath: typeof src.dbqPath === 'string' ? src.dbqPath.trim() : '',
    connections: list.filter((c) => c !== null && typeof c === 'object' && typeof c.id === 'string' && c.id !== ''),
  }
}

/**
 * 解析网关可执行文件：设置项 dbqPath → 插件内置 vendor/dbq.exe → 默认
 * $DSH_HOME/dbq/dbq.exe。显式设置的路径不存在时报错（不静默回退）。仅支持 Windows。
 */
function resolveGateway(cfg) {
  if (platform() !== 'win32') {
    return { ok: false, path: null, source: null, candidates: [], error: 'dsh-dbq 目前仅支持 Windows（网关为 dbq.exe）。' }
  }
  const custom = cfg.dbqPath || ''
  if (custom !== '') {
    const exists = existsSync(custom)
    return {
      ok: exists,
      path: custom,
      source: 'settings',
      candidates: [{ source: 'settings', path: custom, exists }],
      error: exists ? null : '设置的网关路径不存在: ' + custom + '。清空「网关路径」设置可回退插件内置副本。',
    }
  }
  const candidates = VENDORED_EXE !== ''
    ? [
        { source: 'vendored', path: VENDORED_EXE, exists: existsSync(VENDORED_EXE) },
        { source: 'default', path: DBQ_EXE, exists: existsSync(DBQ_EXE) },
      ]
    : [{ source: 'default', path: DBQ_EXE, exists: existsSync(DBQ_EXE) }]
  const hit = candidates.find((c) => c.exists)
  return { ok: hit !== undefined, path: hit !== undefined ? hit.path : DBQ_EXE, source: hit !== undefined ? hit.source : 'default', candidates, error: null }
}

/** 设置 section -> Go 网关 Config JSON（密码字段折叠成 password 对象）。 */
function toGatewayConfig(cfg) {
  return {
    version: 1,
    defaults: cfg.defaults,
    connections: cfg.connections.map((c) => ({
      id: c.id,
      label: c.label || '',
      type: c.type,
      host: c.host || '',
      port: c.port || 0,
      database: c.database || '',
      user: c.user || '',
      password:
        c.passwordSource === 'env' && c.passwordEnv ? { source: 'env', name: c.passwordEnv } :
        c.passwordSource === 'credential' ? { source: 'credential', ref: c.passwordRef || ('dbq/' + c.id) } :
        { source: 'inline', value: c.passwordValue || '' },
      readOnly: c.readOnly !== false,
      maxRows: c.maxRows || 0,
      timeoutMs: c.timeoutMs || 0,
      denyTables: Array.isArray(c.denyTables) ? c.denyTables : [],
      allowSchemas: Array.isArray(c.allowSchemas) ? c.allowSchemas : [],
      enabled: c.enabled !== false,
      note: c.note || '',
    })),
  }
}

/** credential 来源：经凭据服务解析，注入 DBQ_PASSWORD_<ID> 环境变量。 */
async function passwordEnvFor(cfg, id) {
  let conn = null
  for (const c of cfg.connections) {
    if (c.id === id) { conn = c; break }
  }
  if (conn === null) throw new Error('连接 "' + id + '" 不存在（见 设置 → 数据库连接 或 db_connections）')
  if (conn.enabled === false) throw new Error('连接 "' + id + '" 已禁用，请在设置页启用')
  if (conn.passwordSource !== 'credential') return null
  const ref = conn.passwordRef || ('dbq/' + conn.id)
  if (credentialsSvc === null) throw new Error('凭据服务不可用，无法解析 credential 来源密码（' + ref + '）')
  let resolved = null
  try { resolved = await credentialsSvc.resolve(ref) } catch (e) { resolved = null }
  if (resolved === null || typeof resolved.value !== 'string' || resolved.value === '') {
    throw new Error('凭据 "' + ref + '" 未设置：请改用 inline/env 来源，或在 DSH 凭据管理中设置 ' + ref)
  }
  const env = {}
  env['DBQ_PASSWORD_' + String(conn.id).toUpperCase().replace(/[^A-Z0-9_]/g, '_')] = resolved.value
  return env
}

/** 调用网关：stdout 恒为 JSON 信封 {"ok","data","error","hint"}。 */
function callDbq(exePath, args, cfg, env) {
  return new Promise((resolve) => {
    let settled = false
    let timer = null
    const done = (v) => {
      if (settled) return
      settled = true
      if (timer !== null) clearTimeout(timer)
      resolve(v)
    }
    let child
    try {
      child = spawn(exePath, args, {
        cwd: dirname(exePath),
        env: env ? Object.assign({}, process.env, env) : process.env,
        windowsHide: true,
      })
    } catch (e) {
      done({ ok: false, error: 'dbq 启动失败: ' + (e && e.message) })
      return
    }
    let out = ''
    let errb = ''
    child.stdout.on('data', (d) => { out += d })
    child.stderr.on('data', (d) => { errb += d })
    child.on('error', (e) => {
      done({ ok: false, error: 'dbq 启动失败（' + exePath + '）: ' + (e && e.message) })
    })
    child.on('close', () => {
      try {
        done(JSON.parse(out))
      } catch (e) {
        done({ ok: false, error: 'dbq 输出无法解析: ' + String(out || errb).slice(0, 300) })
      }
    })
    timer = setTimeout(() => {
      try { child.kill('SIGKILL') } catch (e) { /* ignore */ }
      done({ ok: false, error: 'dbq 调用超时（65s，已终止）' })
    }, 65000)
    try { child.stdin.end(cfg !== null && cfg !== undefined ? JSON.stringify(cfg) : '') } catch (e) { /* ignore */ }
  })
}

/** 探测网关可执行性：空参运行，stdout 出现 JSON 信封即视为可用（dbq 任何入口都输出信封）。 */
function probeGateway(exePath) {
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(exePath, [], { cwd: dirname(exePath), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    } catch (e) {
      resolve(false)
      return
    }
    let out = ''
    let settled = false
    const finish = (v) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { child.kill() } catch (e) { /* already gone */ }
      resolve(v)
    }
    const timer = setTimeout(() => finish(false), 4000)
    child.stdout.on('data', (d) => { out += d })
    child.on('error', () => finish(false))
    child.on('close', () => {
      try {
        const v = JSON.parse(out)
        finish(v !== null && typeof v === 'object')
      } catch (e) {
        finish(false)
      }
    })
  })
}

/** 组合一次网关调用：读配置 -> 解析网关 -> 解析密码环境 -> spawn -> 校验信封。 */
async function callGateway(config, sub, id, subArgs) {
  const cfg = readConfig(config)
  const gw = resolveGateway(cfg)
  if (!gw.ok) {
    const where = gw.error ? gw.error : '未找到网关：插件内置副本与 ' + DBQ_EXE + ' 均不存在。'
    throw new Error(where + ' ' + GATEWAY_HINT)
  }
  const env = await passwordEnvFor(cfg, id)
  const args = [sub, '--stdin-config', '--conn', String(id)].concat(subArgs || [])
  const r = await callDbq(gw.path, args, toGatewayConfig(cfg), env)
  if (r === null || typeof r.ok !== 'boolean') throw new Error('dbq 输出无法解析')
  if (r.ok !== true) throw new Error('dbq: ' + (r.error || '未知错误'))
  return r.data
}

/** 手写 JSON Schema 参数（与动态版 wire 形态一致），外加必填串校验。 */
function makeTool(name, description, properties, required, run, timeoutMs) {
  return {
    name,
    description,
    parameters: { type: 'object', properties, required },
    output: {
      schema: { type: 'string' },
      render: (args, value) => [{ type: 'text', text: String(value) }],
    },
    timeoutMs: timeoutMs || 30000,
    execute: async (args) => {
      for (const key of required) {
        const v = args !== null && typeof args === 'object' ? args[key] : undefined
        if (typeof v !== 'string' || v === '') throw new Error('参数 ' + key + ' 必填（字符串）')
      }
      return run(args)
    },
  }
}

function registerTools(sctx, config) {
  const tools = sctx.tools

  tools.register(makeTool(
    'db_connections',
    '列出数据库插件已配置的连接（id/类型/主机/库/只读/启用），不含密码。用户消息中的 #db:连接[.schema].表 记号即引用某库某表（旧记号 @db: 同义）；回答中以 <连接id> + <schema>.<表名> 指称。',
    {},
    [],
    async () => {
      const cfg = readConfig(config)
      const gw = resolveGateway(cfg)
      const conns = cfg.connections.map((c) => ({
        id: c.id,
        label: c.label || '',
        type: c.type,
        host: c.host || '',
        port: c.port || 0,
        database: c.database || '',
        user: c.user || '',
        readOnly: c.readOnly !== false,
        enabled: c.enabled !== false,
        note: c.note || '',
      }))
      let enabled = 0
      for (const c of conns) { if (c.enabled) enabled++ }
      return JSON.stringify({
        gatewayReady: gw.ok,
        gatewayPath: gw.path,
        gatewaySource: gw.source,
        connections: conns,
        enabledCount: enabled,
        usage: 'db_tables 看表 -> db_describe 看结构 -> db_query 执行只读 SQL（仅 SELECT/WITH/SHOW/EXPLAIN，带行数与超时限额）',
      })
    },
    10000,
  ))

  tools.register(makeTool(
    'db_tables',
    '列出某数据库连接下的表/视图清单（类型、行数估算、注释）。',
    {
      connection: { type: 'string', description: '连接 id，来自 db_connections' },
      schema: { type: 'string', description: '可选，限定 schema（PG）或 database（MySQL）' },
      pattern: { type: 'string', description: '可选，表名 LIKE 模式，如 order%' },
    },
    ['connection'],
    async (args) => {
      const sub = []
      if (args.schema) sub.push('--schema', String(args.schema))
      if (args.pattern) sub.push('--pattern', String(args.pattern))
      const data = await callGateway(config, 'tables', args.connection, sub)
      return JSON.stringify(data)
    },
    20000,
  ))

  tools.register(makeTool(
    'db_describe',
    '查看某连接下某张表的列/类型/主键/索引/注释。写 SQL 前先调用本工具确认列名。',
    {
      connection: { type: 'string', description: '连接 id，来自 db_connections' },
      table: { type: 'string', description: '表名（不带 schema 前缀）' },
      schema: { type: 'string', description: '可选，schema/database 名' },
    },
    ['connection', 'table'],
    async (args) => {
      const sub = ['--table', String(args.table)]
      if (args.schema) sub.push('--schema', String(args.schema))
      const data = await callGateway(config, 'describe', args.connection, sub)
      return JSON.stringify(data)
    },
    20000,
  ))

  tools.register(makeTool(
    'db_query',
    '在指定连接上执行只读 SQL 查询（仅允许单条 SELECT/WITH/SHOW/EXPLAIN），返回列名+行数据（JSON），有行数/字节/超时限额，超限标记 truncated。禁止 INSERT/UPDATE/DELETE/DDL。',
    {
      connection: { type: 'string', description: '连接 id，来自 db_connections' },
      sql: { type: 'string', description: '单条只读 SQL' },
      maxRows: { type: 'number', description: '可选，覆盖最大返回行数' },
      timeoutMs: { type: 'number', description: '可选，覆盖超时毫秒' },
    },
    ['connection', 'sql'],
    async (args) => {
      const sub = ['--sql', String(args.sql)]
      if (args.maxRows) sub.push('--max-rows', String(Math.floor(Number(args.maxRows))))
      if (args.timeoutMs) sub.push('--timeout-ms', String(Math.floor(Number(args.timeoutMs))))
      const data = await callGateway(config, 'query', args.connection, sub)
      return JSON.stringify(data)
    },
    30000,
  ))
}

/**
 * 插件入口。工具与网关路由读取 Config 的实时引用；settings 仅用于关闭自动设置页，
 * credentials 是可选能力（只影响 credential 来源密码）；webServer 提供表清单和网关状态路由。
 */
export function apply(ctx, config) {
  ctx.inject(['settings'], (sctx) => {
    sctx.effect(() => sctx.settings.configure({ auto: false }, ctx.fiber))
  })
  ctx.inject(['tools'], (sctx) => {
    registerTools(sctx, config)
  })
  ctx.inject(['credentials'], (cctx) => {
    credentialsSvc = cctx.credentials
  })
  ctx.inject(['webServer'], (wctx) => {
    try {
      wctx.webServer.register({
        kind: 'prefix',
        path: '/dbq-api',
        handler: async (req, res) => {
          const sendJson = (code, obj) => {
            res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
            res.end(JSON.stringify(obj))
          }
          try {
            const url = new URL(req.url || '/', 'http://localhost')
            if (url.pathname === '/dbq-api/status') {
              const cfg = readConfig(config)
              const gw = resolveGateway(cfg)
              const alive = gw.ok === true ? await probeGateway(gw.path) : false
              sendJson(200, {
                ok: true,
                gateway: {
                  platform: platform(),
                  supported: platform() === 'win32',
                  home: DBQ_HOME,
                  vendoredPath: VENDORED_EXE,
                  defaultPath: DBQ_EXE,
                  configuredPath: cfg.dbqPath || '',
                  path: gw.path,
                  source: gw.source,
                  exists: gw.ok,
                  alive,
                  candidates: gw.candidates,
                  hint: gw.ok === true ? '' : ((gw.error || '') + ' ' + GATEWAY_HINT).trim(),
                },
              })
              return
            }
            if (url.pathname === '/dbq-api/tables') {
              const connection = url.searchParams.get('connection') || ''
              if (connection === '') {
                sendJson(200, { ok: false, error: '缺少 connection 参数' })
                return
              }
              const schema = url.searchParams.get('schema') || ''
              let pattern = url.searchParams.get('pattern') || ''
              if (pattern !== '' && !pattern.includes('%')) pattern += '%'
              const sub = []
              if (schema !== '') sub.push('--schema', schema)
              if (pattern !== '') sub.push('--pattern', pattern)
              const data = await callGateway(config, 'tables', connection, sub)
              sendJson(200, { ok: true, data })
            } else {
              sendJson(404, { ok: false, error: '未知路径 ' + url.pathname })
            }
          } catch (e) {
            sendJson(200, { ok: false, error: (e && e.message) || String(e) })
          }
        },
      })
    } catch (e) {
      // 重复注册（热重载）或 webServer 缺席——选择器退化为不可用，工具不受影响。
      console.error('dsh-dbq: web route register skipped:', e && e.message)
    }
  })
}
