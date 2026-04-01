import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase-server";
import { passkeyApi } from "@/lib/passkey";

interface ErrorWithOriginal extends Error {
  originalError?: unknown;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const credential = await req.json();
    await passkeyApi.registration.finalize(credential);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const typedError = error as ErrorWithOriginal;
    const detail = typedError.originalError ?? typedError.message ?? "Failed to finalize passkey registration";
    console.error("Passkey register finalize error:", JSON.stringify(detail));
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
