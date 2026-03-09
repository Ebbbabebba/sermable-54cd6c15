import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { originalText, transcript, language } = await req.json();
    
    if (!originalText || !transcript) {
      return new Response(JSON.stringify({ error: 'originalText and transcript are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a speech memorization coach analyzing how well a user retold a text passage from memory.

CRITICAL SCORING RULES:
- The score should reflect how well the user captured the CORE MEANING and IDEAS of the original text, NOT just whether they mentioned specific keywords.
- Keywords/reference words are only memory aids — they should NOT determine the score.
- A perfect score (100%) requires the user to convey ALL the main ideas, in roughly the correct order, with appropriate detail and nuance.
- Simply mentioning keywords without conveying the actual meaning should score LOW (30-50%).
- Conveying the meaning accurately in different words should score HIGH (80-90%).
- Missing entire ideas or concepts should significantly reduce the score.

Evaluate these dimensions:
1. **Meaning coverage** (most important): Did they convey the core ideas and message? Did they capture nuances, not just surface-level keywords?
2. **Order accuracy**: Did they retell the ideas in the correct sequence?
3. **Detail & completeness**: Did they include important details, names, numbers, and specifics from the original?
4. **Key word accuracy**: Did they use the specific important terms from the original? (This is supplementary, not primary.)

Be encouraging but honest. The language is: ${language || 'auto-detect'}.
Give feedback in the same language as the original text.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `ORIGINAL TEXT:\n${originalText}\n\nUSER'S RETELLING:\n${transcript}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_retelling",
              description: "Return analysis of how well the user retold the text",
              parameters: {
                type: "object",
                properties: {
                  score: { type: "number", description: "Overall score 0-100 based primarily on meaning coverage, NOT keyword matching. 100% = perfect meaning recreation with all nuances. Mentioning only keywords without meaning = 30-50%." },
                  content_coverage: { type: "number", description: "How much of the MEANING and IDEAS were conveyed 0-100, not just keywords" },
                  order_accuracy: { type: "number", description: "How well the sequence of ideas was maintained 0-100" },
                  key_words_hit: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Important words/phrases from original that user included" 
                  },
                  key_words_missed: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Important words/phrases from original that user missed" 
                  },
                  feedback: { type: "string", description: "Short encouraging feedback (1-2 sentences)" },
                },
                required: ["score", "content_coverage", "order_accuracy", "key_words_hit", "key_words_missed", "feedback"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_retelling" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("No tool call in response");
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
