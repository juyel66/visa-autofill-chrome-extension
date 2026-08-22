import type { FieldSelector } from './types'

/**
 * Single selector strategy resolution helper.
 */
function resolveSingleSelector(selector: FieldSelector): HTMLElement[] {
  if (!selector || !selector.value || typeof document === 'undefined') {
    return []
  }

  const { strategy, value } = selector
  const elements: HTMLElement[] = []

  try {
    switch (strategy) {
      case 'id': {
        const els = Array.from(document.querySelectorAll(`[id="${CSS.escape(value)}"]`))
        return els.filter((el): el is HTMLElement => el instanceof HTMLElement)
      }
      case 'name': {
        const els = Array.from(document.querySelectorAll(`[name="${CSS.escape(value)}"]`))
        return els.filter((el): el is HTMLElement => el instanceof HTMLElement)
      }
      case 'css': {
        const els = Array.from(document.querySelectorAll(value))
        return els.filter((el): el is HTMLElement => el instanceof HTMLElement)
      }
      case 'label': {
        // Strategy 1: Find <label for="value">
        const labelsFor = Array.from(document.querySelectorAll(`label[for="${CSS.escape(value)}"]`))
        for (const labelFor of labelsFor) {
          const forId = labelFor.getAttribute('for')
          if (forId) {
            const target = document.getElementById(forId)
            if (target instanceof HTMLElement) {
              elements.push(target)
            }
          }
        }
        // Strategy 2: Find <label> matching text -> containing <input>
        const labels = Array.from(document.querySelectorAll('label'))
        for (const l of labels) {
          if (l.textContent && l.textContent.toLowerCase().includes(value.toLowerCase())) {
            const input = l.querySelector('input, select, textarea')
            if (input instanceof HTMLElement) {
              elements.push(input)
            }
          }
        }
        // Remove duplicates
        return Array.from(new Set(elements))
      }
      case 'xpath': {
        const iterator = document.evaluate(
          value,
          document,
          null,
          XPathResult.ORDERED_NODE_ITERATOR_TYPE,
          null
        )
        let node = iterator.iterateNext()
        while (node) {
          if (node instanceof HTMLElement) {
            elements.push(node)
          }
          node = iterator.iterateNext()
        }
        return elements
      }
      default:
        return []
    }
  } catch (err) {
    console.error(`Failed to resolve selector (${strategy}: ${value}):`, err)
    return []
  }
}

/**
 * Queries all matching target HTMLElements using single or candidate array selector strategies.
 * Returns explicit empty array [] if no target element matches.
 */
export function resolveElements(selector?: FieldSelector | FieldSelector[]): HTMLElement[] {
  if (!selector) {
    return []
  }

  if (Array.isArray(selector)) {
    for (const cand of selector) {
      const els = resolveSingleSelector(cand)
      if (els.length > 0) {
        return els
      }
    }
    return []
  }

  return resolveSingleSelector(selector)
}

/**
 * Resolves a single target DOM HTMLElement.
 * Returns null if no elements are matched, or if multiple elements match (ambiguous target).
 */
export function resolveElement(selector?: FieldSelector | FieldSelector[]): HTMLElement | null {
  const els = resolveElements(selector)
  return els.length === 1 ? els[0] : null
}
