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
    element.value = value
  }

  dispatchFieldEvents(element)
}

/**
 * Dispatches synthetic DOM events (input, change, blur) to notify reactive frontend frameworks.
 */
export function dispatchFieldEvents(element: HTMLElement): void {
  if (!element) return

  try {
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
    element.dispatchEvent(new Event('blur', { bubbles: true }))
  } catch (err) {
    console.error('Failed to dispatch DOM events:', err)
  }
}
