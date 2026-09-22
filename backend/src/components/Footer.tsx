import { Link } from '@tanstack/react-router'

const COLUMNS = [
  {
    title: 'Platform',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'Cloud Workbench', href: '/cloud' },
      { label: 'Amrat API Studio', href: '/api-explorer' },
      { label: 'Pricing Plans', href: '/pricing' },
      {
        label: 'Download Releases',
        href: 'https://amratgames.com',
      },
    ],
  },
  {
    title: 'Developer',
    links: [
      { label: 'CLI & MCP Toolkit', href: '/cli' },
      { label: 'Open Source', href: '/open-source' },
      { label: 'Amrat Engine Contract', href: 'https://amrat-engine.com/' },
      { label: 'Amrat API Docs', href: 'https://github.com/forcemaredart/amrat.com-api' },
      {
        label: 'Community Discord',
        href: 'https://amratgames.com',
      },
    ],
  },
]

function FooterLink({ label, href }: { label: string; href: string }) {
  const className = 'text-sm text-moss no-underline transition-colors hover:text-amber-400'
  if (href.startsWith('/')) {
    return (
      <Link to={href} className={className}>
        {label}
      </Link>
    )
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {label}
    </a>
  )
}

export default function Footer() {
  return (
    <footer className="mt-28 border-t border-line bg-pit/50">
      <div className="wrap grid gap-10 py-14 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <img src="/amrat-logo.png" alt="AmratGames" className="h-8 w-8 object-contain drop-shadow-[0_0_8px_rgba(245,175,25,0.4)]" />
            <span className="display text-base font-bold tracking-tight gold-gradient-text">AmratGames.com</span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-moss">
            The premier development workbench and GraphQL API platform for Amrat Engine slots and casino developers.
          </p>
          <p className="mt-3 max-w-xs text-xs leading-relaxed text-faint">
            Independent open-source ecosystem. Not affiliated with, endorsed by,
            or operated by AmratGames.com.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="font-mono text-xs tracking-[0.14em] text-amber-500/80 uppercase">
              {col.title}
            </h3>
            <ul className="mt-4 space-y-2.5 pl-0" style={{ listStyle: 'none' }}>
              {col.links.map((link) => (
                <li key={link.label}>
                  <FooterLink label={link.label} href={link.href} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-line">
        <div className="wrap flex flex-col gap-3 py-6 font-mono text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
          <span className="text-moss/80">© {new Date().getFullYear()} AmratGames.com · All rights reserved</span>
          <nav className="flex flex-wrap gap-x-4 gap-y-1">
            {[
              { to: '/legal', label: 'Legal' },
              { to: '/terms', label: 'Terms' },
              { to: '/privacy', label: 'Privacy' },
              { to: '/refunds', label: 'Refunds' },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-faint no-underline transition-colors hover:text-amber-400"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <span>Workbench: MIT · Studio: Cloud Ready</span>
        </div>
      </div>
    </footer>
  )
}
