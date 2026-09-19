import { useState } from 'react'
import { AppLayout } from './layouts/AppLayout'
import { ConnectionProvider } from './contexts/ConnectionContext'
import { LogsProvider } from './contexts/LogsContext'
import { SensorProvider } from './contexts/SensorContext'
import { SelectionProvider } from './contexts/SelectionContext'
import type { PageId } from './layouts/pages'
import { ChannelsPage } from './pages/ChannelsPage'
import { LogsPage } from './pages/LogsPage'
import { DashboardPage } from './pages/DashboardPage'

function renderPage(page: PageId): React.JSX.Element {
  switch (page) {
    case 'channels':
      return <ChannelsPage />
    case 'logs':
      return <LogsPage />
    case 'dashboard':
      return <DashboardPage />
  }
}

export function App(): React.JSX.Element {
  const [page, setPage] = useState<PageId>('channels')

  return (
    <ConnectionProvider>
      <LogsProvider>
        <SensorProvider>
          <SelectionProvider>
            <AppLayout current={page} onNavigate={setPage}>
              {renderPage(page)}
            </AppLayout>
          </SelectionProvider>
        </SensorProvider>
      </LogsProvider>
    </ConnectionProvider>
  )
}
