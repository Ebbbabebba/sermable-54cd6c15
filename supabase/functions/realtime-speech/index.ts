import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    console.log('🔌 Establishing WebSocket connection to OpenAI Realtime API...');

    // Create WebSocket connection to OpenAI
    const openaiWs = new WebSocket(
      'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01',
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      }
    );

    // Upgrade client connection to WebSocket
    const { socket, response } = Deno.upgradeWebSocket(req);

    let sessionConfigured = false;

    openaiWs.onopen = () => {
      console.log('✅ Connected to OpenAI Realtime API');
    };

    openaiWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 OpenAI event:', data.type);

        // Configure session after creation
        if (data.type === 'session.created' && !sessionConfigured) {
          console.log('🔧 Configuring session...');
          sessionConfigured = true;
          
          const sessionUpdate = {
            type: 'session.update',
            session: {
              modalities: ['text', 'audio'],
              instructions: 'You are a helpful speech transcription assistant. Only transcribe what the user says, do not respond or comment.',
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
                silence_duration_ms: 500
              },
              temperature: 0.8,
            }
          };
          
          openaiWs.send(JSON.stringify(sessionUpdate));
          console.log('✅ Session configured');
        }

        // Forward all events to client
        socket.send(JSON.stringify(data));
      } catch (error) {
        console.error('❌ Error processing OpenAI message:', error);
      }
    };

    openaiWs.onerror = (error) => {
      console.error('❌ OpenAI WebSocket error:', error);
      socket.send(JSON.stringify({ 
        type: 'error', 
        error: 'OpenAI connection error' 
      }));
    };

    openaiWs.onclose = () => {
      console.log('🔌 OpenAI connection closed');
      socket.close();
    };

    // Handle messages from client
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📤 Client event:', data.type);
        
        // Forward to OpenAI
        openaiWs.send(event.data);
      } catch (error) {
        console.error('❌ Error processing client message:', error);
      }
    };

    socket.onclose = () => {
      console.log('🔌 Client connection closed');
      openaiWs.close();
    };

    socket.onerror = (error) => {
      console.error('❌ Client WebSocket error:', error);
    };

    return response;
  } catch (error) {
    console.error('❌ Error in realtime-speech function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
