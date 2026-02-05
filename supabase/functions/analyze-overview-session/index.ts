 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };
 
 interface Topic {
   id: string;
   topic_order: number;
   topic_title: string;
   key_points: string[];
   original_section: string;
 }
 
 interface AnalysisResult {
   topics_covered: string[];
   topics_partially_covered: string[];
   topics_missed: string[];
   overall_score: number;
   feedback: string;
   suggestions: string;
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
 
     const { speechId, transcription, topics, speechLanguage, hintLevel } = await req.json();
     
     if (!speechId || !transcription || !topics || !Array.isArray(topics)) {
       throw new Error("speechId, transcription, and topics are required");
     }
 
     console.log(`📊 Analyzing overview session for speech ${speechId}`);
     console.log(`📝 Transcription length: ${transcription.length} chars`);
     console.log(`📋 Topics to check: ${topics.length}`);
 
     const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
     if (!LOVABLE_API_KEY) {
       throw new Error("LOVABLE_API_KEY is not configured");
     }
 
     const isSwedish = speechLanguage === 'sv';
 
     const topicsDescription = topics.map((t: Topic) => 
       `Topic ${t.topic_order}: "${t.topic_title}"\nKey points: ${t.key_points.join(", ")}`
     ).join("\n\n");
 
     const systemPrompt = isSwedish
       ? `Du är en expert på att utvärdera hur väl en talare täcker ämnen i sitt tal. Ditt jobb är att analysera en transkription och avgöra vilka ämnen som täcktes väl, delvis eller missades helt. Svara ENDAST med valid JSON.`
       : `You are an expert at evaluating how well a speaker covers topics in their speech. Your job is to analyze a transcription and determine which topics were covered well, partially covered, or missed entirely. Respond ONLY with valid JSON.`;
 
     const userPrompt = isSwedish
       ? `Analysera följande transkription och avgör hur väl talaren täckte varje ämne.
 
 ÄMNEN ATT UTVÄRDERA:
 ${topicsDescription}
 
 TALARENS TRANSKRIPTION:
 """
 ${transcription}
 """
 
 Utvärdera varje ämne:
 - "covered" = talaren nämnde de flesta nyckelpoängerna (behöver inte vara ordagrant)
 - "partially_covered" = talaren nämnde ämnet men missade viktiga poänger
 - "missed" = talaren nämnde inte ämnet alls
 
 Svara med detta exakta JSON-format:
 {
   "topics_covered": ["topic_id_1", "topic_id_2"],
   "topics_partially_covered": ["topic_id_3"],
   "topics_missed": ["topic_id_4"],
   "overall_score": 75,
   "feedback": "Bra jobbat med X och Y. Du missade att nämna Z.",
   "suggestions": "Fokusera på att komma ihåg nyckelpoängerna om Z nästa gång."
 }
 
 Ämnes-ID:n att använda: ${topics.map((t: Topic) => t.id).join(", ")}`
       : `Analyze the following transcription and determine how well the speaker covered each topic.
 
 TOPICS TO EVALUATE:
 ${topicsDescription}
 
 SPEAKER'S TRANSCRIPTION:
 """
 ${transcription}
 """
 
 Evaluate each topic:
 - "covered" = speaker mentioned most key points (doesn't need to be word-for-word)
 - "partially_covered" = speaker mentioned the topic but missed important points
 - "missed" = speaker didn't mention the topic at all
 
 Respond with this exact JSON format:
 {
   "topics_covered": ["topic_id_1", "topic_id_2"],
   "topics_partially_covered": ["topic_id_3"],
   "topics_missed": ["topic_id_4"],
   "overall_score": 75,
   "feedback": "Great job covering X and Y. You missed mentioning Z.",
   "suggestions": "Focus on remembering the key points about Z next time."
 }
 
 Topic IDs to use: ${topics.map((t: Topic) => t.id).join(", ")}`;
 
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
 
     console.log("📝 AI analysis received, parsing...");
 
     // Extract JSON from response
     let jsonStr = content;
     const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
     if (jsonMatch) {
       jsonStr = jsonMatch[1].trim();
     }
 
     let analysis: AnalysisResult;
     try {
       analysis = JSON.parse(jsonStr);
     } catch (e) {
       console.error("Failed to parse AI response as JSON:", jsonStr);
       throw new Error("Failed to parse AI response");
     }
 
     console.log(`✅ Analysis complete. Score: ${analysis.overall_score}%`);
 
     // Get user ID from auth
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     // Get user from JWT
     const token = authHeader.replace("Bearer ", "");
     const { data: { user }, error: userError } = await supabase.auth.getUser(token);
     
     if (userError || !user) {
       throw new Error("Invalid authentication");
     }
 
     // Save session to database
     const { data: session, error: sessionError } = await supabase
       .from("overview_sessions")
       .insert({
         speech_id: speechId,
         user_id: user.id,
         topics_covered: analysis.topics_covered,
         topics_partially_covered: analysis.topics_partially_covered,
         topics_missed: analysis.topics_missed,
         overall_score: analysis.overall_score,
         transcription: transcription,
         ai_feedback: analysis.feedback,
         suggestions: analysis.suggestions,
         hint_level: hintLevel || 1,
       })
       .select()
       .single();
 
     if (sessionError) {
       console.error("Error saving session:", sessionError);
       throw new Error(`Failed to save session: ${sessionError.message}`);
     }
 
     // Update topic practice counts and coverage scores
     for (const topicId of analysis.topics_covered) {
       // Get current practice count and increment
       const { data: topicData } = await supabase
         .from("overview_topics")
         .select("practice_count")
         .eq("id", topicId)
         .single();
       
       await supabase
         .from("overview_topics")
         .update({ 
           practice_count: (topicData?.practice_count || 0) + 1,
           last_coverage_score: 100,
         })
         .eq("id", topicId);
     }
 
     for (const topicId of analysis.topics_partially_covered) {
       await supabase
         .from("overview_topics")
         .update({ 
           last_coverage_score: 50,
         })
         .eq("id", topicId);
     }
 
     for (const topicId of analysis.topics_missed) {
       await supabase
         .from("overview_topics")
         .update({ 
           last_coverage_score: 0,
         })
         .eq("id", topicId);
     }
 
     console.log(`💾 Session saved with ID: ${session.id}`);
 
     return new Response(JSON.stringify({ 
       success: true, 
       session,
       analysis 
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