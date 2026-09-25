// Register service worker for PWA functionality.
//
// Hardened against transient races that previously surfaced as tracked errors:
//   - "Failed to update a ServiceWorker ... fetching the script" (deploy blip)
//   - "Cannot update a null/nonexistent service worker registration"
//   - "Failed to update a ServiceWorker ... ('Unknown'): Not found"
// All update() calls are guarded and their rejections are swallowed locally so
// they never bubble to window.onerror.
(function () {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  // Safely call registration.update(); never let its rejection escape.
  function safeUpdate(registration) {
    if (!registration || typeof registration.update !== 'function') {
      return;
    }
    try {
      var result = registration.update();
      if (result && typeof result.catch === 'function') {
        result.catch(function (error) {
          // Transient: stale tab, network blip, or SW file briefly 404 during
          // a deploy. Recovered on next load; not actionable.
          console.debug('Service Worker update skipped:', error && error.message);
        });
      }
    } catch (error) {
      console.debug('Service Worker update threw:', error && error.message);
    }
  }

  window.addEventListener('load', function () {
    navigator.serviceWorker
      .register('/sw.js')
      .then(function (registration) {
        // Attempt an update, but tolerate transient failures.
        safeUpdate(registration);

        // If a worker is already waiting, activate it.
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        // Listen for new Service Workers.
        registration.addEventListener('updatefound', function () {
          var newWorker = registration.installing;
          if (!newWorker) {
            return;
          }

          newWorker.addEventListener('statechange', function () {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(function (error) {
        console.debug('Service Worker registration failed:', error && error.message);
      });
  });

  // When a Service Worker takes control, log it but don't reload the page.
  // This prevents double loading of the game.
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    console.debug('New Service Worker activated');
  });
})();
