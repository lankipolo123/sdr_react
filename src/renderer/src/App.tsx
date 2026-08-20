import { useState } from 'react'
import { AppLayout } from './layouts/AppLayout'
import { ConnectionProvider } from './contexts/ConnectionContext'
import type { PageId } from './layouts/pages'
import { ChannelsPage } from './pages/ChannelsPage'

function renderPage(page: PageId): React.JSX.Element {
  switch (page) {
    case 'channels':
      return <ChannelsPage />
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
