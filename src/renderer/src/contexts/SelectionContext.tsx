import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

// Bulk Actions selection - click a card's checkbox to toggle it in/out,
// then the Bulk Actions bar applies to every selected channel at once.
// Direct port of the C rewrite's g_channel_selected[]/Bulk Actions bar,
// as plain renderer-side UI state - selection itself never needs to
// reach the main process, only the individual channel:* IPC calls the
// bulk actions bar already loops through do.
interface SelectionContextValue {
  selected: Set<number>
  toggle: (address: number) => void
  selectAll: (addresses: number[]) => void
  clear: () => void
  isSelected: (address: number) => boolean
}

const SelectionContext = createContext<SelectionContextValue | null>(null)

export function SelectionProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const toggle = useCallback((address: number): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(address)) next.delete(address)
      else next.add(address)
      return next
    })
  }, [])

  const selectAll = useCallback((addresses: number[]): void => {
    setSelected(new Set(addresses))
  }, [])

  const clear = useCallback((): void => setSelected(new Set()), [])

  const isSelected = useCallback((address: number): boolean => selected.has(address), [selected])

  return (
    <SelectionContext.Provider value={{ selected, toggle, selectAll, clear, isSelected }}>
      {children}
    </SelectionContext.Provider>
  )
}

export function useSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext)
  if (ctx === null) throw new Error('useSelection must be used within a SelectionProvider')
  return ctx
}
