const DEFAULT_TRUST_PROXY_HOPS = 0;

/**
 * Reads TRUST_PROXY_HOPS defensively. Invalid, negative or non-integer values
 * fail closed to 0 so an accidental environment typo never enables proxy trust.
 */
export function getTrustProxyHops(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.TRUST_PROXY_HOPS?.trim();
  if (!raw) return DEFAULT_TRUST_PROXY_HOPS;

  if (!/^\d+$/.test(raw)) return DEFAULT_TRUST_PROXY_HOPS;

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return DEFAULT_TRUST_PROXY_HOPS;
  }

  return parsed;
}
