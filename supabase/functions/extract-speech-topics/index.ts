 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };
 
 interface Topic {
   topic_order: number;
   topic_title: string;
   key_points: string[];
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
 
     console.log(`📚 Extracting topics for speech ${speechId}, language: ${speechLanguage || 'en'}`);
 
     const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
     if (!LOVABLE_API_KEY) {
       throw new Error("LOVABLE_API_KEY is not configured");
     }
 
     // Determine prompt language
     const isSwedish = speechLanguage === 'sv';
     
     const systemPrompt = isSwedish
       ? `Du är en expert på att analysera tal och presentationer. Din uppgift är att identifiera huvudämnen i ett tal och extrahera nyckelpoäng för varje ämne. Svara ENDAST med valid JSON.`
       : `You are an expert at analyzing speeches and presentations. Your task is to identify main topics in a speech and extract key talking points for each topic. Respond ONLY with valid JSON.`;
 
     const userPrompt = isSwedish
       ? `Analysera följande tal och identifiera 3-6 huvudämnen/avsnitt. För varje ämne:
 1. Ge en kort, beskrivande titel (max 8 ord)
 2. Extrahera 2-4 nyckelpoänger som talaren måste nämna
 3. Inkludera den exakta textsektionen som ämnet täcker
 
 Talet:
 """
 ${speechText}
 """
 
 Svara med detta exakta JSON-format:
 {
   "topics": [
     {
       "topic_order": 1,
       "topic_title": "Ämnestitel här",
       "key_points": ["Nyckelpoäng 1", "Nyckelpoäng 2", "Nyckelpoäng 3"],
       "original_section": "Exakt text från talet som detta ämne täcker..."
     }
   ]
 }`
       : `Analyze the following speech and identify 3-6 main topics/sections. For each topic:
 1. Provide a concise, descriptive title (max 8 words)
 2. Extract 2-4 key talking points that the speaker must mention
 3. Include the exact text section that the topic covers
 
 The speech:
 """
 ${speechText}
 """
 
 Respond with this exact JSON format:
 {
   "topics": [
     {
       "topic_order": 1,
       "topic_title": "Topic title here",
       "key_points": ["Key point 1", "Key point 2", "Key point 3"],
       "original_section": "The exact text from the speech that this topic covers..."
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
 
     // Extract JSON from response (handle markdown code blocks)
     let jsonStr = content;
     const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
     if (jsonMatch) {
       jsonStr = jsonMatch[1].trim();
     }
 
     let parsed: { topics: Topic[] };
     try {
       parsed = JSON.parse(jsonStr);
     } catch (e) {
       console.error("Failed to parse AI response as JSON:", jsonStr);
       throw new Error("Failed to parse AI response");
     }
 
     if (!parsed.topics || !Array.isArray(parsed.topics)) {
       throw new Error("Invalid topics structure in AI response");
     }
 
     console.log(`✅ Extracted ${parsed.topics.length} topics`);
 
     // Save topics to database
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     // Delete existing topics for this speech
     await supabase
       .from("overview_topics")
       .delete()
       .eq("speech_id", speechId);
 
     // Insert new topics
     const topicsToInsert = parsed.topics.map((topic, index) => ({
       speech_id: speechId,
       topic_order: topic.topic_order || index + 1,
       topic_title: topic.topic_title,
       key_points: topic.key_points,
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
 
     console.log(`💾 Saved ${insertedTopics?.length} topics to database`);
 
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