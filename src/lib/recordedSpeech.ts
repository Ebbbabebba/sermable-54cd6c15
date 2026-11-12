import { supabase } from '@/integrations/supabase/client';
import { ANALYSIS_TIMEOUT_MS, analysisSchema, validateEvidence } from './feedbackContract';
import type { RecordingDraft } from './recordingDraft';

export async function analyzeRecording(draft: RecordingDraft) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);
  try {
    const buffer = new Uint8Array(await draft.blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < buffer.length; i += 8192) binary += String.fromCharCode(...buffer.subarray(i, i + 8192));
    const transcription = await supabase.functions.invoke('whisper-stream', {
      body: { audio: btoa(binary), mimeType: draft.blob.type, language: draft.language.split(/[-_]/)[0] }, signal: controller.signal,
    });
    if (transcription.error || !transcription.data?.transcript?.trim()) throw new Error('Inget tal kunde transkriberas. Inspelningen finns kvar.');
    const response = await supabase.functions.invoke('analyze-presentation', {
      body: { transcript: transcription.data.transcript, segments: transcription.data.segments ?? [],
        originalText: draft.originalText, durationSeconds: draft.durationSeconds, pauses: draft.pauses }, signal: controller.signal,
    });
    if (response.error) throw new Error('Analysen kunde inte slutföras. Inspelningen finns kvar.');
    return validateEvidence(analysisSchema.parse(response.data));
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Analysen tog mer än 20 sekunder. Inspelningen finns kvar.');
    throw error;
  } finally { clearTimeout(timer); }
}

/** Detect silence from the captured audio, not time spent waiting for target words. */
export function measurePauses(stream: MediaStream) {
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser(); analyser.fftSize = 1024; source.connect(analyser);
  const samples = new Float32Array(analyser.fftSize); const start = performance.now();
  const pauses: {start: number; duration: number}[] = []; let quietSince: number | null = null;
  const sample = () => {
    analyser.getFloatTimeDomainData(samples);
    const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
    const now = (performance.now() - start) / 1000;
    if (rms < 0.015) { quietSince ??= now; }
    else if (quietSince !== null) { if (now - quietSince >= 0.6) pauses.push({start: quietSince, duration: now - quietSince}); quietSince = null; }
  };
  void context.resume(); const timer = setInterval(sample, 50);
  return () => { clearInterval(timer); sample();
    const now = (performance.now() - start) / 1000;
    if (quietSince !== null && now - quietSince >= 0.6) pauses.push({start: quietSince, duration: now - quietSince});
    source.disconnect(); void context.close(); return pauses;
  };
}