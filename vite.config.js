import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const publicRoutes = [
  '/',
  '/plans',
  '/about',
  '/faq',
  '/contact',
  '/privacy-policy',
  '/terms-and-conditions',
  '/refund-policy',
  '/cookie-policy',
  '/payment-security',
  '/grievance-redressal',
  '/support',
]

function publicSeoFiles(siteUrl, mode) {
  return {
    name: 'texos-public-seo-files',
    generateBundle() {
      if (mode !== 'production' || !siteUrl) return
      const base = new URL(siteUrl)
      if (base.pathname !== '/' || base.search || base.hash) {
        throw new Error('VITE_SITE_URL must be the production site origin without a path, query, or fragment.')
      }
      if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) {
        throw new Error('VITE_SITE_URL must use HTTPS.')
      }
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${publicRoutes
        .map((route) => `  <url><loc>${base.origin}${route}</loc></url>`)
        .join('\n')}\n</urlset>\n`
      const robots = [
        'User-agent: *',
        'Allow: /',
        'Disallow: /dashboard',
        'Disallow: /texos-admin',
        'Disallow: /login',
        'Disallow: /signup',
        'Disallow: /forgot-password',
        'Disallow: /reset-password',
        'Disallow: /onboarding',
        'Disallow: /menu/',
        'Disallow: /kitchen-staff',
        'Disallow: /order-approval',
        `Sitemap: ${base.origin}/sitemap.xml`,
        '',
      ].join('\n')
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap })
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots })
    },
  }
}

export default defineConfig(({ mode }) => {
  const { VITE_SITE_URL } = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      publicSeoFiles(VITE_SITE_URL, mode),
    ],
  }
})
