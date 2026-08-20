# SDR Protocol + Transit.dll Reference

This document describes everything confirmed, through real hardware testing
and binary disassembly, about (1) the RS422 wire protocol this app speaks to
an SDR module, and (2) how to talk to that protocol through `Transit.dll`,
the vendor-provided Windows middleware DLL. It is written for a fresh
reimplementation in a different language/stack - it assumes no prior
context, and everything in it is either confirmed by a real hardware test
or found directly in the DLL's disassembled code, not guessed.

All numbers below are written in plain decimal, not hex notation.

---

## 1. The wire protocol (frame format)

Every command frame has this shape, in order:

| Field | Length | Meaning |
|---|---|---|
| HEAD | 2 bytes | Fixed: `126, 126` |
| TYPE | 1 byte | What kind of command this is (table below) |
| ADDR | 1 byte | Target module's address (0-199), or 255 for broadcast |
| LEN | 1 byte | Length of the PAYLOAD field that follows, in bytes |
| PAYLOAD | LEN bytes | Depends on TYPE, see below |
| STOP | 2 bytes | Fixed: `10, 13` |

### TYPE byte values

| Name | Value | Meaning |
|---|---|---|
| OUTPUT_SWITCH | 1 | Turn RF output on/off |
| SIGNAL_CONTROL | 2 | Set mode/frequency/bandwidth/power |
| STATUS_QUERY | 255 | Ask a module for its current status |
| ADDR_QUERY | 191 | Broadcast query for a module's address |
| ADDR_SET | 177 | Broadcast-set a module's address |

### PAYLOAD for OUTPUT_SWITCH (1 byte)

| Name | Value |
|---|---|
| OUTPUT_OFF | 0 |
| OUTPUT_ON | 1 |

### PAYLOAD for SIGNAL_CONTROL (5 bytes, in order)

1. **mode** (1 byte) - see mode table below
2. **frequency_mhz** (2 bytes, big-endian unsigned 16-bit integer) - real MHz value, valid range 300-6000
3. **bandwidth_code** (1 byte) - see bandwidth table below
4. **power_code** (1 byte) - see power/level table below

Mode values:

| Name | Value | Display name |
|---|---|---|
| MODE_WHITE_NOISE | 0 | Pseudo Random Noise |
| MODE_LINEAR_SWEEP | 1 | Linear Sweep |
| MODE_COMB_SPECTRUM | 2 | Multi-tone |
| MODE_SINGLE | 3 | Continuous Wave (CW) - also called "Spectral Line" in the vendor's own reference app UI |

Bandwidth: `bandwidth_code` is looked up from real MHz value:

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

Power/level: the UI exposes 4 discrete levels (0=Off, 1=Low, 2=Medium,
3=High), which map to `power_code` like this:

| Level | power_code |
|---|---|
| 0 (Off) | N/A - send OUTPUT_SWITCH with OUTPUT_OFF instead, not a Signal Control frame |
| 1 (Low) | 2 |
| 2 (Medium) | 1 |
| 3 (High) | 0 |

### Response codes (seen in a module's reply payload)

| Name | Value |
|---|---|
| RESP_FAILED | 1 |
| RESP_SUCCESS | 255 |

---

## 2. Transit.dll - the middleware layer

`Transit.dll` is a Windows DLL (confirmed real, working copy is **32-bit**,
not 64-bit - architecture mismatch is a real, previously-hit failure mode,
check this first if nothing works). It exports 5 functions:

```
AutoConnectSDR   (char* buffer, long length) -> long
CheckConnection  (char* buffer, long length) -> long
DisconnectSDR    (char* buffer, long length) -> long
CommandTokens    (char* input, char* output, long output_length) -> long
SendCommandToSDR (char* command, long length) -> long
```

Function names and this calling shape were found by reading the DLL's own
PE export table directly (a completely standard part of any Windows DLL's
file format - this is how any program, including the vendor's own app,
finds and calls into the DLL). Confirmed exact RVAs if useful for
re-verifying against a specific build: `AutoConnectSDR`=0x3B20 ord1,
`CheckConnection`=0x3E50 ord2, `CommandTokens`=0x1D10 ord3,
`DisconnectSDR`=0x3ED0 ord4, `SendCommandToSDR`=0x3F00 ord5.
ImageBase=0x10000000.

### AutoConnectSDR - CONFIRMED on real hardware

Call with an empty/zeroed buffer and its length. It owns port discovery
entirely internally - no port name, baud rate, parity, or data bits is
ever passed to it.

- Hardware attached: returns `4`, buffer contains `"Connected"`
- Nothing attached: returns `-1`, buffer contains `"DisConnected"`

### CheckConnection / DisconnectSDR

Same `(buffer, length) -> long` shape, by symmetry with AutoConnectSDR -
declared the same way, but NOT independently confirmed the same rigorous
way. Observed once: `CheckConnection` returned `40` with buffer
`"Connected"`; `DisconnectSDR` returned `1` with an empty buffer. Whether
`40` always means "connected" specifically from this function wasn't
independently verified.

### CommandTokens - CONFIRMED, the real lookup table

Input: a 2-character uppercase ASCII string that is the hex digits of one
byte (e.g. byte value 10 -> the 2-character string `"0A"`). Output:
written into the caller-provided output buffer as a short ASCII token
(2-3 characters), or the literal 2-character string `"??"` if the byte
has no table entry.

This is the REAL, complete lookup table (found by reading the DLL's own
`.rdata` section directly, and independently confirmed byte-by-byte
against real hardware for every entry):

| byte value | token |
|---|---|
| 0 | X#0 |
| 1 | X#A |
| 2 | X#B |
| 3 | X#C |
| 4 | X#D |
| 5 | X#E |
| 6 | X#F |
| 7 | X#G |
| 8 | X#H |
| 9 | X#I |
| 10 | X#J |
| 11 | X#K |
| 12 | X#L |
| 13 | X#M |
| 14 | X#N |
| 15 | X#O |
| 16 | X#P |
| 126 | XME |
| 255 | XOP |
| 208 | X#X |
| 209 | XHT |
| 210 | XGY |

**Every other byte value (i.e. almost the entire 0-255 range outside this
list) returns `"??"`** - this matters a lot, see section 3.

### SendCommandToSDR - CONFIRMED, the real send mechanism

This is the function that actually transmits to hardware. Its real
internal behavior (found by disassembling it directly, not guessed):

1. It uppercases its input string.
2. It computes an FNV-1a hash of that string (offset basis
   `0x811c9dc5` / 2166136261 decimal, prime `0x1000193` / 16777619
   decimal - standard FNV-1a constants).
3. It looks that hash up against the SAME 22-entry table as
   `CommandTokens` above (i.e. it independently re-derives the same
   token mapping, it doesn't call `CommandTokens` internally).
4. **If the hash doesn't match any table entry**, it falls back to
   parsing the input string AS 2-DIGIT HEX TEXT (base 16, must parse to
   a value 0-255) and uses that parsed value as the byte to send.

Critical, easy-to-get-wrong detail confirmed by tracing the actual
`WriteFile` call inside this function: the fallback path expects the
input to be **hex digit characters** (e.g. the 2-character string
`"92"`, which parses as hex to 146 decimal), NOT a single raw binary
byte (e.g. the one byte `0x92`/146). A raw binary byte is not valid hex
text and will not parse correctly through this fallback. This exact
mistake was made once during development and broke Signal Control
frames silently (see section 3).

---

## 3. How to actually send a frame - the confirmed real mechanism

**Do not send a whole frame as one string.** Both `CommandTokens` and
`SendCommandToSDR` only ever process ONE byte's worth of input per call -
there is no multi-byte batch mode. The confirmed, real, working mechanism
is: **translate and send one byte at a time**, in order, for every byte
of the frame (HEAD through STOP, all of it).

For each byte in the frame, in order:

1. Convert the byte to its 2-character uppercase hex-digit string (e.g.
   byte value 10 -> `"0A"`).
2. Call `CommandTokens` with that string as input.
3. If the result is a real token (not `"??"`): that token IS the thing
   to send - call `SendCommandToSDR` with the token string as the
   entire command.
4. If the result is `"??"` (no table entry - true for MOST byte values,
   especially most bytes of a real frequency value, since frequency
   spans 300-6000 MHz and only 22 specific byte values have a token at
   all): fall back to sending the byte's own 2-character uppercase
   hex-digit text (the SAME string you built in step 1) as the command
   to `SendCommandToSDR` instead of a token.
5. Call `SendCommandToSDR` once per byte - this means a single frame of
   N bytes results in N separate calls to `SendCommandToSDR`, not one
   call with N bytes of data.

### THE BUG THAT BROKE MODULATION, AND ITS FIX

**Wrong (this was tried first, and broke Signal Control / modulation
commands specifically while Output ON/OFF still worked):** using the raw
binary byte itself as the fallback in step 4 - e.g. sending the single
byte `0x92` directly when `CommandTokens` returned `"??"` for it.

**Why it broke silently, and why only modulation was affected:** Output
ON/OFF frames only ever contain bytes that DO have table entries (small
values like 0, 1, 2, the fixed HEAD/STOP bytes, etc.), so the fallback
path was never exercised by those commands - they worked fine and hid
the bug. Signal Control frames contain a real frequency value encoded as
2 bytes spanning most of 300-6000 MHz, and the overwhelming majority of
possible frequency byte values fall OUTSIDE the 22-entry table - so
almost every real Signal Control frame hits the fallback path for at
least one byte, and the wrong fallback silently sent malformed data for
that byte every time, with no error or crash.

**Correct fix, confirmed working on real hardware for both Output ON/OFF
and Signal Control/modulation:** the fallback in step 4 must be the
byte's hex-digit TEXT representation (same format as step 1), not the
raw byte. In other words, steps 1 and the step-4 fallback use the exact
same string - you always send either the translated token, or (if no
token exists) the plain 2-character hex-digit text of the byte, never
the raw binary byte itself.

### Return value handling

`SendCommandToSDR` returning a specific value was not treated as
confirmation of anything by real hardware - it only confirms the DLL
accepted the call. Every byte sent this way returned the same value
consistently in real tests, but there is currently no confirmed way to
read back a real acknowledgment/response through the DLL. Treat every
send as "fire and forget" from the DLL's perspective - see section 4 for
how the app's UI logic handles that uncertainty.

---

## 4. The "blind send" architecture and why it exists

This is the app's core UI/command logic, independent of language - the
reasoning applies no matter what stack reimplements it.

### No discovery step, ever

The app does not scan for modules or read each module's real current
configuration before allowing commands. Every channel (address) is live
and controllable from launch, with a fixed, hardcoded address range (this
implementation used 16 channels, addresses 0-15, but the real protocol
supports addresses 0-199).

**Direct consequence**: since the app never reads a module's real current
frequency/bandwidth, it has no real baseline to echo back. So every
Signal Control command always uses fixed "blind default" values for
frequency (2450 MHz) and bandwidth (100 MHz) - ONLY mode and power/level
are the user's actual real selection from the UI; frequency and
bandwidth are never user-adjustable and always the same guessed
constants on every single send. This is an accepted, documented risk
(a wrong frequency/bandwidth is a real RF behavior change, unlike an
unconfirmed on/off), not an oversight.

### Why "blind" (no confirmed response) at all

RS422 is a shared bus without a DE/RE tri-state pin. Two modules can
physically collide when only one should be transmitting at a time -
meaning "no response received" is genuinely ambiguous (could mean
failure, could mean a collision, could mean the module doesn't ack at
all) rather than a clean success/fail signal. Gating every command
behind a guaranteed confirmed response would mean the UI sometimes waits
indefinitely on something that may never arrive, even though the blind
command usually does get through.

**Design choice made because of this**: send the command once (or with a
small number of retries on timeout), then **apply the change optimistically
in the UI regardless of whether any response was received** - mark it as
applied-but-unconfirmed rather than blocking or reverting. If a genuine
rejection response is ever received, that's handled specially, but plain
silence/timeout is never treated as failure requiring rollback.

Confirmed timing values used: 300ms timeout per attempt, single attempt
(no retry) in the final tuned version - these were tuned empirically
against real hardware behavior, not derived from a spec, and may need
re-tuning for a different implementation/hardware setup.

### Port/connection scheduling

If multiple channels can share one physical port/adapter, commands must
be queued so only one channel holds the port at a time - and released
between each individual attempt (not held for a whole channel's entire
retry cycle), so other channels get a fair turn as soon as the current
attempt's timeout expires, rather than waiting for one channel to fully
exhaust all its retries first.

### Spurious frame safety

Because RS422 collisions can occasionally produce noise that happens to
parse as a structurally valid frame that was never actually sent, any
frame decoding logic must be defensive: an unrequested/unexpected frame
arriving must never overwrite a channel's real pending command state or
get misattributed as a response to something that wasn't asked.
