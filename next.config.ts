import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your Next.js config here
  experimental: {
    reactCompiler: true,
  },
  
  // Webpack config to handle Payload CMS dependencies
  //@ts-ignore
webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
}

// Make sure you wrap your `nextConfig`
// with the `withPayload` plugin
export default withPayload(nextConfig, { devBundleServerPackages: false }) 