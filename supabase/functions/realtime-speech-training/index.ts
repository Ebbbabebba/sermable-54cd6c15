import "https://deno.land/x/xhr@0.1.0/mod.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

Deno.serve(async (req) => {
  // Handle WebSocket upgrade
  if (req.headers.get("upgrade") !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 426 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

  let openaiWs: WebSocket | null = null;
  let audioBuffer: string[] = [];
  let isProcessing = false;

  socket.onopen = () => {
    console.log("Client connected");
    
    // Connect to OpenAI Realtime API
    openaiWs = new WebSocket(
      "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
      {
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "OpenAI-Beta": "realtime=v1",
        },
      }
    );

    openaiWs.onopen = () => {
      console.log("Connected to OpenAI");
    };

    openaiWs.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      console.log("OpenAI event:", data.type);

      // Configure session after connection
      if (data.type === 'session.created') {
        openaiWs?.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['audio', 'text'],
            instructions: 'You are a speech transcription assistant. Transcribe the user speech accurately with word-level timing.',
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1'
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 1000
            },
            temperature: 0.8,
          }
        }));
      }

      // Handle interim transcription
      if (data.type === 'conversation.item.input_audio_transcription.completed') {
        const words = data.transcript.split(/\s+/);
        socket.send(JSON.stringify({
          type: 'transcription_interim',
          words: words,
        }));
      }

      // Handle final transcription
      if (data.type === 'response.audio_transcript.done') {
        const words = data.transcript.split(/\s+/);
        socket.send(JSON.stringify({
          type: 'transcription_final',
          words: words,
        }));
      }

      // Handle input audio buffer events
      if (data.type === 'input_audio_buffer.speech_stopped') {
        console.log("Speech stopped detected");
      }
    };

    openaiWs.onerror = (error) => {
      console.error("OpenAI WebSocket error:", error);
      socket.send(JSON.stringify({
        type: 'error',
        message: 'OpenAI connection error'
      }));
    };

    openaiWs.onclose = () => {
      console.log("OpenAI connection closed");
    };
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    // Forward audio data to OpenAI
    if (data.type === 'audio' && openaiWs?.readyState === WebSocket.OPEN) {
      openaiWs.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: data.audio
      }));
    }

    // Handle stop command
    if (data.type === 'stop' && openaiWs?.readyState === WebSocket.OPEN) {
      openaiWs.send(JSON.stringify({
        type: 'input_audio_buffer.commit'
      }));
      openaiWs.send(JSON.stringify({
        type: 'response.create'
      }));
    }
  };

  socket.onerror = (error) => {
    console.error("Client WebSocket error:", error);
  };

  socket.onclose = () => {
    console.log("Client disconnected");
    if (openaiWs?.readyState === WebSocket.OPEN) {
      openaiWs.close();
    }
  };

  return response;
});
