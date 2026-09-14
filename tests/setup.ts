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
  m11 = 1; m12 = 0; m13 = 0; m14 = 0;
  m21 = 0; m22 = 1; m23 = 0; m24 = 0;
  m31 = 0; m32 = 0; m33 = 1; m34 = 0;
  m41 = 0; m42 = 0; m43 = 0; m44 = 1;
  is2D = true;
  isIdentity = true;
  constructor(init?: any) {
    if (Array.isArray(init) && init.length === 6) {
      this.a = init[0]; this.b = init[1]; this.c = init[2]; this.d = init[3]; this.e = init[4]; this.f = init[5];
    }
  }
  multiply() { return this; }
  translate() { return this; }
  scale() { return this; }
  rotate() { return this; }
  inverse() { return this; }
  transformPoint(p?: any) { return p || { x: 0, y: 0, z: 0, w: 1 }; }
} as any
