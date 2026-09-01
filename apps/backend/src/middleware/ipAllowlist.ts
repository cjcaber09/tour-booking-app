import type { NextFunction, Request, Response } from 'express';

// Node/Express can report IPv4-mapped IPv6 addresses (e.g. "::ffff:203.0.113.10")
// depending on how the socket was opened; strip the prefix so allowlist entries
// can be written as plain IPv4 without the caller needing to know this quirk.
function normalizeIp(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice('::ffff:'.length) : ip;
}

// Coarse network-layer control, not authentication: no rate limiting, no request
// signing. This app has no `trust proxy` configured, so req.ip is the real, unspoofable
// socket peer — correct as long as the backend stays directly exposed with no reverse
// proxy in front (a proxy would need `trust proxy` + a rethink of this check, since
// req.ip would otherwise become the proxy's own address for every request).
export function ipAllowlist(req: Request, res: Response, next: NextFunction) {
  // Parsed per-request (not once at module load) so tests can flip
  // PUBLIC_API_IP_ALLOWLIST between requests without recreating the app.
  const allowlist = new Set(
    (process.env.PUBLIC_API_IP_ALLOWLIST ?? '')
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean),
  );

  // Fail closed: an empty/unset allowlist blocks all traffic rather than leaving
  // the public API open by accident.
  if (allowlist.size === 0 || !allowlist.has(normalizeIp(req.ip ?? ''))) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  next();
}
