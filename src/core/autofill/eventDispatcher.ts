/**
 * Safely sets the value of an input/select/textarea element in a React/Angular/Vue compatible manner
 * by invoking native property setters and dispatching input/change events.
 */
export function setNativeInputValue(element: HTMLElement, value: string): void {
  if (!element) return

  if (element instanceof HTMLInputElement) {
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set
    const prototypeSetter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(element),
      'value'
    )?.set

    if (prototypeSetter && valueSetter !== prototypeSetter) {
      prototypeSetter.call(element, value)
    } else if (valueSetter) {
      valueSetter.call(element, value)
    } else {
      element.value = value
    }
  } else if (element instanceof HTMLTextAreaElement) {
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value'
    )?.set
    if (valueSetter) {
      valueSetter.call(element, value)
    } else {
      element.value = value
    }
  } else if (element instanceof HTMLSelectElement) {
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      'value'
    )?.set
    const prototypeSetter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(element),
      'value'
    )?.set

    if (prototypeSetter && valueSetter !== prototypeSetter) {
      prototypeSetter.call(element, value)
    } else if (valueSetter) {
      valueSetter.call(element, value)
    } else {
      element.value = value
    }
  }

  dispatchFieldEvents(element)
}

interface ElementWithChangeHandler {
  onchange?: (ev: Event) => void
}

interface WindowWithJQuery {
  $?: (el: HTMLElement) => { trigger: (ev: string) => { trigger: (ev: string) => void } }
}

/**
 * Dispatches synthetic DOM events (input, change, blur) to notify reactive frontend frameworks,
 * inline onchange handlers, and jQuery event listeners.
 */
export function dispatchFieldEvents(element: HTMLElement): void {
  if (!element) return

  try {
    const defaultView = element.ownerDocument?.defaultView || globalThis.window || (typeof window !== 'undefined' ? window : null)
    const EventConstructor = (defaultView?.Event || globalThis.Event || Event) as typeof Event

    element.dispatchEvent(new EventConstructor('input', { bubbles: true, cancelable: true, composed: true }))
    element.dispatchEvent(new EventConstructor('change', { bubbles: true, cancelable: true, composed: true }))
    element.dispatchEvent(new EventConstructor('blur', { bubbles: true, cancelable: true, composed: true }))

    // Trigger inline handler if present (e.g. onchange attribute or property)
    const elWithChange = element as unknown as ElementWithChangeHandler
    if (typeof elWithChange.onchange === 'function') {
      try {
        elWithChange.onchange.call(element, new EventConstructor('change', { bubbles: true, cancelable: true }))
      } catch {
        // ignore inline handler execution errors
      }
    }

    // Trigger jQuery event if jQuery is attached to window
    const win = defaultView as unknown as WindowWithJQuery | null
    if (win && typeof win.$ === 'function') {
      try {
        win.$(element).trigger('input').trigger('change')
      } catch {
        // ignore jQuery trigger errors
      }
    }
  } catch (err) {
    console.error('Failed to dispatch DOM events:', err)
  }
}


