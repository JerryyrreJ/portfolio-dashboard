import type { SupabaseClient } from '@supabase/supabase-js';

/** Authorize the exact token verified by Auth, never cookie-supplied user/factor data. */
export async function getMfaAuthenticatedUser(supabase: SupabaseClient) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) return null;

  const token = session.access_token;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  if (user.factors?.some((factor) => factor.status === 'verified')) {
    const { data, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || data?.claims.sub !== user.id || data.claims.aal !== 'aal2') {
      return null;
    }
  }
  return user;
}
