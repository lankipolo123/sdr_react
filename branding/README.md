# branding/

Drop a custom `icon.png` here (next to the installed app - see
`resolveBrandingIconPath()` in `src/main/index.ts`) to override the
running app's window/taskbar icon. Checked once at startup; no file
here, no effect - the app falls back to its built-in default icon
(`resources/icon.png`).

In dev, "next to the app" means this folder, at the repo root. In a
packaged install it means `branding/` next to `SDR React.exe` - the
per-user NSIS install directory (`%LOCALAPPDATA%\Programs\SDR React`)
is writable without elevation, so this works post-install too.

This overrides the *running* app's icon only - not the packaged
`.exe` file's own icon as shown in Windows Explorer, or the
installer/uninstaller icon. Those are baked in at build time from
`build/icon.ico` and need a rebuild (`npm run build:win`) to change.

`icon.png` itself is never committed here - same reasoning as
`dll/Transit.dll`: a portable, per-install override, not something to
ship a default value for.
