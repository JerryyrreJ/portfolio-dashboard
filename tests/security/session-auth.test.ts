import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getMfaAuthenticatedUser } from '@/lib/session-auth';

function client(factors: Array<{ status: string }>, aal: string | null = 'aal1') {
  const user = { id: 'user-a', factors };
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: {
      access_token: 'exact-token', user: { id: 'forged-cookie-user', factors: [] },
    } }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: user.id, aal } }, error: null }),
  };
  return { supabase: { auth } as unknown as SupabaseClient, auth, user };
}

describe('server-side MFA authorization', () => {
  it('allows accounts without enrolled MFA', async () => {
    const c = client([]);
    expect(await getMfaAuthenticatedUser(c.supabase)).toEqual(c.user);
    expect(c.auth.getUser).toHaveBeenCalledWith('exact-token');
  });
  it('does not treat incomplete enrollment as enabled MFA', async () => {
    const c = client([{ status: 'unverified' }]);
    expect(await getMfaAuthenticatedUser(c.supabase)).toEqual(c.user);
  });
  it.each(['aal1', null])('rejects %s even if cookie user hides verified factors', async (aal) => {
    const c = client([{ status: 'verified' }], aal);
    expect(await getMfaAuthenticatedUser(c.supabase)).toBeNull();
    expect(c.auth.getClaims).toHaveBeenCalledWith('exact-token');
  });
  it('allows verified AAL2', async () => {
    const c = client([{ status: 'verified' }], 'aal2');
    expect(await getMfaAuthenticatedUser(c.supabase)).toEqual(c.user);
  });
  it('fails closed on claim verification failure', async () => {
    const c = client([{ status: 'verified' }], 'aal2');
    c.auth.getClaims.mockResolvedValue({ data: null, error: new Error('invalid signature') });
    expect(await getMfaAuthenticatedUser(c.supabase)).toBeNull();
  });
  it('rejects claims belonging to another subject', async () => {
    const c = client([{ status: 'verified' }], 'aal2');
    c.auth.getClaims.mockResolvedValue({ data: { claims: { sub: 'other', aal: 'aal2' } }, error: null });
    expect(await getMfaAuthenticatedUser(c.supabase)).toBeNull();
  });
  it('rejects an invalid first-factor session', async () => {
    const c = client([]);
    c.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid token') });
    expect(await getMfaAuthenticatedUser(c.supabase)).toBeNull();
  });
});
