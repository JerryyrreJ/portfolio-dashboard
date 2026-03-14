import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase-server";
import { passkeyApi } from "@/lib/passkey";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { displayName } = await req.json().catch(() => ({}));

  const options = await passkeyApi.registration.initialize({
    userId: user.id,
    username: user.email ?? user.id,
    ...(displayName ? { displayName } : {}),
  });

  return NextResponse.json(options);
}
