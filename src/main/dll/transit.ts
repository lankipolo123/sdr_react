import koffi from 'koffi'
import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'

// NOT YET VERIFIED ON REAL HARDWARE. This is a direct translation of the
// already-confirmed Python ctypes bindings (see the handoff package's
// middleware.py) to koffi, but koffi loading/calling this specific DLL
// has never actually been tested - only the Python/ctypes path has real
// hardware confirmation. Test dllAutoConnect() against real hardware
// before trusting anything else in this file.
//
// Using the 64-bit Transit_x64_UNVERIFIED.dll per explicit instruction
// (not the 32-bit one the original guide was built/tested against).
// The 5 exported function names/signatures are confirmed identical via
// the x64 DLL's own PE export table, but its internal CommandTokens
// lookup table and SendCommandToSDR fallback mechanism were only
// confirmed against the 32-bit build - treat those as unverified for
// this DLL specifically until re-checked against real hardware (see
// README_x64_dll.txt in the handoff package).

const DLL_FILENAME = 'Transit_x64.dll'

function resolveDllPath(): string {
  // In dev, the DLL lives at <repo>/dll/, and app.getAppPath() already
  // IS the repo root (the directory containing package.json) when
  // running unpackaged - no extra dirname() needed (a real bug here
  // previously: wrapping it in dirname() pointed one directory too
  // high, so the DLL was never actually found - "specified module
  // could not be found" was really "wrong path", not a missing
  // dependency). In a packaged build, it's copied alongside the app via
  // electron-builder's extraResources (see electron-builder.yml) -
  // resourcesPath is the right base there instead.
  if (app.isPackaged) {
    return join(process.resourcesPath, 'dll', DLL_FILENAME)
  }
  return join(app.getAppPath(), 'dll', DLL_FILENAME)
}

let lib: koffi.IKoffiLib | null = null
let loadError: string | null = null

interface TransitFns {
  AutoConnectSDR: (buffer: Buffer, length: number) => number
  CheckConnection: (buffer: Buffer, length: number) => number
  DisconnectSDR: (buffer: Buffer, length: number) => number
  CommandTokens: (input: Buffer, output: Buffer, outputLength: number) => number
  SendCommandToSDR: (command: Buffer, length: number) => number
}

let fns: TransitFns | null = null

function getFns(): TransitFns | null {
  if (fns !== null) return fns
  if (loadError !== null) return null
  try {
    const path = resolveDllPath()
    if (!existsSync(path)) {
      // Distinguishes "wrong path" from "file's there but won't load"
      // (a real dependency-DLL problem, e.g. a missing MSVC runtime) -
      // koffi/Windows report both as the same generic "specified module
      // could not be found" message otherwise, which cost real
      // debugging time once already (see resolveDllPath()'s history).
      throw new Error(`DLL not found at resolved path: ${path}`)
    }
    lib = koffi.load(path)
    fns = {
      AutoConnectSDR: lib.func('long AutoConnectSDR(char* buffer, long length)') as TransitFns['AutoConnectSDR'],
      CheckConnection: lib.func('long CheckConnection(char* buffer, long length)') as TransitFns['CheckConnection'],
      DisconnectSDR: lib.func('long DisconnectSDR(char* buffer, long length)') as TransitFns['DisconnectSDR'],
      CommandTokens: lib.func(
        'long CommandTokens(char* input, char* output, long output_length)'
      ) as TransitFns['CommandTokens'],
      SendCommandToSDR: lib.func('long SendCommandToSDR(char* command, long length)') as TransitFns['SendCommandToSDR']
    }
    return fns
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e)
    return null
  }
}

export function getDllLoadError(): string | null {
  return loadError
}

function readCString(buf: Buffer): string {
  const nul = buf.indexOf(0)
  return buf.toString('ascii', 0, nul === -1 ? buf.length : nul)
}

export interface DllCallResult {
  result: number | null
  text: string | null
  error: string | null
}

export function dllAutoConnect(): DllCallResult {
  const f = getFns()
  if (f === null) return { result: null, text: null, error: loadError }
  const buf = Buffer.alloc(256)
  try {
    const result = f.AutoConnectSDR(buf, buf.length)
    return { result, text: readCString(buf), error: null }
  } catch (e) {
    return { result: null, text: null, error: e instanceof Error ? e.message : String(e) }
  }
}

export function dllCheckConnection(): DllCallResult {
  const f = getFns()
  if (f === null) return { result: null, text: null, error: loadError }
  const buf = Buffer.alloc(256)
  try {
    const result = f.CheckConnection(buf, buf.length)
    return { result, text: readCString(buf), error: null }
  } catch (e) {
    return { result: null, text: null, error: e instanceof Error ? e.message : String(e) }
  }
}

export function dllDisconnect(): DllCallResult {
  const f = getFns()
  if (f === null) return { result: null, text: null, error: loadError }
  const buf = Buffer.alloc(256)
  try {
    const result = f.DisconnectSDR(buf, buf.length)
    return { result, text: readCString(buf), error: null }
  } catch (e) {
    return { result: null, text: null, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Raw CommandTokens call for one byte - exposed mainly for the
 * verification/diagnostic panel, so the 22-entry token table can be
 * re-checked against this specific (x64, unverified) DLL build before
 * anything else relies on it. */
export function dllCommandTokens(byte: number): { token: string | null; error: string | null } {
  const f = getFns()
  if (f === null) return { token: null, error: loadError }
  const hex = byte.toString(16).toUpperCase().padStart(2, '0')
  const out = Buffer.alloc(256)
  try {
    f.CommandTokens(Buffer.from(hex + '\0', 'ascii'), out, out.length)
    return { token: readCString(out), error: null }
  } catch (e) {
    return { token: null, error: e instanceof Error ? e.message : String(e) }
  }
}

export interface SendFrameResult {
  result: number | null
  error: string | null
  // The DLL-translated values actually handed to SendCommandToSDR, one
  // per byte of frameBytes, in order (e.g. "XME" for 0x7E). This is the
  // SAFE, intended-to-be-visible representation - the whole point of
  // routing through CommandTokens is to substitute the real protocol
  // bytes with these opaque values before anything is shown or
  // transmitted. Never expose the frame's own logical/raw bytes
  // anywhere they'd be visible - only these translated tokens.
  sentTokens: string[]
}

/**
 * Sends one full frame, one byte at a time - confirmed real mechanism
 * (see the handoff guide): neither DLL function processes more than one
 * byte per call, there is no multi-byte batch mode. For each byte: look
 * it up via CommandTokens; if the table has no entry ("??"), fall back
 * to sending the byte's 2-digit hex TEXT (never the raw binary byte -
 * this exact mistake silently breaks Signal Control specifically, since
 * frequency bytes mostly fall outside the 22-entry table).
 *
 * Returns only the last SendCommandToSDR return value - the DLL has no
 * confirmed way to report a real hardware acknowledgment, so every send
 * here is fire-and-forget from this bridge's point of view.
 */
export function dllSendFrame(frameBytes: Buffer): SendFrameResult {
  const f = getFns()
  if (f === null) return { result: null, error: loadError, sentTokens: [] }
  let result: number | null = null
  const sentTokens: string[] = []
  try {
    for (const byte of frameBytes) {
      const { token, error } = dllCommandTokens(byte)
      if (error !== null) return { result: null, error, sentTokens }
      const hex = byte.toString(16).toUpperCase().padStart(2, '0')
      const sendText = token === '??' || token === null ? hex : token
      sentTokens.push(sendText)
      result = f.SendCommandToSDR(Buffer.from(sendText + '\0', 'ascii'), sendText.length)
    }
    return { result, error: null, sentTokens }
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : String(e), sentTokens }
  }
}
