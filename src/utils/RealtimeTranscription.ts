export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(private onAudioData: (audioData: Float32Array) => void) {}

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      this.audioContext = new AudioContext({
        sampleRate: 24000,
      });
      
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        this.onAudioData(new Float32Array(inputData));
      };
      
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }

  stop() {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export const encodeAudioForAPI = (float32Array: Float32Array): string => {
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

export class RealtimeTranscriber {
  private ws: WebSocket | null = null;
  private recorder: AudioRecorder | null = null;
  private audioQueue: string[] = [];
  private isCommitting = false;

  constructor(
    private onTranscript: (text: string) => void,
    private onError: (error: string) => void
  ) {}

  async connect() {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'ktlbseweighlrhoxbjii';
    const wsUrl = `wss://${projectId}.supabase.co/functions/v1/realtime-transcribe`;
    
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('Connected to transcription service');
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Received:', data);

      if (data.type === 'transcription') {
        this.onTranscript(data.text);
      } else if (data.type === 'error') {
        this.onError(data.message);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.onError('Connection error');
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed');
    };

    // Wait for connection
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
      if (this.ws) {
        this.ws.addEventListener('open', () => {
          clearTimeout(timeout);
          resolve(null);
        });
        this.ws.addEventListener('error', () => {
          clearTimeout(timeout);
          reject(new Error('Connection failed'));
        });
      }
    });
  }

  async startRecording() {
    this.recorder = new AudioRecorder((audioData) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        const encoded = encodeAudioForAPI(audioData);
        this.audioQueue.push(encoded);
        
        // Send audio chunk
        this.ws.send(JSON.stringify({
          type: 'audio_chunk',
          audio: encoded
        }));

        // Commit audio every 1 second for continuous transcription
        if (this.audioQueue.length >= 24 && !this.isCommitting) {
          this.isCommitting = true;
          this.ws.send(JSON.stringify({
            type: 'commit_audio'
          }));
          this.audioQueue = [];
          setTimeout(() => {
            this.isCommitting = false;
          }, 1000);
        }
      }
    });

    await this.recorder.start();
  }

  stopRecording() {
    if (this.recorder) {
      this.recorder.stop();
      this.recorder = null;
    }

    // Final commit
    if (this.ws?.readyState === WebSocket.OPEN && this.audioQueue.length > 0) {
      this.ws.send(JSON.stringify({
        type: 'commit_audio'
      }));
      this.audioQueue = [];
    }
  }

  disconnect() {
    this.stopRecording();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
