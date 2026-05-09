Plan:

1. Remove the remaining hidden-word “fail-open” behavior in `BeatPracticeView.tsx`.
   - A hidden word should only advance when the spoken token actually matches that hidden word, or when the user clearly says the next real word via the controlled 1-word lookahead.
   - It should not mark a hidden word as spoken just because recognition heard unrelated speech/noise.

2. Tighten lookahead so it cannot jump through hidden words.
   - Keep small recovery for visible/lenient words.
   - Prevent lookahead from skipping a strict hidden current word unless the next spoken word is clearly matched and only one position ahead.

3. Keep the timeout fallback but make it non-cascading.
   - If a hidden word times out after hesitation, advance at most one word and do not replay old transcript in a way that can immediately skip the next hidden word.

4. Validate the behavior in the practice flow:
   - Hidden words stay active until matched or timeout.
   - Saying unrelated words does not advance hidden words.
   - Visible words still react quickly.
   - The cursor no longer jumps over multiple hidden words or entire beats.