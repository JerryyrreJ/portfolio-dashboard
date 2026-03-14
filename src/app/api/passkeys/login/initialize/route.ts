import { NextResponse } from "next/server";
import { passkeyApi } from "@/lib/passkey";

export async function POST() {
  const options = await passkeyApi.login.initialize();
  return NextResponse.json(options);
}
