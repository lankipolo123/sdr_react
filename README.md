# SDR React

React + Electron rewrite of the SDR channel controller, built against
the vendor-provided `Transit.dll` instead of raw serial I/O. See
`docs/react_shadcn_rewrite_guide.md` for the full architecture writeup
this was built from - frame format, DLL export signatures, the
`CommandTokens`/`SendCommandToSDR` internals, and everything flagged as
confirmed vs. unverified.

## Status: scaffold phase

One channel (address 1) is wired end-to-end: Electron main process →
koffi → `Transit_x64.dll` → real hardware, with a working React UI card
for it (mode select, level slider, on/off). This is deliberately not yet
expanded to all 16 channels - the plan (see the guide) was to prove the
hard part (the 64-bit koffi↔DLL bridge, genuinely untested before this)
works for one channel first.

**Using the 64-bit `Transit_x64.dll`** (`dll/Transit_x64.dll`), not the
32-bit one the original guide defaulted to. This DLL's `CommandTokens`
lookup table and `SendCommandToSDR` internal mechanism were only
hardware-confirmed against the *32-bit* build - see
`docs/README_x64_dll.txt`. Treat those specifics as unverified for this
DLL until re-checked against real hardware.

## What needs verifying on real hardware, in order

1. **Does koffi load `Transit_x64.dll` at all.** Run `npm run dev`,
   click Connect. If `dll:loadError` reports something, start there -
   this is the one thing that was completely unverified before this
   scaffold existed.
2. **`AutoConnectSDR`'s return value meaning.** The 32-bit DLL returned
   `4`/`"Connected"` when hardware was attached - check whether this
   x64 build matches, and (per `docs/vendor_doc_discrepancies.md`)
   whether the vendor doc's claim that the return value IS the COM port
   number actually holds - check Device Manager's port number against
   the returned integer at the same moment.
3. **The `CommandTokens` 22-entry table**, for this specific DLL. Not
   yet re-read from this x64 build's disassembly the way the 32-bit one
   was. `dllCommandTokens()` in `src/main/dll/transit.ts` is exposed
   for exactly this kind of manual verification.
4. **Whether `SendCommandToSDR`'s hex-text fallback mechanism** (never
   the raw binary byte - this exact mistake silently breaks Signal
   Control specifically) behaves the same in this build.

## Development

```
npm install
npm run dev
```

Requires Windows (the DLL is Windows-only) to actually exercise the
hardware path - the UI itself will run cross-platform, but every DLL
call will report a load error anywhere else.

## Building an installer

```
npm run build:win
```

Produces an NSIS installer via `electron-builder`, x64 target
(`electron-builder.yml`). `dll/Transit_x64.dll` ships alongside the app
via `extraResources` (koffi needs a real filesystem path, not one
packed inside the app's ASAR archive).

## Project layout

| Path | What's in it |
|---|---|
| `src/main/` | Electron main process: DLL bridge (`dll/transit.ts`), protocol/frame building (`protocol/`), port scheduler, channel controller, IPC handlers (`index.ts`) |
| `src/preload/` | `contextBridge`-exposed `window.sdr` API - the only surface the renderer can use to reach hardware |
| `src/renderer/` | React UI (Tailwind + shadcn-pattern components) |
| `docs/` | The full handoff package this was built from - rewrite guide, protocol/DLL reference, vendor-doc discrepancies, and the original Python reference implementation for comparison |
| `dll/` | The vendor DLL |

## Known gaps (scaffold phase, not yet built)

- Only channel address 1 exists - expanding `channels` in
  `src/main/index.ts` to `MAX_CHANNELS` (16) is the next real step, once
  the DLL bridge itself is confirmed working.
- No `CheckConnection`/`DisconnectSDR` UI wiring yet beyond the IPC
  handlers existing - `AutoConnectSDR` (Connect button) is the only one
  actually called from the UI so far.
- No packaged-build smoke test yet (`npm run build:win` has not been
  run against real hardware).
