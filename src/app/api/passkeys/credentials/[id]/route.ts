import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase-server";
import { passkeyApi } from "@/lib/passkey";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const credentials = await passkeyApi.user(user.id).credentials();
    const isOwnedCredential = credentials.some((credential) => credential.id === id);
    if (!isOwnedCredential) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    await passkeyApi.credential(id).remove();
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to remove credential";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
