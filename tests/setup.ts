/* eslint-disable @typescript-eslint/no-explicit-any */
import { JSDOM } from 'jsdom'

const jsdom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://indianvisaonline.gov.in/visa/addressdetails.jsp',
})
const { window } = jsdom

Object.defineProperty(global, 'window', { value: window, configurable: true, writable: true })
Object.defineProperty(global, 'document', { value: window.document, configurable: true, writable: true })
Object.defineProperty(global, 'navigator', { value: window.navigator, configurable: true, writable: true })
Object.defineProperty(global, 'HTMLElement', { value: window.HTMLElement, configurable: true, writable: true })
Object.defineProperty(global, 'HTMLInputElement', { value: window.HTMLInputElement, configurable: true, writable: true })
Object.defineProperty(global, 'HTMLSelectElement', { value: window.HTMLSelectElement, configurable: true, writable: true })
Object.defineProperty(global, 'HTMLTextAreaElement', { value: window.HTMLTextAreaElement, configurable: true, writable: true })
Object.defineProperty(global, 'Event', { value: window.Event, configurable: true, writable: true })
Object.defineProperty(global, 'CustomEvent', { value: window.CustomEvent, configurable: true, writable: true })

global.CSS = {
  escape: (val: string) => val.replace(/([#;?%&,.+*~':"!^$[\]()=>|/\\@])/g, '\\$1'),
} as any

// Mock DOMMatrix for pdfjs-dist in Node environment
global.DOMMatrix = class MockDOMMatrix {
  a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
} as any
