/**
 * Which cast room a device belongs to.
 *
 * Devices are grouped by account *and* by the public address they leave the
 * network from. Everything behind one home router shares that address, so a
 * phone can reach the TVs in its own house and nothing else - previously every
 * logged-in device on earth shared a single room.
 *
 * Derived on the Pages side for both halves: the TV's address is seen when it
 * fetches its ticket, the phone's when it posts a command. Same LAN, same
 * address, same room. Letting the relay Worker derive it separately would risk
 * the two halves disagreeing about what "same network" means.
 *
 * Caveat worth knowing: some ISPs (MAP-E / DS-Lite, carrier NAT) share one
 * IPv4 address across households, which would put neighbours in one group.
 * They would still need the site password, which is a separate door.
 */

/**
 * IPv6 is grouped by /64 - the usual size of a single home network. The full
 * address is per-device, so using it whole would put every device in its own
 * room and break casting entirely on an IPv6 connection.
 */
export function normalizeClientAddress(raw: string): string {
  const address = raw.trim().toLowerCase();
  if (!address) return '';

  if (!address.includes(':')) return address;

  const expanded = address.split('%')[0];
  const groups = expanded.split(':');
  return groups.slice(0, 4).join(':');
}

export async function deriveCastRoomKey(profileId: string, clientAddress: string): Promise<string> {
  const network = normalizeClientAddress(clientAddress);
  const data = new TextEncoder().encode(`${profileId}|${network}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest).slice(0, 16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Cloudflare sets CF-Connecting-IP on every request it proxies. Without it -
 * a local dev server, say - everything falls into one room, which is the same
 * behaviour as before this grouping existed.
 */
export function readClientAddress(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? '';
}
