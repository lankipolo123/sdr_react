Transit_x64_UNVERIFIED.dll
===========================

This is the 64-bit (PE32+/x86-64) Transit.dll from the "Developmentv2"
package sent separately. It is a genuinely different, much smaller
binary (45,568 bytes) than the 32-bit Transit.dll (183,296 bytes) that
all protocol/DLL findings in this package were confirmed against.

Confirmed identical: it exports the same 5 function names/shape
(AutoConnectSDR, CheckConnection, CommandTokens, DisconnectSDR,
SendCommandToSDR) - checked directly via its PE export table.

NOT confirmed - do not assume parity:
- The CommandTokens 22-entry byte->token lookup table documented in
  protocol_and_dll_reference.md / react_shadcn_rewrite_guide.md was
  read out of the 32-bit DLL's .rdata section and confirmed byte-by-byte
  on real hardware. This x64 DLL was NOT successfully disassembled the
  same way - its internal table (if the layout is even the same) has
  not been read or verified.
- SendCommandToSDR's real internal mechanism (uppercase -> FNV-1a hash
  -> table lookup -> hex-text fallback) was traced inside the 32-bit
  DLL specifically. Whether the x64 build behaves the same way
  internally is unknown, not just "probably yes."

If a rewrite ends up using this x64 DLL instead of the 32-bit one
(e.g. to avoid the 32-bit Electron/Node constraint described in the
react_shadcn_rewrite_guide.md), the CommandTokens table and the
SendCommandToSDR fallback behavior need to be re-verified against real
hardware before being trusted - treat everything protocol-level about
this specific DLL as unconfirmed until then.
