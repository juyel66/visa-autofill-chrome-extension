import type { AppSettings } from './types'

export const DEFAULT_SETTINGS: AppSettings = {
  autofill: {
    defaultFillPolicy: 'fill-empty',
    requirePageConfirmation: true,
  },
  privacy: {
    storeDocumentsLocally: true,
  },
  version: 1,
}
