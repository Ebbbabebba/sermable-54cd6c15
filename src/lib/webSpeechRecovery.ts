// Browser engines routinely end after silence; only actual engine errors
// consume retries. Keep explicit pause-marker delays in the caller.
export function createWebSpeechRecovery() {
  let failures = 0;
  return {
    reset: () => { failures = 0; },
    error: (code: string) => {
      if (code === 'no-speech') {
        failures = 0;
        return false;
      }
      if (['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'].includes(code)) {
        return true;
      }
      failures++;
      return false;
    },
    exhausted: () => failures > 5,
    delay: () => failures === 0 ? 0 : Math.min(4000, 700 * 2 ** (failures - 1)),
  };
}