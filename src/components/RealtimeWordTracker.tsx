import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface RealtimeWordTrackerProps {
  text: string;
  isRecording: boolean;
  onTranscriptUpdate?: (transcript: string) => void;
  className?: string;
  yellowThresholdMs?: number; // default 2000
}

export default function RealtimeWordTracker({
  text,
  isRecording,
  onTranscriptUpdate,
  className,
  yellowThresholdMs = 2000,
}: RealtimeWordTrackerProps) {
  const words = text.trim().split(/\s+/);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [spokenIndexes, setSpokenIndexes] = useState<Set<number>>(new Set()); // past = faded gray
  const [yellowIndexes, setYellowIndexes] = useState<Set<number>>(new Set()); // locked yellow
  const [redIndexes, setRedIndexes] = useState<Set<number>>(new Set()); // locked red

  // start times per index (when word became current)
  const startTimesRef = useRef<number[]>([]);
  const recognitionRef = useRef<any>(null);
  const prevLastWordRef = useRef<string>("");

  // helpers
  const normalize = (s: string) => s.toLowerCase().replace(/[^\wåäö]/g, ""); // keep swedish letters safe but we're using en-US
  const now = () => performance.now();

  // Mark word done (spoken) with elapsed measurement
  function markSpoken(idx: number, elapsedMs: number) {
    // If already locked (yellow/red), do nothing (locked)
    if (yellowIndexes.has(idx) || redIndexes.has(idx)) return;

    if (elapsedMs > yellowThresholdMs) {
      setYellowIndexes((s) => new Set(s).add(idx)); // locked yellow
    } else {
      setSpokenIndexes((s) => new Set(s).add(idx)); // past fade gray
    }
  }

  // Mark a range as red (skipped)
  function markRangeRed(from: number, to: number) {
    setRedIndexes((s) => {
      const n = new Set(s);
      for (let i = from; i <= to; i++) n.add(i);
      return n;
    });
  }

  // Advance to a new current index (set start time)
  function setCurrentAndStamp(nextIdx: number) {
    setCurrentIndex(nextIdx);
    startTimesRef.current[nextIdx] = now();
  }

  // Initialize the very first timestamp
  useEffect(() => {
    startTimesRef.current = [];
    startTimesRef.current[0] = now();
    // reset states when text changes
    setSpokenIndexes(new Set());
    setYellowIndexes(new Set());
    setRedIndexes(new Set());
    setCurrentIndex(0);
    prevLastWordRef.current = "";
  }, [text]);

  // Setup Web Speech API (en-US)
  useEffect(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      console.warn("Speech recognition not supported in this browser.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript + (i < event.results.length - 1 ? " " : "");
      }

      onTranscriptUpdate?.(transcript);

      // Determine last token from transcript (the word user currently saying)
      const tokens = transcript.trim().split(/\s+/).filter(Boolean);
      const lastRaw = tokens.length ? tokens[tokens.length - 1] : "";
      const lastNorm = normalize(lastRaw);

      // If same as previous partial/last, we do nothing
      if (lastNorm === prevLastWordRef.current) return;
      prevLastWordRef.current = lastNorm;

      // If there's no valid last token, do nothing
      if (!lastNorm) return;

      // Try to find a matching word index for lastNorm among future words
      // Search from currentIndex to a bit further (allow some lookahead)
      let foundIdx = -1;
      for (let i = currentIndex; i < words.length; i++) {
        if (normalize(words[i]) === lastNorm) {
          foundIdx = i;
          break;
        }
      }

      const tNow = now();

      if (foundIdx === -1) {
        // last spoken word doesn't match any expected future word — ignore for now
        return;
      }

      // Case 1: user is still on the current word (foundIdx === currentIndex) -> just update (no completion)
      if (foundIdx === currentIndex) {
        // nothing to complete yet; the user is saying the current word
        return;
      }

      // Case 2: user started saying a future word 'foundIdx' -> that means all words before foundIdx are "completed" at this moment
      // The one immediately before foundIdx (foundIdx - 1) is considered completed by starting foundIdx.
      // For simplicity: if foundIdx === currentIndex + 1 -> normal flow (complete currentIndex)
      // If foundIdx > currentIndex + 1 -> user skipped some words -> mark skipped ones red (locked)

      if (foundIdx > currentIndex + 1) {
        // mark everything from currentIndex to foundIdx - 1 as RED (skipped)
        markRangeRed(currentIndex, foundIdx - 1);
      } else {
        // foundIdx === currentIndex + 1 -> normal completion of currentIndex
        // compute elapsed for the word that is now finishing (currentIndex)
        const start = startTimesRef.current[currentIndex] ?? tNow;
        const elapsed = tNow - start;
        markSpoken(currentIndex, elapsed);
      }

      // Set the new current to foundIdx (because user started saying it)
      setCurrentAndStamp(foundIdx);
    };

    recognition.onerror = (e: any) => {
      // log but do not crash
      console.error("Speech recognition error:", e.error ?? e);
    };

    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.stop();
      } catch {}
    };
  }, [currentIndex, words, yellowThresholdMs]); // re-create handler when currentIndex changes

  // control start/stop recording
  useEffect(() => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      // reset prev last partial so first partial registers
      prevLastWordRef.current = "";
      try {
        recognitionRef.current.start();
      } catch {}
    } else {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
  }, [isRecording]);

  // style resolution
  const getStyle = (i: number) => {
    if (i === currentIndex) {
      // current pulsing gray
      return "animate-pulse font-semibold text-gray-900 dark:text-gray-200";
    }
    if (yellowIndexes.has(i)) {
      return "border-b-2 border-yellow-400 font-semibold text-gray-900 dark:text-gray-200";
    }
    if (redIndexes.has(i)) {
      return "border-b-2 border-red-500 font-semibold text-gray-900 dark:text-gray-200";
    }
    if (spokenIndexes.has(i)) {
      return "opacity-40 text-gray-500 dark:text-gray-400";
    }
    // not yet spoken
    return "text-gray-700 dark:text-gray-300";
  };

  return (
    <div className={cn("prose prose-lg max-w-none leading-relaxed", className)}>
      {words.map((w, i) => (
        <span key={i} className={cn("inline-block px-[2px] transition-all duration-200", getStyle(i))}>
          {w}
          {i < words.length - 1 && " "}
        </span>
      ))}
    </div>
  );
}
