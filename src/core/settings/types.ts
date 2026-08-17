export type FillPolicy = 'fill-empty' | 'overwrite'

export interface AutofillSettings {
  defaultFillPolicy: FillPolicy
  requirePageConfirmation: boolean
}

export interface PrivacySettings {
  storeDocumentsLocally: boolean
}

export interface AppSettings {
  autofill: AutofillSettings
  privacy: PrivacySettings
  version: number
}
