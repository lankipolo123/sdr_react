import { LayoutDashboard, List, SlidersHorizontal, type LucideIcon } from 'lucide-react'
import { cn } from '../lib/utils'
import { PAGES, type PageId } from '../layouts/pages'

interface SidebarProps {
  current: PageId
  onNavigate: (page: PageId) => void
}

const ICONS: Record<(typeof PAGES)[number]['icon'], LucideIcon> = {
  layout: LayoutDashboard,
  sliders: SlidersHorizontal,
  list: List
}

export function Sidebar({ current, onNavigate }: SidebarProps): React.JSX.Element {
  return (
    <nav className="fixed left-0 top-9 bottom-0 z-10 flex w-40 flex-col gap-1 border-r border-border-subtle bg-slate-50 p-2">
      {PAGES.map((page) => {
        const Icon = ICONS[page.icon]
        return (
          <button
            key={page.id}
            type="button"
            onClick={() => onNavigate(page.id)}
            className={cn(
              'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[11px] font-semibold transition-colors',
              current === page.id
                ? 'bg-accent-blue/10 text-accent-blue'
                : 'text-text-muted-ref hover:bg-border-subtle/50'
            )}
          >
            <Icon size={14} className="shrink-0" />
            {page.label}
          </button>
        )
      })}
    </nav>
  )
}
