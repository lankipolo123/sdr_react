// Diagnostic script - NOT part of the app itself, run manually on Windows
// with the real DLL and hardware connected: `node scripts/diagnostic-incomplete-frame.mjs`
//
// Deliberately sends an INCOMPLETE frame - just the two HEAD bytes
// (0x7E, 0x7E), nothing else - to see how the real hardware reacts to a
// truncated/malformed transmission, since that's not something knowable
// from the DLL's own code alone (that's on the SDR's own firmware).
//
// A real, complete frame is HEAD(2) TYPE(1) ADDR(1) LEN(1) PAYLOAD(n)
// STOP(2) - this test stops after HEAD on purpose, sending only 2 of the
// ~8+ bytes a real command needs.
//
// Uses the DLL the normal way (CommandTokens -> SendCommandToSDR, same
// as the real app) - this does not touch or print the internal token
// table, it just runs the existing public API with a deliberately short
// input.

import koffi from 'koffi'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dllPath = join(__dirname, '..', 'dll', 'Transit_x64.dll')

console.log(`Loading: ${dllPath}`)
const lib = koffi.load(dllPath)

const AutoConnectSDR = lib.func('long AutoConnectSDR(char* buffer, long length)')
const DisconnectSDR = lib.func('long DisconnectSDR(char* buffer, long length)')
const CommandTokens = lib.func('long CommandTokens(char* input, char* output, long output_length)')
const SendCommandToSDR = lib.func('long SendCommandToSDR(char* command, long length)')

function readCString(buf) {
  const nul = buf.indexOf(0)
  return buf.toString('ascii', 0, nul === -1 ? buf.length : nul)
}

function tokenFor(byte) {
  const hex = byte.toString(16).toUpperCase().padStart(2, '0')
  const out = Buffer.alloc(256)
  CommandTokens(Buffer.from(hex + '\0', 'ascii'), out, out.length)
  const token = readCString(out)
  return token === '??' || token === '' ? hex : token
}

console.log('\n--- Step 1: Connect ---')
const connectBuf = Buffer.alloc(256)
const connectResult = AutoConnectSDR(connectBuf, connectBuf.length)
console.log(`AutoConnectSDR -> result=${connectResult} text="${readCString(connectBuf)}"`)
if (connectResult <= 0) {
  console.log('\nNot connected - plug in the hardware and re-run before continuing.')
  process.exit(1)
}

console.log('\n--- Step 2: Send ONLY the HEAD bytes (0x7E, 0x7E) - deliberately incomplete ---')
console.log('(A real frame also needs TYPE, ADDR, LEN, PAYLOAD, and STOP - none of that follows here.)')

const headBytes = [0x7e, 0x7e]
for (const byte of headBytes) {
  const sendText = tokenFor(byte)
  const result = SendCommandToSDR(Buffer.from(sendText + '\0', 'ascii'), sendText.length)
  console.log(`  sent byte 0x${byte.toString(16)} -> SendCommandToSDR returned: ${result}`)
}

console.log('\n--- Step 3: Wait 2 seconds, watch the hardware for any reaction ---')
await new Promise((resolve) => setTimeout(resolve, 2000))

console.log('\n--- Step 4: Disconnect ---')
const disconnectBuf = Buffer.alloc(256)
const disconnectResult = DisconnectSDR(disconnectBuf, disconnectBuf.length)
console.log(`DisconnectSDR -> result=${disconnectResult} text="${readCString(disconnectBuf)}"`)

console.log('\nDone. Report back: did the hardware do anything visible after Step 2, and what were the raw result codes?')
