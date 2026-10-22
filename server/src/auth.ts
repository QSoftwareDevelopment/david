import { createRemoteJWKSet, jwtVerify } from "jose";

export interface Principal {
  userId: string;
  email: string | null;
}

/**
 * Who is calling the staff API.
 *
 * The staff app signs in with Supabase Auth and sends its access token. The
 * server checks the signature (HS256 with the project's JWT secret, or the
 * project's published keys) and reads the user id from it. Which hotel that
 * user may see comes from the `staff` table, never from the token.
 */
export function makeVerifier(env: NodeJS.ProcessEnv = process.env): (token: string) => Promise<Principal | null> {
  const secret = env.SUPABASE_JWT_SECRET?.trim();
  const url = env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const jwks = url ? createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`)) : null;
  return async (token) => {
    try {
      const { payload } = secret
        ? await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"], audience: "authenticated" })
        : jwks
          ? await jwtVerify(token, jwks, { audience: "authenticated" })
          : (() => { throw new Error("no way to verify tokens is configured"); })();
      if (typeof payload.sub !== "string") return null;
      return { userId: payload.sub, email: typeof payload.email === "string" ? payload.email : null };
    } catch {
      return null;
    }
  };
}
