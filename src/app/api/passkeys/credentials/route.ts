import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase-server";
import { passkeyApi } from "@/lib/passkey";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const credentials = await passkeyApi.user(user.id).credentials();
    return NextResponse.json(credentials);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch credentials";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
