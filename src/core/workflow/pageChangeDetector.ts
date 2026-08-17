/**
 * Attaches a lightweight page-change observer watching URL and DOM structural shifts.
 * Returns a cleanup function that detaches all observers.
 */
export function startPageChangeObserver(onPageChanged: () => void): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {}
  }

  let lastHref = window.location.href
  let timeoutId: number | null = null

  const triggerChange = () => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
    }
    // Debounce notification by 300ms
    timeoutId = window.setTimeout(() => {
      onPageChanged()
    }, 300)
  }

  // 1. URL change polling interval (every 1000ms)
  const urlCheckInterval = window.setInterval(() => {
    if (window.location.href !== lastHref) {
      lastHref = window.location.href
      triggerChange()
    }
  }, 1000)

  // 2. Lightweight DOM MutationObserver on document body
  let observer: MutationObserver | null = null
  if (typeof MutationObserver !== 'undefined' && document.body) {
    observer = new MutationObserver(() => {
      if (window.location.href !== lastHref) {
        lastHref = window.location.href
        triggerChange()
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: false,
    })
  }

  // Return cleanup function
  return () => {
    window.clearInterval(urlCheckInterval)
    if (timeoutId !== null) window.clearTimeout(timeoutId)
    if (observer) observer.disconnect()
  }
}
