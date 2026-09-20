'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { isMfaProtectedPath, needsMfaStepUp } from '@/lib/mfa';
import MfaChallengeForm from './MfaChallengeForm';

export default function MfaSessionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const protectedPath = isMfaProtectedPath(pathname);
  const [needsChallenge, setNeedsChallenge] = useState(false);

  useEffect(() => {
    if (!protectedPath) {
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) setNeedsChallenge(false);
        return;
      }

      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!cancelled) setNeedsChallenge(needsMfaStepUp(data));
    };

    void check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setNeedsChallenge(false);
        return;
      }
      void check();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [pathname, protectedPath]);

  if (!protectedPath || !needsChallenge) {
    return children;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-page p-6">
      <div className="w-full max-w-[400px] rounded-[32px] border border-border bg-card p-8 shadow-sm md:p-10">
        <MfaChallengeForm
          onVerified={() => setNeedsChallenge(false)}
          onCancel={async () => {
            await createClient().auth.signOut();
            setNeedsChallenge(false);
          }}
        />
      </div>
    </div>
  );
}
