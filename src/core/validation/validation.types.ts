export interface ValidationError {
  field: string
  message: string
  errorCode?: string
  safeMessage?: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}
