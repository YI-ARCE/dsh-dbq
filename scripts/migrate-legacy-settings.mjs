import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'

import { isDeepStrictEqual } from 'node:util'

// Usage: node migrate-legacy-settings.mjs <dsh-package.json> <settings.yaml.imported> <profile-cordis.patch.yml> [--apply|--verify]
const [dshManifest, legacyPath, profilePath, mode] = process.argv.slice(2)
if (!dshManifest || !legacyPath || !profilePath || (mode && mode !== '--apply' && mode !== '--verify')) {
  throw new Error('usage: node migrate-legacy-settings.mjs <dsh-package.json> <settings.yaml.imported> <profile-cordis.patch.yml> [--apply|--verify]')
}
const yaml = createRequire(resolve(dshManifest))('js-yaml')
const old = yaml.load(readFileSync(legacyPath, 'utf8'))
const source = readFileSync(profilePath, 'utf8')
const mappings = [
  ['dsh-dbq', 'tool-dbq'],
  ['dsh-rainy-brand', 'ui-brand-rainy'],
]
let next = source
for (const [legacyId, entryId] of mappings) {
  const config = old?.[legacyId]
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`missing or invalid legacy section ${legacyId}`)
  }
  if (mode === '--verify') {
    const start = source.indexOf(`- id: ${entryId}\n`)
    if (start < 0 || source.indexOf(`- id: ${entryId}\n`, start + 1) !== -1) {
      throw new Error(`expected exactly one override: ${entryId}`)
    }
    const end = source.indexOf('\n- id:', start + 1)
    const entry = yaml.load(source.slice(start, end < 0 ? undefined : end))[0]
    if (!entry || !isDeepStrictEqual(entry.config, config)) {
      throw new Error(`migrated configuration differs from backup: ${entryId}`)
    }
    console.log(`${entryId}: restored settings match backup`)
    continue
  }
  // Each matching override currently consists only of the id and disabled flag.
  const marker = `- id: ${entryId}\n  disabled: true`
  if (next.split(marker).length !== 2) throw new Error(`expected exactly one disabled override: ${entryId}`)
  const after = next.split(marker)[1]
  if (after.startsWith('\n  config:') || after.startsWith('\r\n  config:')) {
    throw new Error(`refusing to replace existing config: ${entryId}`)
  }
  const configText = yaml.dump(config, { lineWidth: -1, noRefs: true }).trimEnd()
  next = next.replace(marker, marker + '\n  config:\n' + configText.split('\n').map((line) => '    ' + line).join('\n'))
  console.log(`${legacyId} -> ${entryId}: ${Object.keys(config).length} top-level fields`)
}
if (!mode) {
  console.log('Dry run only; use --apply after reviewing the target overrides.')
} else {
  const backup = join(dirname(profilePath), `cordis.patch.yml.before-dbq-brand-migration`)
  const temp = `${profilePath}.migrating`
  if (existsSync(backup)) throw new Error(`backup already exists: ${backup}`)
  if (existsSync(temp)) throw new Error(`temporary file already exists: ${temp}`)
  copyFileSync(profilePath, backup)
  try {
    writeFileSync(temp, next, { encoding: 'utf8', flag: 'wx' })
    renameSync(temp, profilePath)
  } catch (error) {
    throw new Error(`profile patch not updated; original backed up at ${backup}`, { cause: error })
  }
  console.log(`Updated profile patch; preserved original at ${backup}`)
}
