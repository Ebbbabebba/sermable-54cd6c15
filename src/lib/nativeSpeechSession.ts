type Listener = { remove: () => Promise<void> };
type Plugin = {
  start: (options: { language: string; maxResults: number; partialResults: boolean; popup: boolean }) => Promise<{ matches?: string[] } | void>;
  stop: () => Promise<void>;
  isListening: () => Promise<{ listening: boolean }>;
  addListener: (event: 'partialResults' | 'listeningState', callback: (data: { matches?: string[]; status?: string }) => void) => Promise<Listener>;
};

// One restart owner: a native end event and a rejected start can describe the
// same failure. Never let both open another audio session.
export async function createNativeSpeechSession(plugin: Plugin, options: {
  language: string;
  choose: (matches: string[]) => string;
  onTranscript: (text: string) => void;
  onReady: (ready: boolean) => void;
  onError: (error: unknown) => void;
}) {
  let disposed = false;
  let starting = false;
  let listening = false;
  let failures = 0;
  let generation = 0;
  let restartTimer: ReturnType<typeof setTimeout> | undefined;
  let finals = '';
  let interim = '';
  let baseline: string[] = [];
  const handles: Listener[] = [];

  const receive = (matches: string[]) => {
    if (disposed || !matches.length) return;
    const text = options.choose(matches);
    const tokens = text.trim().split(/\s+/);
    // Native partials contain the entire utterance even after a lesson reset.
    // Drop its already-seen prefix instead of replaying the previous sentence.
    const prefixMatches = baseline.every((token, i) => tokens[i] === token);
    if (!prefixMatches) baseline = [];
    interim = tokens.slice(baseline.length).join(' ');
    const combined = `${finals} ${interim}`.trim();
    if (combined) options.onTranscript(combined);
  };

  const scheduleRestart = () => {
    if (disposed || restartTimer) return;
    if (++failures > 5) {
      void stop().finally(() => options.onError(new Error('Native speech repeatedly stopped')));
      return;
    }
    restartTimer = setTimeout(() => {
      restartTimer = undefined;
      void start();
    }, Math.min(4000, 700 * 2 ** (failures - 1)));
  };

  const start = async () => {
    if (disposed || starting || listening) return;
    starting = true;
    const token = ++generation;
    try {
      const result = await plugin.start({ language: options.language, maxResults: 5, partialResults: true, popup: false });
      if (disposed || token !== generation) return;
      // The installed iOS plugin resolves start when capture starts, not when
      // dictation finishes. Result/state callbacks remain the source of truth.
      if (result && result.matches?.length) receive(result.matches);
    } catch (error) {
      if (disposed || token !== generation) return;
      // An "already listening" rejection must not stop a healthy microphone.
      const state = await plugin.isListening().catch(() => ({ listening: false }));
      if (disposed || token !== generation) return;
      listening = state.listening;
      options.onReady(listening);
      if (!listening) scheduleRestart();
    } finally {
      if (token === generation) starting = false;
    }
  };

  const stop = async () => {
    if (disposed) return;
    disposed = true;
    generation++;
    if (restartTimer) clearTimeout(restartTimer);
    // Detach before stopping: stopping itself emits another stopped event.
    await Promise.all(handles.map(handle => handle.remove().catch(() => {})));
    await plugin.stop().catch(() => {});
  };

  try {
    handles.push(await plugin.addListener('partialResults', data => {
      if (disposed) return;
      failures = 0;
      receive(data.matches ?? []);
    }));
    handles.push(await plugin.addListener('listeningState', data => {
      if (disposed) return;
      if (data.status === 'started' || data.status === 'listening') {
        listening = true;
        options.onReady(true);
      } else if (data.status === 'stopped') {
        listening = false;
        starting = false;
        generation++;
        options.onReady(false);
        finals = `${finals} ${interim}`.trim();
        interim = '';
        baseline = [];
        scheduleRestart();
      }
    }));
  } catch (error) {
    await stop();
    throw error;
  }

  return {
    start,
    stop,
    clearBuffer: () => {
      baseline = [...baseline, ...interim.split(/\s+/).filter(Boolean)];
      finals = '';
      interim = '';
    },
  };
}