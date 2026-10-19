// No deadline is allowed to release loading. Shared by real iframe and tests.
export function createBootState({ now = () => performance.now(), stableMs = 700, minLoadingMs = 1500 } = {}) {
  let phase = 'intro', readySince = null, loadingSince = null, reason = 'starting', version = 0, signature = null;
  return {
    snapshot: () => ({ phase, readySince, loadingSince, reason, version }),
    wait(cause = 'ended') {
      if (phase !== 'intro') return false;
      phase = 'loading'; loadingSince = now(); reason = cause; version++; return true;
    },
    readiness(ready, cause = 'preparing', nextSignature = null) {
      if (phase === 'done') return;
      if (!ready) {
        readySince = null; reason = cause;
        if (phase === 'revealing') { phase = 'loading'; version++; }
      } else if (readySince === null || signature !== nextSignature) {
        readySince = now();
        if (phase === 'revealing') { phase = 'loading'; version++; }
      }
      signature = nextSignature;
    },
    reveal() {
      if (phase !== 'loading' || readySince === null || now() - readySince < stableMs || now() - loadingSince < minLoadingMs) return false;
      phase = 'revealing'; version++; return true;
    },
    complete(expectedVersion) {
      if (phase !== 'revealing' || version !== expectedVersion || readySince === null) return false;
      phase = 'done'; reason = 'ready'; version++; return true;
    }
  };
}
