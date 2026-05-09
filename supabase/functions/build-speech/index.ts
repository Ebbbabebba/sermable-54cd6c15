// AI speech builder
//
// Two-step Q&A → final draft flow.
//
// Step 1 (mode: "questions"): caller sends a brief prompt ("write a wedding
// toast for my brother") and we return 3-5 short clarifying questions.
//
// Step 2 (mode: "draft"): caller sends the original prompt + the user's
// answers and we return a finished speech draft as plain text plus a title.
//
// Auth: requires a logged-in Supabase user (verify_jwt = true).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface QuestionsRequest {
  mode: "questions";
  prompt: string;
  language?: string;
}
interface DraftRequest {
  mode: "draft";
  prompt: string;
  language?: string;
  answers: Array<{ question: string; answer: string }>;
  targetMinutes?: number;
}
type BuildRequest = QuestionsRequest | DraftRequest;

const QUESTIONS_SYSTEM_PROMPT = `You are an expert speechwriting coach.
The user will tell you, in one short paragraph, what kind of speech they
want to give. Your job is to ask 4 short, specific questions that will let
you write a tailored, personal speech for them.

Rules for the questions:
- Maximum 4 questions, ideally 3.
- Each question must fit on a single line (under ~120 characters).
- Cover: audience/relationship, core message, a personal anecdote or example, and the desired tone or feeling.
- Skip any question that the user has already answered in their prompt.
- Use the same language as the user's prompt.

Return ONLY a JSON object of the form:
{ "questions": ["question 1", "question 2", "question 3"] }
No markdown, no commentary.`;

const DRAFT_SYSTEM_PROMPT = `You are an expert speechwriter.
Given the user's intent and their answers to follow-up questions, write a
finished speech in their language.

Rules:
- Write the speech as plain prose, paragraph breaks where natural. No
  bullet lists, no headings, no markdown.
- Match the requested tone (warm, formal, funny, etc.).
- Weave in the user's anecdote or example naturally; do not just append it.
- Use stage directions in (parentheses) sparingly only when they add value
  (e.g. "(pause)", "(look at the bride)").
- If the user asked for a specific length, target that length; otherwise aim
  for ~2-3 minutes spoken (around 300-450 words).
- Also propose a short title (max 5 words) for the speech.

Return ONLY a JSON object:
{ "title": "Short title", "speech": "The full speech text..." }
No markdown, no commentary.`;

async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<any> {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`OpenAI error ${r.status}: ${t}`);
  }
  const data = await r.json();
  const content = data?.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error("OpenAI returned non-JSON content");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as BuildRequest;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY is not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const language = body.language || "en";

    if (body.mode === "questions") {
      const prompt = (body.prompt || "").trim();
      if (prompt.length < 3) {
        return new Response(
          JSON.stringify({ error: "Prompt is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const userPrompt = `Language: ${language}
User's request:
${prompt}

Return the JSON with the clarifying questions.`;
      const json = await callOpenAI(
        OPENAI_API_KEY,
        QUESTIONS_SYSTEM_PROMPT,
        userPrompt,
      );
      const questions = Array.isArray(json?.questions)
        ? json.questions.filter((q: unknown) => typeof q === "string")
        : [];
      return new Response(JSON.stringify({ questions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.mode === "draft") {
      const prompt = (body.prompt || "").trim();
      const answers = Array.isArray(body.answers) ? body.answers : [];
      if (prompt.length < 3) {
        return new Response(
          JSON.stringify({ error: "Prompt is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const qaBlock = answers
        .map(
          (a) =>
            `Q: ${(a.question || "").trim()}\nA: ${(a.answer || "").trim()}`,
        )
        .join("\n\n");
      const targetLine = body.targetMinutes
        ? `Target length: about ${body.targetMinutes} minutes spoken.`
        : "";
      const userPrompt = `Language: ${language}
${targetLine}

Original request:
${prompt}

Follow-up answers:
${qaBlock}

Now write the speech and propose a short title. Return JSON only.`;
      const json = await callOpenAI(
        OPENAI_API_KEY,
        DRAFT_SYSTEM_PROMPT,
        userPrompt,
      );
      const title = typeof json?.title === "string" ? json.title.trim() : "";
      const speech = typeof json?.speech === "string" ? json.speech.trim() : "";
      if (!speech) {
        return new Response(
          JSON.stringify({ error: "AI did not return a speech" }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      return new Response(JSON.stringify({ title, speech }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid mode" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("build-speech error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
