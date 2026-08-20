import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { LevelSlider } from './ui/slider'
import { useChannel } from '../hooks/useChannel'
import { LEVEL_LABELS, MODE_NAMES, type Level } from '../../../main/protocol/constants'

interface ChannelCardProps {
  address: number
}

export function ChannelCard({ address }: ChannelCardProps): React.JSX.Element {
  const { state, turnOn, turnOff, setLevel, setMode } = useChannel(address)

  if (state === null) {
    return (
      <Card className="w-56">
        <CardContent className="p-4 text-sm text-muted-foreground">Loading CH{String(address).padStart(2, '0')}…</CardContent>
      </Card>
    )
  }

  const statusColor = state.outputOn ? 'bg-green-500' : 'bg-muted-foreground/40'
  const statusText = state.outputOn ? LEVEL_LABELS[state.level].toUpperCase() : 'STANDBY'

  return (
    <Card className="w-56">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>CH{String(address).padStart(2, '0')}</CardTitle>
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${statusColor}`} />
          <span className="text-xs font-medium text-muted-foreground">{statusText}</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <select
            className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs"
            value={state.mode}
            onChange={(e) => setMode(Number(e.target.value))}
          >
            {Object.entries(MODE_NAMES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-center gap-6">
          {/* Disabled until output is actually on (real hardware state,
              not a UI toggle guess) - deliberate UX behavior to carry
              over exactly, per the rewrite guide section 6. */}
          <LevelSlider
            value={state.level}
            onValueChange={(v) => setLevel(v as Level)}
            disabled={!state.outputOn}
          />
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            {([3, 2, 1, 0] as Level[]).map((lvl) => (
              <span key={lvl} className={state.level === lvl ? 'font-semibold text-foreground' : undefined}>
                {LEVEL_LABELS[lvl]}
              </span>
            ))}
          </div>
        </div>

        <Button
          variant={state.outputOn ? 'destructive' : 'default'}
          disabled={state.busy}
          onClick={state.outputOn ? turnOff : turnOn}
        >
          {state.busy ? 'Sending…' : state.outputOn ? 'Power Off' : 'Activate'}
        </Button>

        <p className="truncate text-[11px] text-muted-foreground">
          {state.lastCommand}
          {state.lastCommandUnconfirmed && ' (unconfirmed)'}
        </p>
      </CardContent>
    </Card>
  )
}
