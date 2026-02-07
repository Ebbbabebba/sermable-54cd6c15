import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SectionData {
  topic_id: string;
  topic_title: string;
  key_words: string[];
  key_numbers: string[];
  key_phrases: string[];
}

interface SectionScore {
  topic_id: string;
  score: number;
  main_idea_captured: boolean;
  key_words_mentioned: string[];
  key_words_missed: string[];
  numbers_mentioned: string[];
  numbers_missed: string[];
  phrases_mentioned: string[];
  phrases_missed: string[];
  feedback: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { speechId, transcription, section, hintLevel } = await req.json();
    
    if (!speechId || !transcription || !section) {
      throw new Error("speechId, transcription, and section are required");
    }

    console.log(`📊 Analyzing section "${section.topic_title}" for speech ${speechId}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const sectionData = section as SectionData;

    const systemPrompt = `You are an expert at evaluating how well a speaker covers a specific section of their speech. Analyze the transcription and determine which key words, numbers, and phrases were mentioned. Be generous with matching - accept synonyms, paraphrasing, and approximate mentions. Respond ONLY with valid JSON.`;

    const userPrompt = `Evaluate the following transcription against the expected section content.

SECTION: "${sectionData.topic_title}"
Expected Key Words: ${JSON.stringify(sectionData.key_words)}
Expected Key Numbers: ${JSON.stringify(sectionData.key_numbers)}
Expected Key Phrases: ${JSON.stringify(sectionData.key_phrases)}

SPEAKER'S TRANSCRIPTION:
"""
${transcription}
"""

Rules for matching:
- A key word is "mentioned" if the speaker used the word, a synonym, or clearly referred to the concept
- A number is "mentioned" if the speaker said the number or a close approximation
- A phrase is "mentioned" if the speaker used the phrase or conveyed the same meaning
- "main_idea_captured" = true if the speaker generally conveyed the section's core message

Respond with this exact JSON format:
{
  "score": 76,
  "main_idea_captured": true,
  "key_words_mentioned": ["word1", "word2"],
  "key_words_missed": ["word3"],
  "numbers_mentioned": ["1.5°C"],
  "numbers_missed": ["2030 target"],
  "phrases_mentioned": [],
  "phrases_missed": ["tipping point"],
  "feedback": "Good coverage of the main idea. You missed mentioning the 2030 target and the phrase 'tipping point'."
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
        return new Response(JSON.stringify({ error: "Rate limits exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
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

    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    let sectionScore: SectionScore;
    try {
      const parsed = JSON.parse(jsonStr);
      sectionScore = {
        topic_id: sectionData.topic_id,
        score: parsed.score || 0,
        main_idea_captured: parsed.main_idea_captured || false,
        key_words_mentioned: parsed.key_words_mentioned || [],
        key_words_missed: parsed.key_words_missed || [],
        numbers_mentioned: parsed.numbers_mentioned || [],
        numbers_missed: parsed.numbers_missed || [],
        phrases_mentioned: parsed.phrases_mentioned || [],
        phrases_missed: parsed.phrases_missed || [],
        feedback: parsed.feedback || "",
      };
    } catch (e) {
      console.error("Failed to parse AI response:", jsonStr);
      throw new Error("Failed to parse AI response");
    }

    console.log(`✅ Section score: ${sectionScore.score}%`);

    // Update topic practice count and coverage score
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: topicData } = await supabase
      .from("overview_topics")
      .select("practice_count")
      .eq("id", sectionData.topic_id)
      .single();

    await supabase
      .from("overview_topics")
      .update({
        practice_count: (topicData?.practice_count || 0) + 1,
        last_coverage_score: sectionScore.score,
      })
      .eq("id", sectionData.topic_id);

    return new Response(JSON.stringify({ 
      success: true, 
      sectionScore,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("analyze-overview-session error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
