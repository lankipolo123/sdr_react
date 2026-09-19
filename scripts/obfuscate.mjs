// Post-build code hiding step - obfuscates the app's own bundled JS
// (out/main, out/preload, out/renderer) in place, same spirit as the C
// rewrite's tools/obfuscate.py: not a security boundary (a determined
// reverse-engineer can always deobfuscate JS), just raises the bar past
// "open devtools and read readable source".
//
// Runs after electron-vite build, before electron-builder packs out/**/*
// (see package.json's build/build:win scripts) - obfuscates the actual
// files electron-builder ships, not a separate copy.
//
// Settings deliberately avoid the more aggressive javascript-obfuscator
// options: selfDefending and debugProtection are known to cause hangs/
// crashes in real Electron apps (debugProtection's anti-devtools loop in
// particular can lock up the main process), and renameGlobals risks
// clobbering Electron/Node globals (process, require, module) rather
// than just this app's own identifiers. controlFlowFlattening/
// deadCodeInjection are capped via their *Threshold options to keep
// bundle size and startup time reasonable - this is a ~400KB renderer
// bundle running on every launch, not a one-off script.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import JavaScriptObfuscator from 'javascript-obfuscator'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'out')

const baseOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: false,
  debugProtection: false,
  disableConsoleOutput: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.8,
  splitStrings: true,
  splitStringsChunkLength: 8
}

function findJsFiles(dir) {
  const results = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      results.push(...findJsFiles(full))
    } else if (entry.endsWith('.js') || entry.endsWith('.mjs')) {
      results.push(full)
    }
  }
  return results
}

function obfuscateFile(path, target) {
  const source = readFileSync(path, 'utf-8')
  const result = JavaScriptObfuscator.obfuscate(source, { ...baseOptions, target }).getObfuscatedCode()
  writeFileSync(path, result, 'utf-8')
  console.log(`obfuscated (${target}): ${path.replace(outDir, 'out')}`)
}

for (const file of findJsFiles(join(outDir, 'main'))) obfuscateFile(file, 'node')
for (const file of findJsFiles(join(outDir, 'preload'))) obfuscateFile(file, 'node')
for (const file of findJsFiles(join(outDir, 'renderer'))) obfuscateFile(file, 'browser')

console.log('Code hiding pass complete.')
