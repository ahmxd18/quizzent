import { BlockList, isIP } from 'node:net'

// Cloudflare's published ranges, checked 2026-11-23:
// https://www.cloudflare.com/ips-v4/ and https://www.cloudflare.com/ips-v6/
const cloudflare = new BlockList()
for (const subnet of [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
  '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
  '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
  '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32',
  '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32',
]) {
  const [address, prefix] = subnet.split('/')
  cloudflare.addSubnet(address, Number(prefix), isIP(address) === 6 ? 'ipv6' : 'ipv4')
}

export function proxyTrust(hops: number, renderIngress = false) {
  return (address: string, hop: number) => {
    if (hop < hops) return true
    // Render's immediate ingress is trusted explicitly. Walk past Cloudflare,
    // then stop at the first visitor address, before any caller-supplied entries.
    const family = isIP(address)
    return renderIngress && hops === 1 && family !== 0
      && cloudflare.check(address, family === 6 ? 'ipv6' : 'ipv4')
  }
}
