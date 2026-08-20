import { useState } from 'react'
import { AppLayout } from './layouts/AppLayout'
import { ConnectionProvider } from './contexts/ConnectionContext'
import type { PageId } from './layouts/pages'
import { ChannelsPage } from './pages/ChannelsPage'
import { LogsPage } from './pages/LogsPage'

function renderPage(page: PageId): React.JSX.Element {
  switch (page) {
    case 'channels':
      return <ChannelsPage />
    case 'logs':
      return <LogsPage />
  }
}

export function App(): React.JSX.Element {
  const [page, setPage] = useState<PageId>('channels')

  return (
    <ConnectionProvider>
      <AppLayout current={page} onNavigate={setPage}>
        {renderPage(page)}
      </AppLayout>
    </ConnectionProvider>
  )
}
