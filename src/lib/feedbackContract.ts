import { z } from 'zod';

export const ANALYSIS_TIMEOUT_MS = 20_000;
const factualText = z.string().trim().min(1).max(600).refine(value =>
  !/bra jobbat|fantastiskt jobbat|grattis|\p{Extended_Pictographic}/iu.test(value), 'Ogrundat beröm eller emoji');
export const feedbackSchema = z.object({
  summary: factualText.refine(value => (value.match(/[.!?](?:\s|$)/g) ?? []).length <= 1, 'En mening krävs'),
  tips: z.array(z.object({ text: factualText, quote: z.string().max(200).nullable(), atSeconds: z.number().nonnegative().nullable() }).strict()
    .refine(tip => Boolean(tip.quote) || tip.atSeconds !== null, 'Tipset behöver belägg')).max(3),
  positive: factualText,
}).strict();
export type SpeechFeedback = z.infer<typeof feedbackSchema>;
export const metricsSchema = z.object({
  durationSeconds: z.number().positive(), wordsPerMinute: z.number().nonnegative(),
  wordCount: z.number().int().nonnegative(),
  fillers: z.array(z.object({ word: z.string(), atSeconds: z.number().nonnegative().nullable() })),
  pauses: z.array(z.object({ start: z.number().nonnegative(), duration: z.number().nonnegative() })),
});
export const analysisSchema = z.object({ transcript: z.string().min(1), metrics: metricsSchema, feedback: feedbackSchema });
export type SpeechAnalysis = z.infer<typeof analysisSchema>;
export function validateEvidence(result: SpeechAnalysis) {
  for (const tip of result.feedback.tips) {
    if (tip.quote && !result.transcript.toLocaleLowerCase('sv').includes(tip.quote.toLocaleLowerCase('sv'))) throw new Error('Citatet saknas i transkriberingen');
    if (tip.atSeconds !== null && tip.atSeconds > result.metrics.durationSeconds) throw new Error('Tidpunkten ligger utanför inspelningen');
    if (tip.quote && !tip.text.toLocaleLowerCase('sv').includes(tip.quote.toLocaleLowerCase('sv'))) throw new Error('Tipset måste ange citatet');
  }
  if (result.metrics.pauses.some(pause => pause.start + pause.duration > result.metrics.durationSeconds + 0.2)) throw new Error('Pausen ligger utanför inspelningen');
  if (result.metrics.fillers.some(filler => filler.atSeconds !== null && filler.atSeconds > result.metrics.durationSeconds)) throw new Error('Utfyllnadsordets tidpunkt ligger utanför inspelningen');
  return result;
}
export const timeLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;