import type { Factor, SupabaseClient } from '@supabase/supabase-js';
import { siteConfig } from '@/lib/site';

type AssuranceLevel = {
  currentLevel?: string | null;
  nextLevel?: string | null;
};

export function needsMfaStepUp(aal: AssuranceLevel | null | undefined) {
  return aal?.nextLevel === 'aal2' && aal.currentLevel !== aal.nextLevel;
}

export function isMfaProtectedPath(pathname: string) {
  if (pathname.startsWith('/settings/update-password')) {
    return false;
  }
  return (
    pathname.startsWith('/app') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/transactions') ||
    pathname.startsWith('/stock')
  );
}

export async function getVerifiedTotpFactor(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data.totp[0] ?? null;
}

export async function verifyTotpCode(supabase: SupabaseClient, code: string) {
  const factor = await getVerifiedTotpFactor(supabase);
  if (!factor) {
    throw new Error('NO_TOTP_FACTOR');
  }

  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code,
  });
  if (error) throw error;
  return factor;
}

function isUnverifiedTotp(factor: Factor) {
  return factor.factor_type === 'totp' && factor.status !== 'verified';
}

export async function enrollTotpFactor(supabase: SupabaseClient) {
  const { data: listed } = await supabase.auth.mfa.listFactors();
  const leftovers = (listed?.all ?? []).filter(isUnverifiedTotp);

  await Promise.all(
    leftovers.map((factor) => supabase.auth.mfa.unenroll({ factorId: factor.id })),
  );

  return supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Authenticator',
    issuer: siteConfig.name,
  });
}

export async function unenrollTotpFactor(
  supabase: SupabaseClient,
  factorId: string,
  code?: string,
) {
  if (code) {
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    if (error) throw error;
  }

  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;

  await supabase.auth.refreshSession();
}
