import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your Next.js config here
  experimental: {
    reactCompiler: true,
  },
  
  // Webpack config to handle Payload CMS dependencies
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push({
        'thread-stream': 'commonjs thread-stream',
        'pino': 'commonjs pino',
        'pino-pretty': 'commonjs pino-pretty',
      })
    }
    return config
  },
}

// Make sure you wrap your `nextConfig`
// with the `withPayload` plugin
export default withPayload(nextConfig) 