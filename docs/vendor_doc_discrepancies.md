# Discrepancies: vendor "Developer Integration Guide" vs. confirmed real behavior

This project has a vendor-supplied Word document ("Developer Integration
Guide & API Specification") describing how to call Transit.dll. Where
that document disagrees with what was actually confirmed by testing the
real DLL against real hardware (and by disassembling the DLL directly),
**trust the confirmed behavior below, not the document** - the document
appears to be inaccurate in multiple places, not just imprecise.

## What the document gets right (independently confirmed)

The document includes a real screenshot of a working session, with the
command shown for "turn Channel 1 ON": `XME XME X#A X#A X#A X#A X#J X#M`.
Decoded, this is bytes `126 126 1 1 1 1 10 13` -
`HEAD(126,126) TYPE=1(Output Switch) ADDR=1 LEN=1 PAYLOAD=1(ON) STOP(10,13)`.
This matches this project's confirmed frame format exactly. Good
independent confirmation of the wire protocol itself.

## Where the document disagrees with confirmed real testing

1. **`DisconnectSDR` signature.** Document says:
   `void __stdcall DisconnectSDR();` - no parameters at all.
   Confirmed real behavior: `DisconnectSDR(char* buffer, long length) -> long`
   - called with a real buffer and length, returned `1` with an empty
   buffer, worked without error. The document's zero-parameter version
   was never tested and may not be correct for the real DLL build this
   project uses.

2. **`CheckConnection` and `CommandTokens` return type.** Document says
   both are `void` (no return value). Confirmed real behavior:
   `CheckConnection` returned `40` in a real test when called as
   `(buffer, length) -> long`. If the function is genuinely `void` as
   documented, that captured `40` would have been meaningless garbage
   data, not a real value - this is a real, unresolved conflict, not
   just a documentation gap. `CommandTokens` is confirmed as
   `(input, output_buffer, output_length) -> long` and does return
   real, meaningful values (the whole token-lookup mechanism depends on
   reading its return / output buffer correctly).

3. **`AutoConnectSDR` return value meaning.** Document claims the
   return value directly IS the COM port number that was found (e.g.
   `3` means "COM3"). This was NOT independently confirmed - the one
   real test on record returned `4` with buffer text `"Connected"`,
   but the actual COM port in use during that test was not recorded
   at the same time, so this claim is neither confirmed nor refuted
   yet. Worth verifying on a fresh test: check Windows Device Manager's
   COM port number for the adapter at the same moment AutoConnectSDR
   is called, and compare to the returned integer.

## Bottom line for a fresh reimplementation

Build against the confirmed calling conventions in
`protocol_and_dll_reference.md` and the real Python source files in this
package, not directly against the vendor document's function
signatures. If re-verifying against a real DLL build directly (recommended
regardless of which source is trusted), re-test all 5 functions from
scratch rather than assuming either source is fully correct.
