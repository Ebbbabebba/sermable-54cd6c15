import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AudioRecorderProps {
  isRecording: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
}

const AudioRecorder = ({ isRecording, onStart, onStop, disabled }: AudioRecorderProps) => {
  const { toast } = useToast();

  const startRecording = () => {
    onStart();
    toast({
      title: "Recording started",
      description: "Speak clearly - your browser is listening",
    });
  };

  const stopRecording = () => {
    onStop();
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
            <MicOff className="h-5 w-5 mr-2" />
            Stop Recording
          </>
        ) : (
          <>
            <Mic className="h-5 w-5 mr-2" />
            Start Recording
          </>
        )}
      </Button>

      {isRecording && (
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-destructive animate-pulse"></div>
          <span className="text-sm font-medium text-muted-foreground">Listening...</span>
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;
