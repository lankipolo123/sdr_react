import { useEffect, useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { Button } from './ui/button'

// In-app equivalent of the C rewrite's Change Logo/Reset flow: pick an
// image, it's saved to branding/icon.png and applied to the running
// window/taskbar icon immediately (see main/index.ts's
// branding:chooseLogo/resetLogo), no restart needed. Doesn't touch the
// packaged .exe's own file icon - same limitation branding/README.md
// documents for the file-drop path this UI is a friendlier front end for.
export function BrandingCard(): React.JSX.Element {
  const [hasCustomLogo, setHasCustomLogo] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    window.sdr.branding.status().then(setHasCustomLogo)
  }, [])

  async function handleChoose(): Promise<void> {
    setBusy(true)
    try {
      const applied = await window.sdr.branding.chooseLogo()
      if (applied) setHasCustomLogo(true)
    } finally {
      setBusy(false)
    }
  }

  async function handleReset(): Promise<void> {
    setBusy(true)
    try {
      await window.sdr.branding.resetLogo()
      setHasCustomLogo(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-[10px] border border-border-subtle bg-white p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted-ref">
        <ImageIcon size={13} className="text-accent-blue" />
        Branding
      </div>
      <div className="mt-2 text-xs text-text-dark">
        {hasCustomLogo ? 'Custom logo active' : 'Using the default icon'}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <Button
          size="sm"
          className="h-7 bg-navy px-2.5 text-xs font-semibold text-white"
          onClick={handleChoose}
          disabled={busy}
        >
          Change Logo…
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-xs"
          onClick={handleReset}
          disabled={busy || !hasCustomLogo}
        >
          Reset
        </Button>
      </div>
    </div>
  )
}
