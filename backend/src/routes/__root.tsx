import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import Footer from '../components/Footer'
import Header from '../components/Header'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'AmratGames.com — Premier Game Dev Workbench & Amrat API Studio' },
      {
        name: 'description',
        content:
          'AmratGames.com: The luxury developer workbench for Amrat Engine slot games and AmratGames.com GraphQL API integration. Real-time RGS simulation, instant replay, multi-resolution testing, and GraphQL query studio.',
      },
      { property: 'og:title', content: 'AmratGames.com — Casino Game Dev Workbench & Amrat API' },
      {
        property: 'og:description',
        content:
          'Build, debug, QA slot games on the Amrat Engine RGS and query AmratGames.com GraphQL endpoints with AmratGames.com.',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:image', content: '/amrat-logo.png' },
      { name: 'theme-color', content: '#08080c' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/png', href: '/amrat-logo.png' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/amrat-logo.png' },
      { rel: 'apple-touch-icon', href: '/amrat-logo.png' },
    ],
  }),
  shellComponent: RootDocument,
})

// After a deploy, a tab loaded on the previous build holds a chunk index whose
// hashed files no longer exist — the next client-side navigation 404s. Vite
// surfaces that as `vite:preloadError`; reload once to pick up the new build
// (session-scoped throttle so a genuinely broken asset can't reload-loop).
const RELOAD_ON_STALE_CHUNK = `window.addEventListener('vite:preloadError',function(e){var k='sdt-reload-at',t=+(sessionStorage.getItem(k)||0);if(Date.now()-t>60000){sessionStorage.setItem(k,String(Date.now()));e.preventDefault();location.reload()}});`

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: RELOAD_ON_STALE_CHUNK }} />
      </head>
      <body className="bg-pit font-sans text-ink antialiased">
        <Header />
        {children}
        <Footer />
        {import.meta.env.DEV ? (
          <TanStackDevtools
            config={{ position: 'bottom-right' }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        ) : null}
        <Scripts />
      </body>
    </html>
  )
}
