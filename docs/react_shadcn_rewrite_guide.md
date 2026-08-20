# SDR Controller — React + Tailwind + shadcn/ui Rewrite Guide

Audience: a developer starting a fresh implementation of this app in
React, with no prior context. Everything under "Confirmed" was verified
this session via real hardware tests, direct DLL disassembly, or reading
the reference app's own compiled binary — not guessed. Everything under
"Recommended" is a stack/architecture choice, not a verified fact — mark
it "TODO: verify" once real hardware is available on the new stack.

---

## 1. Why this can't be a plain web app

This app must call directly into a vendor-provided **Windows DLL**
(`Transit.dll`) that talks to hardware over RS422. A browser page (e.g.
hosted on Vercel) has no way to load a native DLL or open a serial
port — there is no supported web API for either. That rules out a plain
React SPA / Next.js-on-Vercel deployment for the real control surface.

**Recommended stack:**

| Layer | Choice |
|---|---|
| Shell | **Electron** (gives a Node.js process with full OS/native access, plus a Chromium window for the UI) |
| UI | **React + TypeScript**, rendered in Electron's renderer process |
| Styling | **Tailwind CSS** |
| Components | **shadcn/ui** |
| Native DLL access | **Node.js in Electron's main process**, using **koffi** (an FFI library — lets Node call exported C functions in a `.dll` directly, no C++ addon build step required) |
| Renderer ↔ main comms | Electron `ipcRenderer`/`ipcMain` via a `contextBridge`-exposed preload API |

This mirrors the current Python app's own split: `services/protocol/`
(pure logic, no hardware) stays conceptually the same either
side of the IPC boundary; `services/middleware.py` (ctypes → DLL) becomes
the Node main-process koffi module.

---

## 2. Critical constraint: the DLL is 32-bit

**Confirmed** (via `file` on the real `Transit.dll`): it is a **32-bit**
Windows DLL, not 64-bit. FFI bridges (koffi, same as Python's `ctypes`)
require the *host process* to match the DLL's bitness — a 64-bit Node/
Electron process cannot load a 32-bit DLL, and vice versa. This exact
mismatch has already caused real failures once in this project; check it
first if a fresh koffi setup fails to load the DLL at all.

Two ways to handle it — pick one before writing any FFI code:

1. **Build Electron as a 32-bit (`ia32`) app.** Simplest architecturally —
   the whole app, including koffi and the DLL, runs in one 32-bit
   process. Electron does still ship `ia32` Windows builds. Downside:
   the whole app (not just the DLL bridge) is stuck at 32-bit.
2. **Split off a small 32-bit helper process.** Keep the main Electron
   app 64-bit; spawn a tiny separate 32-bit Node (or native) helper
   process that loads the DLL and exposes it over stdio/IPC to the main
   process. More moving parts, but the UI/main app stays 64-bit.

Recommendation: start with option 1 (single 32-bit Electron app) unless
another dependency in the stack specifically requires 64-bit — it's a
direct match for how the current Python app already runs (also effectively
32-bit-constrained by the same DLL).

**Not yet verified**: koffi itself has not been tested against this DLL
in this session — the Python/ctypes path is the only one that's actually
been confirmed against real hardware. Test the koffi bridge against real
hardware before trusting it the same way.

---

## 3. The wire protocol (confirmed)

Every command frame, in order:

| Field | Length | Meaning |
|---|---|---|
| HEAD | 2 bytes | Fixed: `126, 126` |
| TYPE | 1 byte | Command kind (table below) |
| ADDR | 1 byte | Target module address (0-199), or 255 for broadcast |
| LEN | 1 byte | Length of PAYLOAD, in bytes |
| PAYLOAD | LEN bytes | Depends on TYPE |
| STOP | 2 bytes | Fixed: `10, 13` |

### TYPE values

| Name | Value |
|---|---|
| OUTPUT_SWITCH | 1 |
| SIGNAL_CONTROL | 2 |
| STATUS_QUERY | 255 |
| ADDR_QUERY | 191 |
| ADDR_SET | 177 |

### PAYLOAD — OUTPUT_SWITCH (1 byte)

| Name | Value |
|---|---|
| OUTPUT_OFF | 0 |
| OUTPUT_ON | 1 |

### PAYLOAD — SIGNAL_CONTROL (5 bytes, in order)

1. **mode** (1 byte)
2. **frequency_mhz** (2 bytes, big-endian uint16, real MHz value, range 300-6000)
3. **bandwidth_code** (1 byte, looked up — see table)
4. **power_code** (1 byte)

Mode values:

| Name | Value | Display name |
|---|---|---|
| MODE_WHITE_NOISE | 0 | Pseudo Random Noise |
| MODE_LINEAR_SWEEP | 1 | Linear Sweep |
| MODE_COMB_SPECTRUM | 2 | Multi-tone |
| MODE_SINGLE | 3 | Continuous Wave (CW) |

Bandwidth (`bandwidth_code` looked up from real MHz):

| MHz | code |
|---|---|
| 10 | 0 |
| 20 | 1 |
| 50 | 2 |
| 100 | 3 |
| 150 | 4 |
| 200 | 5 |
| 250 | 6 |
| 300 | 7 |

Power/level — 4 discrete UI levels map to `power_code`:

| Level | power_code |
|---|---|
| 0 (Off) | N/A — send OUTPUT_SWITCH/OUTPUT_OFF instead |
| 1 (Low) | 2 |
| 2 (Medium) | 1 |
| 3 (High) | 0 |

### Response codes

| Name | Value |
|---|---|
| RESP_FAILED | 1 |
| RESP_SUCCESS | 255 |

---

## 4. Transit.dll surface (confirmed via PE export table + disassembly)

5 exported functions:

```
AutoConnectSDR   (char* buffer, long length) -> long
CheckConnection  (char* buffer, long length) -> long
DisconnectSDR    (char* buffer, long length) -> long
CommandTokens    (char* input, char* output, long output_length) -> long
SendCommandToSDR (char* command, long length) -> long
```

### koffi bindings (Node, main process)

Direct translation of the Python `ctypes` bindings already proven against
real hardware (`services/middleware.py`):

```ts
import koffi from "koffi";

const lib = koffi.load("./dll/Transit.dll");

const AutoConnectSDR   = lib.func("long AutoConnectSDR(char* buffer, long length)");
const CheckConnection  = lib.func("long CheckConnection(char* buffer, long length)");
const DisconnectSDR    = lib.func("long DisconnectSDR(char* buffer, long length)");
const CommandTokens    = lib.func("long CommandTokens(char* input, char* output, long output_length)");
const SendCommandToSDR = lib.func("long SendCommandToSDR(char* command, long length)");
```

`AutoConnectSDR` — call with an empty/zeroed buffer + its length. It owns
port discovery entirely internally (no port name/baud/parity ever
passed). Confirmed on real hardware: attached → returns `4`, buffer
`"Connected"`; nothing attached → returns `-1`, buffer `"DisConnected"`.

### CommandTokens — confirmed lookup table

Input: 2-char uppercase hex-digit string for one byte (e.g. byte `10` →
`"0A"`). Output: a short ASCII token, or `"??"` if no table entry.

| byte value | token | byte value | token |
|---|---|---|---|
| 0 | X#0 | 9 | X#I |
| 1 | X#A | 10 | X#J |
| 2 | X#B | 11 | X#K |
| 3 | X#C | 12 | X#L |
| 4 | X#D | 13 | X#M |
| 5 | X#E | 14 | X#N |
| 6 | X#F | 15 | X#O |
| 7 | X#G | 16 | X#P |
| 8 | X#H | 126 | XME |
| 255 | XOP | 208 | X#X |
| 209 | XHT | 210 | XGY | |

**Every other byte value returns `"??"`** — this is most of the 0-255
range, and matters a lot for frequency bytes (see below).

### SendCommandToSDR — confirmed real send mechanism

Internally: uppercases input → FNV-1a hashes it → looks the hash up
against the same 22-entry table as `CommandTokens` → if no match, parses
the input **as 2-digit hex text** (not a raw byte) and sends that parsed
value.

**The one mistake that will silently break Signal Control (and only
Signal Control) if repeated in this rewrite:** the fallback path must be
fed the byte's hex-digit TEXT (e.g. the 2-character string `"92"`), never
the raw binary byte `0x92`. Output ON/OFF only ever uses bytes that have
real table tokens, so this bug hides there — it only shows up once real
frequency bytes (which mostly fall outside the 22-entry table) start
flowing through Signal Control frames.

### The real send loop — one byte at a time

Neither function processes more than one byte per call — **there is no
multi-byte batch mode**. For every byte of the frame, HEAD through STOP,
in order:

```ts
function sendFrame(frame: Buffer) {
  let result: number | null = null;
  for (const byte of frame) {
    const hex = byte.toString(16).toUpperCase().padStart(2, "0");
    const out = Buffer.alloc(256);
    CommandTokens(Buffer.from(hex), out, out.length);
    let token = out.toString("ascii").replace(/\0.*$/, "");
    if (token === "??") token = hex; // fallback: hex TEXT, never the raw byte
    result = SendCommandToSDR(Buffer.from(token), token.length);
  }
  return result;
}
```

`SendCommandToSDR`'s return value only confirms the DLL accepted the
call — there is no confirmed way to read back a real hardware
acknowledgment through the DLL. Treat every send as fire-and-forget.

---

## 5. The "blind send" architecture (confirmed design, hardware-tuned)

- **No discovery step, ever.** Every channel/address is live and
  controllable from launch; the app never reads a module's real current
  config before sending.
- **Frequency and bandwidth are fixed blind constants on every Signal
  Control send** — `2450` MHz / `100` MHz. Only mode and power/level are
  real user selections.
- **Confirmed from the reference app's own binary** (string-dumped the
  compiled `Noise_Controller.exe`): it has zero UI text for "Frequency"
  or "Bandwidth" anywhere — not a label, not a field. Its `Config.ini`
  only stores `channel`, `power`, `attn`, `module`. So in the reference
  app these values aren't declared or configurable at all — they're
  plain numeric literals compiled into its code, invisible to the user,
  sent blind every time. **Match this exactly**: don't add Frequency/
  Bandwidth UI controls unless deliberately going beyond reference-app
  parity.
- **No confirmed-response gating.** RS422 here is a shared bus with no
  tri-state control — silence on a send is genuinely ambiguous (could be
  failure, collision, or a module that just doesn't ack), not a clean
  fail signal. Design choice: send once (confirmed tuned values: 300ms
  timeout, single attempt, no retry in the final version), then apply
  the change **optimistically** in the UI regardless of response —
  mark it applied-but-unconfirmed, don't block or revert on silence.
- **Port scheduling.** If channels share one physical port, queue
  commands so only one channel holds the port at a time, and release the
  port between each individual attempt (not per whole channel) so other
  channels get a fair turn.
- **Spurious-frame safety.** RS422 collisions can produce noise that
  happens to parse as a structurally valid frame nobody sent — decoding
  logic must never let an unrequested frame overwrite a channel's real
  pending-command state.

---

## 6. UI component plan (shadcn mapping)

Per-channel card (`ChannelCard` in the current app) →

| Current (Python/Qt) | shadcn/Tailwind equivalent |
|---|---|
| `Card` (bordered panel) | `<Card>` |
| Mode `QComboBox` + Set button | `<Select>` + `<Button>` |
| `PowerButton` (ON/OFF pair) | `<ToggleGroup type="single">` with two items, or two `<Button variant={active ? "default" : "outline"}>` |
| `LevelSlider` (vertical, 0-3, green→orange→red) | `<Slider orientation="vertical" min={0} max={3} step={1}>`, colored via a small wrapper that swaps track color by value |
| Status dot + text | plain `<span>` + Tailwind color classes |

**Functional behavior to carry over exactly** (this was a deliberate,
recently-shipped UX change — keep it): the level slider starts
**disabled**, and is only enabled once that channel's power is actually
on (real hardware state, not just a UI toggle guess) — no separate
"arm"/unlock gesture. Re-disable it immediately if output goes off.

Other components:

| Current | shadcn equivalent |
|---|---|
| `ConfirmDialog` (custom overlay) | `<AlertDialog>` |
| `LogsPanel` / `LogsDialog` | `<ScrollArea>` + a simple virtualized/plain list |
| `TitleBar` / `ResizableContainer` (frameless window chrome) | Electron `frame: false` window + a custom draggable title bar div (`-webkit-app-region: drag`) |

---

## 7. Process/IPC architecture

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  Renderer (React)           │  IPC   │  Main process (Node)          │
│  - shadcn/Tailwind UI       │ <────> │  - koffi bridge to Transit.dll│
│  - per-channel state (view) │        │  - port/command scheduler     │
│  - dispatches commands      │        │  - owns real hardware state   │
└─────────────────────────────┘        └──────────────────────────────┘
```

- Renderer never touches the DLL directly — only the main process does
  (same reason Electron's whole security model assumes this split).
- Expose a small typed API via `contextBridge` in a preload script, e.g.
  `window.sdr.setMode(channel, mode)`, `window.sdr.setLevel(channel, level)`,
  `window.sdr.onStateChanged(callback)` — mirrors the current
  `ChannelController`/`state.changed` signal pattern, just over IPC
  instead of Qt signals.
- Main process owns one queue/scheduler (equivalent to the current app's
  port-scheduling logic) so concurrent channel commands still serialize
  onto the shared port correctly.

---

## 8. What's confirmed vs. what still needs testing

**Confirmed this session** (safe to build directly on): frame format,
TYPE/mode/bandwidth/power tables, all 5 DLL export signatures, the
`CommandTokens` lookup table, the real `SendCommandToSDR` hex-fallback
mechanism (and the exact bug to avoid), the DLL's 32-bit-only nature, the
blind-send default values, and that the reference app itself has no
frequency/bandwidth UI.

**Not yet verified — test before trusting:**
- koffi loading/calling this specific DLL (only Python `ctypes` has been
  hardware-tested so far)
- Whether a 32-bit Electron/Node build behaves identically to the 32-bit
  Python build for this DLL
- Re-tune the 300ms timeout / single-attempt values if real hardware
  behavior differs at all on the new stack
