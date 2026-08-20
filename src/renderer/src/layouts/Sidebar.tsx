import { cn } from '../lib/utils'
import { PAGES, type PageId } from './pages'

interface SidebarProps {
  current: PageId
  onNavigate: (page: PageId) => void
}

export function Sidebar({ current, onNavigate }: SidebarProps): React.JSX.Element {
  return (
    <nav className="flex w-28 shrink-0 self-start flex-col gap-1 rounded-br-md border-b border-r border-border-subtle bg-white p-2">
      {PAGES.map((page) => (
        <button
          key={page.id}
          type="button"
          onClick={() => onNavigate(page.id)}
          className={cn(
            'rounded-md px-3 py-2 text-left text-xs font-semibold transition-colors',
            current === page.id
              ? 'bg-accent-blue/10 text-accent-blue'
              : 'text-text-muted-ref hover:bg-border-subtle/50'
          )}
        >
          {page.label}
        </button>
      ))}
    </nav>
  )
}
