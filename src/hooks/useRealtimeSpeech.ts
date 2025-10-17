import { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface AudioRecorderConfig {
  sampleRate: number;
  channelCount: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

const encodeAudioForAPI = (float32Array: Float32Array): string => {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  const uint8Array = new Uint8Array(int16Array.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binary);
};

export const useRealtimeSpeech = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const { toast } = useToast();
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      console.log('🎤 Starting realtime speech recognition...');
      
      // Connect to edge function WebSocket
      const projectId = 'ktlbseweighlrhoxbjii';
      const wsUrl = `wss://${projectId}.supabase.co/functions/v1/realtime-speech`;
      console.log('🔌 Connecting to:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        console.log('✅ WebSocket connected');
        
        try {
          // Start audio capture
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              sampleRate: 24000,
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
          
          streamRef.current = stream;
          
          const audioContext = new AudioContext({ sampleRate: 24000 });
          audioContextRef.current = audioContext;
          
          const source = audioContext.createMediaStreamSource(stream);
          sourceRef.current = source;
          
          const processor = audioContext.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;
          
          processor.onaudioprocess = (e) => {
            if (ws.readyState === WebSocket.OPEN) {
              const inputData = e.inputBuffer.getChannelData(0);
              const base64Audio = encodeAudioForAPI(new Float32Array(inputData));
              
              ws.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: base64Audio
              }));
            }
          };
          
          source.connect(processor);
          processor.connect(audioContext.destination);
          
          setIsRecording(true);
          console.log('🎙️ Recording started');
          
          toast({
            title: "Recording started",
            description: "Speak clearly - words will highlight as you speak",
          });
        } catch (error: any) {
          console.error('❌ Error starting audio:', error);
          toast({
            variant: "destructive",
            title: "Microphone access failed",
            description: "Please allow microphone access and try again.",
          });
          ws.close();
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 Received:', data.type);
          
          if (data.type === 'conversation.item.input_audio_transcription.completed') {
            const text = data.transcript;
            console.log('📝 Transcription:', text);
            setTranscription(prev => prev + ' ' + text);
          }
        } catch (error) {
          console.error('❌ Error parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        toast({
          variant: "destructive",
          title: "Connection error",
          description: "Failed to connect to speech service.",
        });
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket closed');
        stopRecording();
      };

    } catch (error: any) {
      console.error('💥 Error starting recording:', error);
      toast({
        variant: "destructive",
        title: "Recording failed",
        description: error.message || "Failed to start recording.",
      });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    console.log('🛑 Stopping recording...');
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsRecording(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording();
      }
    };
  }, [isRecording, stopRecording]);

  return {
    isRecording,
    transcription,
    startRecording,
    stopRecording,
  };
};
