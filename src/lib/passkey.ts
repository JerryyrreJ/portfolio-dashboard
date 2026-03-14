import { tenant } from "@teamhanko/passkeys-next-auth-provider";

export const passkeyApi = tenant({
  apiKey: process.env.PASSKEYS_API_KEY!,
  tenantId: process.env.NEXT_PUBLIC_PASSKEYS_TENANT_ID!,
});
