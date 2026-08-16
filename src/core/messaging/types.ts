export type ExtensionMessageType = 'PING_BACKGROUND' | 'PING_CONTENT'

export type PingBackgroundMessage = {
  type: 'PING_BACKGROUND'
}

export type PingContentMessage = {
  type: 'PING_CONTENT'
}

export type ExtensionMessage = PingBackgroundMessage | PingContentMessage

export type BackgroundPongPayload = {
  type: 'BACKGROUND_PONG'
  message: string
}

export type ContentPongPayload = {
  type: 'CONTENT_PONG'
  message: string
}

export type ExtensionResponseSuccess<T> = {
  status: 'success'
  data: T
}

export type ExtensionResponseError = {
  status: 'error'
  error: string
}

export type ExtensionResponse<T> = ExtensionResponseSuccess<T> | ExtensionResponseError
