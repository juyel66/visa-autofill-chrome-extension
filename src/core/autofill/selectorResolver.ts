import type { FieldSelector } from './types'

/**
 * Resolves a target DOM HTMLElement using developer-defined selector strategies (id, name, label, css, xpath).
 */
export function resolveElement(selector?: FieldSelector): HTMLElement | null {
  if (!selector || !selector.value || typeof document === 'undefined') {
    return null
  }

  const { strategy, value } = selector

  try {
    switch (strategy) {
      case 'id': {
        return document.getElementById(value)
      }
      case 'name': {
        const el = document.querySelector(`[name="${CSS.escape(value)}"]`)
        return el instanceof HTMLElement ? el : null
      }
      case 'css': {
        const el = document.querySelector(value)
        return el instanceof HTMLElement ? el : null
      }
      case 'label': {
        // Strategy 1: Find <label for="value">
        const labelFor = document.querySelector(`label[for="${CSS.escape(value)}"]`)
        if (labelFor && labelFor.getAttribute('for')) {
          const target = document.getElementById(labelFor.getAttribute('for')!)
          if (target instanceof HTMLElement) return target
        }
        // Strategy 2: Find <label> matching text -> containing <input>
        const labels = Array.from(document.querySelectorAll('label'))
        for (const l of labels) {
          if (l.textContent && l.textContent.toLowerCase().includes(value.toLowerCase())) {
            const input = l.querySelector('input, select, textarea')
            if (input instanceof HTMLElement) return input
          }
        }
        return null
      }
      case 'xpath': {
        const result = document.evaluate(
          value,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        )
        const node = result.singleNodeValue
        return node instanceof HTMLElement ? node : null
      }
      default:
        return null
    }
  } catch (err) {
    console.error(`Failed to resolve selector (${strategy}: ${value}):`, err)
    return null
  }
}
