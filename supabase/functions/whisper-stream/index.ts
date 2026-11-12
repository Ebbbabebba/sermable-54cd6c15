import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import type {} from '../_shared/gateway-models.d.ts';
import { transcribeAudio, GatewayError } from 'npm:@lovable.dev/ai-gateway@0.1.11';
const schema = z.object({audio:z.string().min(1).max(35000000).regex(/^[A-Za-z0-9+/=]+$/), language:z.string().max(20).default('sv'), mimeType:z.string().max(100).default('audio/webm')});
const reply = (body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST')return reply({error:'Method not allowed'},405);
  const token=req.headers.get('Authorization')?.replace(/^Bearer /,'');
  if(!token)return reply({error:'Unauthorized'},401);
  const client=createClient(Deno.env.get('SUPABASE_URL')??'',Deno.env.get('SUPABASE_ANON_KEY')??'');
  const {data,error}=await client.auth.getUser(token);
  if(error||!data.user)return reply({error:'Unauthorized'},401);
  try{
    const parsed=schema.safeParse(await req.json());
    if(!parsed.success)return reply({error:'Invalid recording'},400);
    const input=parsed.data;
    const bytes=Uint8Array.from(atob(input.audio),c=>c.charCodeAt(0));
    const extension=input.mimeType.includes('mp4')?'m4a':input.mimeType.includes('wav')?'wav':input.mimeType.includes('ogg')?'ogg':'webm';
    const result=await transcribeAudio({model:'openai/gpt-transcribe',file:new File([bytes],`recording.${extension}`,{type:input.mimeType}),language:input.language.split(/[-_]/)[0],response_format:'json',timestamp_granularities:['segment']},{signal:AbortSignal.timeout(18000)});
    const transcript=typeof result==='string'?result:result.text;
    // Some model responses lack timing. Do not invent timestamps.
    const timed=z.object({segments:z.array(z.object({start:z.number(),end:z.number(),text:z.string()}))}).safeParse(result);
    return reply({transcript,segments:timed.success?timed.data.segments:[],timingAvailable:timed.success});
  }catch(error){
    console.error('Transcription failed',error instanceof GatewayError?{code:error.code,ids:error.ids,outcome:error.outcome}:'invalid-recording');
    return reply({error:'Transkriberingen misslyckades. Inspelningen finns kvar.'},error instanceof GatewayError&&error.httpStatus?error.httpStatus:502);
  }
});
