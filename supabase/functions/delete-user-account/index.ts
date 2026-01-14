import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Create client for token validation + admin client for deletion
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey);

    // Validate user by token (server-side)
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log(`Deleting account for user: ${userId}`);

    // Admin client for deletion operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Delete user data in order (respecting foreign key constraints)
    // Note: Most tables should cascade delete, but we'll be explicit
    
    // 1. Delete beat progress
    await supabaseAdmin
      .from('beat_progress')
      .delete()
      .eq('user_id', userId);

    // 2. Delete segment word mastery
    await supabaseAdmin
      .from('segment_word_mastery')
      .delete()
      .eq('user_id', userId);

    // 3. Delete practice sessions (linked to speeches)
    const { data: speeches } = await supabaseAdmin
      .from('speeches')
      .select('id')
      .eq('user_id', userId);

    if (speeches && speeches.length > 0) {
      const speechIds = speeches.map(s => s.id);
      
      // Delete practice sessions
      await supabaseAdmin
        .from('practice_sessions')
        .delete()
        .in('speech_id', speechIds);

      // Delete presentation sessions
      await supabaseAdmin
        .from('presentation_sessions')
        .delete()
        .in('speech_id', speechIds);

      // Delete speech segments
      await supabaseAdmin
        .from('speech_segments')
        .delete()
        .in('speech_id', speechIds);

      // Delete freestyle keywords
      await supabaseAdmin
        .from('freestyle_keywords')
        .delete()
        .in('speech_id', speechIds);

      // Delete freestyle sessions
      await supabaseAdmin
        .from('freestyle_sessions')
        .delete()
        .in('speech_id', speechIds);

      // Delete speeches
      await supabaseAdmin
        .from('speeches')
        .delete()
        .eq('user_id', userId);
    }

    // 4. Delete user profile
    await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

    // 5. Delete the auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Error deleting auth user:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete user account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully deleted account for user: ${userId}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
