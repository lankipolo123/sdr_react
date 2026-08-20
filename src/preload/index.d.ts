import type { SdrApi } from './index'

declare global {
  interface Window {
    sdr: SdrApi
  }
}
