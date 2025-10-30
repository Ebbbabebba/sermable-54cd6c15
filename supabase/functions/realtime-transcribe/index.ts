import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { headers } = req;
    const upgradeHeader = headers.get("upgrade") || "";

    if (upgradeHeader.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket connection", { status: 400 });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    
    const openAISocket = new WebSocket(
      "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
      {
        headers: {
          "Authorization": `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          "OpenAI-Beta": "realtime=v1"
        }
      }
    );

    let sessionConfigured = false;

    openAISocket.onopen = () => {
      console.log("Connected to OpenAI Realtime API");
    };

    openAISocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Received from OpenAI:", data.type);

      // Configure session after connection
      if (data.type === 'session.created' && !sessionConfigured) {
        sessionConfigured = true;
        openAISocket.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ["text"],
            input_audio_format: "pcm16",
            input_audio_transcription: {
              model: "whisper-1"
            },
            turn_detection: null // Manual turn detection
          }
        }));
      }

      // Forward transcription events to client
      if (data.type === 'conversation.item.input_audio_transcription.completed') {
        socket.send(JSON.stringify({
          type: 'transcription',
          text: data.transcript,
          isFinal: true
        }));
      }

      if (data.type === 'input_audio_buffer.speech_started') {
        socket.send(JSON.stringify({
          type: 'speech_started'
        }));
      }

      if (data.type === 'input_audio_buffer.speech_stopped') {
        socket.send(JSON.stringify({
          type: 'speech_stopped'
        }));
      }

      // Forward errors
      if (data.type === 'error') {
        console.error("OpenAI error:", data);
        socket.send(JSON.stringify({
          type: 'error',
          message: data.error?.message || 'Unknown error'
        }));
      }
    };

    openAISocket.onerror = (error) => {
      console.error("OpenAI WebSocket error:", error);
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Connection to transcription service failed'
      }));
    };

    openAISocket.onclose = () => {
      console.log("OpenAI connection closed");
      socket.close();
    };

    // Handle messages from client
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'audio_chunk') {
        // Forward audio to OpenAI
        openAISocket.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: data.audio
        }));
      }

      if (data.type === 'commit_audio') {
        // Commit the audio buffer for transcription
        openAISocket.send(JSON.stringify({
          type: 'input_audio_buffer.commit'
        }));
        openAISocket.send(JSON.stringify({
          type: 'response.create',
          response: {
            modalities: ["text"]
          }
        }));
      }
    };

    socket.onclose = () => {
      console.log("Client disconnected");
      openAISocket.close();
    };

    return response;

  } catch (error) {
    console.error('Error in realtime-transcribe function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
