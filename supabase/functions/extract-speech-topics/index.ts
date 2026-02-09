import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ExtractedTopic {
  topic_order: number;
  topic_title: string;
  key_points: string[];
  key_words: string[];
  key_numbers: string[];
  original_section: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { speechId, speechText, speechLanguage } = await req.json();
    
    if (!speechId || !speechText) {
      throw new Error("speechId and speechText are required");
    }

    console.log(`📚 Extracting structured topics for speech ${speechId}, language: ${speechLanguage || 'en'}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const isSwedish = speechLanguage === 'sv';
    
    const systemPrompt = isSwedish
      ? `Du är en expert på att analysera tal och extrahera strukturerade stödord. Din uppgift är att dela upp talet i logiska avsnitt och för varje avsnitt extrahera nyckelord och nyckeltal. Svara ENDAST med valid JSON.`
      : `You are an expert at analyzing speeches and extracting structured support elements. Your task is to divide the speech into logical sections and for each section extract key words and key numbers. Respond ONLY with valid JSON.`;

    const userPrompt = isSwedish
      ? `Analysera följande tal och dela upp det i 3-6 logiska avsnitt (t.ex. Inledning, Argument, Avslutning).

För varje avsnitt, extrahera:

1. **key_words** (4-7 st): Korta stödord som representerar kärninnehållet. Enstaka ord eller korta begrepp. VIKTIGT: Returnera dem i den ordning de förekommer i taltexten.
2. **key_numbers** (0-4 st): Viktiga siffror, statistik, datum eller faktaankare. Inkludera enheten. Lämna tom array om inga siffror finns.
3. **key_points** (2-4 st): Sammanfattande punkter om vad avsnittet handlar om.

Talet:
"""
${speechText}
"""

Svara med detta exakta JSON-format:
{
  "topics": [
    {
      "topic_order": 1,
      "topic_title": "Avsnittstitel",
      "key_words": ["stödord1", "stödord2", "stödord3", "stödord4"],
      "key_numbers": ["1.5°C-gränsen", "2030-målet"],
      "key_points": ["Sammanfattande punkt 1", "Sammanfattande punkt 2"],
      "original_section": "Exakt text från talet..."
    }
  ]
}`
      : `Analyze the following speech and divide it into 3-6 logical sections (e.g., Introduction, Argument, Conclusion).

For each section, extract:

1. **key_words** (4-7 items): Short support words representing the core content. Single words or short concepts. IMPORTANT: Return them in the order they appear in the speech text.
2. **key_numbers** (0-4 items): Important statistics, dates, or factual anchors. Include the unit. Leave as empty array if no numbers exist.
3. **key_points** (2-4 items): Summary points about what the section covers.

The speech:
"""
${speechText}
"""

Respond with this exact JSON format:
{
  "topics": [
    {
      "topic_order": 1,
      "topic_title": "Section title",
      "key_words": ["keyword1", "keyword2", "keyword3", "keyword4"],
      "key_numbers": ["1.5°C threshold", "2030 target"],
      "key_points": ["Summary point 1", "Summary point 2"],
      "original_section": "The exact text from the speech..."
    }
  ]
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log("📝 AI response received, parsing...");

    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    let parsed: { topics: ExtractedTopic[] };
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse AI response as JSON:", jsonStr);
      throw new Error("Failed to parse AI response");
    }

    if (!parsed.topics || !Array.isArray(parsed.topics)) {
      throw new Error("Invalid topics structure in AI response");
    }

    console.log(`✅ Extracted ${parsed.topics.length} topics with structured data`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Delete existing topics for this speech
    await supabase
      .from("overview_topics")
      .delete()
      .eq("speech_id", speechId);

    // Insert new topics with structured data
    const topicsToInsert = parsed.topics.map((topic, index) => ({
      speech_id: speechId,
      topic_order: topic.topic_order || index + 1,
      topic_title: topic.topic_title,
      key_points: topic.key_points || [],
      key_words: topic.key_words || [],
      key_numbers: topic.key_numbers || [],
      key_phrases: [],
      original_section: topic.original_section,
      is_mastered: false,
      practice_count: 0,
    }));

    const { data: insertedTopics, error: insertError } = await supabase
      .from("overview_topics")
      .insert(topicsToInsert)
      .select();

    if (insertError) {
      console.error("Error inserting topics:", insertError);
      throw new Error(`Failed to save topics: ${insertError.message}`);
    }

    console.log(`💾 Saved ${insertedTopics?.length} structured topics to database`);

    return new Response(JSON.stringify({ 
      success: true, 
      topics: insertedTopics 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("extract-speech-topics error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
