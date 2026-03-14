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
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to fetch credentials" }, { status: 500 });
  }
}
