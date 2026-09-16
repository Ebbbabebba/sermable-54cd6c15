import { useEffect, useRef, useState } from "react";
import { requestMicrophoneAccess } from "@/utils/microphone";

const ANALYSIS_INTERVAL_MS = 150;
const NOISE_FLOOR = 0.015;
const TOO_QUIET_THRESHOLD = 0.025;
const LOW_DURATION_MS = 4000;
const SILENCE_RESET_MS = 800;

export function useMicrophoneLevel(isRecording: boolean) {
  // Level is kept in a ref: it changes ~7x/second and used to re-render the
  // whole practice/presentation view, which caused visible stutter.
  const levelRef = useRef(0);
  const [isTooLow, setIsTooLow] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lowStartRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRecording) {
      setIsTooLow(false);
      levelRef.current = 0;
      lowStartRef.current = null;
      silenceStartRef.current = null;
      return;
    }

    let active = true;

    const start = async () => {
      try {
        const stream = await requestMicrophoneAccess({
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        const AudioContextClass =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.6;
        analyserRef.current = analyser;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const analyze = () => {
          if (!analyserRef.current) return;

          analyserRef.current.getByteTimeDomainData(dataArray);

          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            const normalized = (dataArray[i] - 128) / 128;
            sum += normalized * normalized;
          }
          const rms = Math.sqrt(sum / bufferLength);
          levelRef.current = rms;

          const now = Date.now();

          if (rms < NOISE_FLOOR) {
            // Silence — reset the "too quiet" timer and hide the warning quickly.
            lowStartRef.current = null;
            if (silenceStartRef.current === null) {
              silenceStartRef.current = now;
            } else if (now - silenceStartRef.current > SILENCE_RESET_MS) {
              setIsTooLow(false);
            }
          } else {
            silenceStartRef.current = null;

            if (rms < TOO_QUIET_THRESHOLD) {
              if (lowStartRef.current === null) {
                lowStartRef.current = now;
              } else if (now - lowStartRef.current > LOW_DURATION_MS) {
                setIsTooLow(true);
              }
            } else {
              lowStartRef.current = null;
              setIsTooLow(false);
            }
          }

          rafRef.current = setTimeout(analyze, ANALYSIS_INTERVAL_MS);
        };

        analyze();
      } catch (err) {
        // Fail silently — we don't want to block practice if mic analysis fails.
        console.warn("Microphone level monitoring failed:", err);
      }
    };

    start();

    return () => {
      active = false;
      if (rafRef.current) {
        clearTimeout(rafRef.current);
        rafRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        try {
          audioContextRef.current.close();
        } catch (e) {
          // ignore
        }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      audioContextRef.current = null;
      analyserRef.current = null;
    };
  }, [isRecording]);

  return { levelRef, isTooLow };
}
