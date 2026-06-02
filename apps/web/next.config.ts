import type { NextConfig } from 'next';
import { networkInterfaces } from 'node:os';

const lanIps: string[] = [];
for (const ifaces of Object.values(networkInterfaces())) {
  for (const iface of ifaces ?? []) {
    if (iface.family === 'IPv4' && !iface.internal) lanIps.push(iface.address);
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3'],
  allowedDevOrigins: ['localhost', '127.0.0.1', '0.0.0.0', '::1', ...lanIps],
};

export default nextConfig;
