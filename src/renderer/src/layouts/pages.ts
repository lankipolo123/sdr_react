// Single source of truth for what pages exist and their nav labels -
// add a new page by adding one entry here, matching the original
// sdr_controller's sidebar.py PAGES pattern. Only "channels" is real
// right now; more entries just need a case added in AppLayout's page
// switch once they have real content.
export const PAGES = [
  { id: 'channels', label: 'Channels', icon: 'grid' },
  { id: 'logs', label: 'Logs', icon: 'list' },
  { id: 'dashboard', label: 'Dashboard', icon: 'layout' }
] as const

export type PageId = (typeof PAGES)[number]['id']
