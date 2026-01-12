import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Circle, CircleSlash, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface AudioRecorderHandle {
  getCurrentAudioBlob: () => Blob | null;
  getNewChunks: (lastIndex: number) => { chunks: Blob[], currentIndex: number } | null;
  getCurrentFormat: () => string;
  stopRecording: () => void;
  startRecording: () => void;
}

interface AudioRecorderProps {
  isRecording: boolean;
  onStart: () => void;
  onStop: (audioBlob: Blob) => void;
  disabled?: boolean;
}

const AudioRecorder = forwardRef<AudioRecorderHandle, AudioRecorderProps>(
  ({ isRecording, onStart, onStop, disabled }, ref) => {
    const { toast } = useToast();
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const [recordingTime, setRecordingTime] = useState(0);
    const timerRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
      if (isRecording) {
        timerRef.current = window.setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      } else {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setRecordingTime(0);
      }

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }, [isRecording]);

    const mimeTypeRef = useRef<string>('audio/webm');

    const getCurrentAudioBlob = () => {
      if (chunksRef.current.length > 0) {
        return new Blob(chunksRef.current, { type: mimeTypeRef.current });
      }
      return null;
    };

    const getNewChunks = (lastIndex: number) => {
      if (chunksRef.current.length > lastIndex) {
        const newChunks = chunksRef.current.slice(lastIndex);
        return {
          chunks: newChunks,
          currentIndex: chunksRef.current.length
        };
      }
      return null;
    };

    useImperativeHandle(ref, () => ({
      getCurrentAudioBlob,
      getNewChunks,
      getCurrentFormat: () => mimeTypeRef.current,
      stopRecording: () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          console.log('Stopping recording via ref...');
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current = null;
        }
      },
      startRecording: async () => {
        await startRecording();
      }
    }));

    const startRecording = async () => {
      try {
        // Check if microphone permission is already granted
        if (navigator.permissions) {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          
          if (permissionStatus.state === 'denied') {
            toast({
              variant: "destructive",
              title: "Microphone access denied",
              description: "Please enable microphone access in your browser settings to record your practice.",
            });
            return;
          }
        }

        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            sampleRate: 24000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        });

        streamRef.current = stream;

        // Detect iOS/iPad and use compatible format
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        
        // Choose MIME type based on browser support
        let mimeType = 'audio/webm';
        if (isIOS) {
          // iOS Safari supports mp4 better
          if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
          } else if (MediaRecorder.isTypeSupported('audio/aac')) {
            mimeType = 'audio/aac';
          } else if (MediaRecorder.isTypeSupported('audio/mpeg')) {
            mimeType = 'audio/mpeg';
          }
        }
        
        mimeTypeRef.current = mimeType;
        console.log('Using audio format:', mimeType);

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: mimeType,
        });

        chunksRef.current = [];

        // Stream audio in 200ms chunks for faster real-time processing
        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunksRef.current.push(event.data);
            console.log(`Audio chunk received: ${event.data.size} bytes, total chunks: ${chunksRef.current.length}`);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
          console.log(`Recording stopped. Total audio size: ${audioBlob.size} bytes (${mimeTypeRef.current}) from ${chunksRef.current.length} chunks`);
          onStop(audioBlob);
          
          // Stop all tracks
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
        };

        // Start recording with 200ms chunks for faster streaming
        mediaRecorder.start(200);
        mediaRecorderRef.current = mediaRecorder;
        onStart();

        console.log('Recording started with streaming chunks (200ms intervals)');
        toast({
          title: "Recording started",
          description: "Speak clearly into your microphone",
        });
      } catch (error: any) {
        console.error('Error starting recording:', error);
        
        let errorMessage = "Please allow microphone access to record your practice.";
        
        if (error.name === 'NotAllowedError') {
          errorMessage = "Microphone access was denied. Please enable it in your browser settings.";
        } else if (error.name === 'NotFoundError') {
          errorMessage = "No microphone found. Please connect a microphone and try again.";
        } else if (error.name === 'NotReadableError') {
          errorMessage = "Your microphone is already in use by another application.";
        }
        
        toast({
          variant: "destructive",
          title: "Microphone access error",
          description: errorMessage,
        });
      }
    };

    const stopRecording = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        console.log('Stopping recording...');
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
    };

    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
      <div className="flex flex-col items-center gap-4">
        <Button
          size="lg"
          variant={isRecording ? "destructive" : "default"}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled}
          className="w-48"
        >
          {disabled ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Processing...
            </>
          ) : isRecording ? (
            <>
              <CircleSlash className="h-5 w-5 mr-2" />
              Stop Recording
            </>
          ) : (
            <>
              <Circle className="h-5 w-5 mr-2 fill-current" />
              Start Recording
            </>
          )}
        </Button>

        {isRecording && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-destructive animate-pulse"></div>
            Recording: {formatTime(recordingTime)}
          </div>
        )}
      </div>
    );
  }
);

AudioRecorder.displayName = "AudioRecorder";

export default AudioRecorder;
