import { NextRequest, NextResponse } from "next/server";
import { passkeyApi } from "@/lib/passkey";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { decodeJwt } from "jose";

export async function POST(req: NextRequest) {
  try {
    const credential = await req.json();

    const result = await passkeyApi.login.finalize(credential);
    const jwt = typeof result === 'string' ? result : (result as any)?.token;
    if (!jwt) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
    }

    const payload = decodeJwt(jwt);
    const userId = payload.sub;

    if (!userId) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data, error } = await adminClient.auth.admin.getUserById(userId);
    if (error || !data.user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: data.user.email!,
    });

    if (linkError || !linkData.properties?.hashed_token) {
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "magiclink",
    });

    if (verifyError) {
      return NextResponse.json({ error: "Session creation failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to finalize passkey login" },
      { status: 500 }
    );
  }
}
