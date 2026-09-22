import { Link, createFileRoute } from '@tanstack/react-router'
import SectionRule from '../components/SectionRule'
import TestViewFigure from '../components/TestViewFigure'

export const Route = createFileRoute('/')({ component: Home })

const REPO = 'https://amratgames.com'

const HIGHLIGHTS = [
  {
    title: 'Fast Rust Slot RGS',
    desc: 'Drop-in RGS server on your machine. Reads your math models directly from disk and answers casino wallet contracts in microseconds.',
    tag: 'Engine',
  },
  {
    title: 'Multi-Resolution Viewport',
    desc: 'Run your game at seven mobile and desktop resolutions simultaneously. Each frame is an isolated live session with real SSE telemetry.',
    tag: 'Workbench',
  },
  {
    title: 'AmratGames.com GraphQL Studio',
    desc: 'Integrated explorer for live Amrat endpoints — query active bets, user balances, whale highrollers, and transactions with instant code generation.',
    tag: 'GraphQL API',
  },
  {
    title: 'Instant Replay & Bookmarking',
    desc: 'Pin any (mode, eventId), replay edge-case outcomes, and bookmark maximum win hits across immutable math revisions.',
    tag: 'Math QA',
  },
  {
    title: 'Subdomain Share Links',
    desc: 'Share live playable URLs on dedicated subdomains. Amratholders play against a real server-side RGS with zero file exposure.',
    tag: 'Cloud',
  },
  {
    title: 'CLI & CI/CD Pipeline',
    desc: 'Automate mathematical verification and push builds directly through the sdt command-line suite and Claude MCP integration.',
    tag: 'Automation',
  },
]

function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="wrap grid items-center gap-14 pt-16 pb-24 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:pt-24">
        <div>
          <div className="rise inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-400">
            <img src="/amrat-logo.png" alt="" className="h-4 w-4 object-contain" />
            <span>AmratGames.com · Premier Slot Workbench & Amrat API</span>
          </div>

          <h1
            className="display rise mt-5 mb-0 text-[2.8rem] leading-[1.05] font-black sm:text-[3.8rem]"
            style={{ animationDelay: '80ms' }}
          >
            Ship Casino Slots with <span className="gold-gradient-text">Royal Precision.</span>
          </h1>

          <p
            className="rise mt-6 mb-0 max-w-lg text-[1.05rem] leading-relaxed text-moss"
            style={{ animationDelay: '160ms' }}
          >
            <strong>AmratGames.com</strong> runs your slot games against an ultra-fast Rust RGS engine locally and in the cloud. Inspect live SSE events, test viewports side-by-side, and explore AmratGames.com GraphQL API data in one unified studio.
          </p>

          <div className="rise mt-9 flex flex-wrap gap-3" style={{ animationDelay: '240ms' }}>
            <Link to="/api-explorer" className="btn btn-primary">
              ⚡ Open Amrat API Studio
            </Link>
            <Link to="/cloud" className="btn btn-ghost">
              Launch Workbench
            </Link>
            <a
              href={`${REPO}/releases/latest`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost !border-line2 text-xs"
            >
              Desktop App
            </a>
          </div>

          <div
            className="rise mt-7 flex items-center gap-4 text-xs font-mono text-faint"
            style={{ animationDelay: '320ms' }}
          >
            <span>👑 Gold-Tier Performance</span>
            <span>·</span>
            <span>Amrat Engine RGS</span>
            <span>·</span>
            <span>GraphQL Ready</span>
          </div>
        </div>

        <TestViewFigure />
      </section>

      {/* Highlights */}
      <section className="wrap pt-4 pb-24">
        <SectionRule label="AmratGames Platform Capabilities" />
        <div className="mt-12 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="display m-0 text-3xl font-bold sm:text-4xl">
              Everything Your Casino Stack Demands.
            </h2>
            <p className="mt-2 text-sm text-moss">
              Built for math developers, frontend engineers, QA testers, and casino operations.
            </p>
          </div>
          <Link
            to="/api-explorer"
            className="font-mono text-sm text-mint no-underline hover:underline"
          >
            Try Amrat API Studio →
          </Link>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HIGHLIGHTS.map((item) => (
            <article key={item.title} className="card p-6 border-line hover:border-amber-500/40 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[0.68rem] font-mono uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                  {item.tag}
                </span>
                <span className="text-xs text-faint font-mono">0.1ms latency</span>
              </div>
              <h3 className="m-0 text-[1.05rem] font-semibold text-ink">{item.title}</h3>
              <p className="mt-2.5 mb-0 text-sm leading-relaxed text-moss">{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Cloud & Architecture Teaser */}
      <section className="wrap pt-4 pb-24">
        <SectionRule label="Cloud & Telemetry" />
        <div className="mt-12 grid items-center gap-10 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="display mt-0 mb-0 text-3xl font-bold sm:text-4xl">
              One Engine, Three Seamless Surfaces.
            </h2>
            <p className="mt-5 mb-0 leading-relaxed text-moss">
              The high-performance Rust engine powers your local dev loop and cloud workbench simultaneously. Math modelers, QA leads, and executives get instant playable instances behind isolated subdomains with zero installation.
            </p>
            <div className="mt-8 flex gap-4">
              <Link to="/cloud" className="btn btn-primary !px-5 !py-2.5">
                Explore Cloud Workbench
              </Link>
              <Link to="/features" className="btn btn-ghost !px-5 !py-2.5">
                View All Features
              </Link>
            </div>
          </div>
          <div className="card overflow-x-auto p-6 border-amber-500/20 bg-gradient-to-br from-panel2 to-panel">
            <div className="flex items-center justify-between pb-3 border-b border-line mb-3">
              <span className="text-xs font-mono text-amber-400 font-semibold">AmratGames RGS Router</span>
              <span className="live-dot"></span>
            </div>
            <p className="m-0 font-mono text-[0.8rem] leading-relaxed whitespace-pre text-dim">
              <span className="text-mint font-bold">https://royal-spade.play.amratgames.com</span>
              {'\n'}
              {'├── /             '}
              <span className="text-faint">HTML5 slot bundle (Pixi / Phaser)</span>
              {'\n'}
              {'├── /api/rgs/...  '}
              <span className="text-amber-300">Amrat Rust RGS · Rev #88</span>
              {'\n'}
              {'└── /_api/graphql '}
              <span className="text-emerald-400">AmratGames.com Telemetry &amp; Bets</span>
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="wrap pt-8 pb-4">
        <div className="card relative overflow-hidden p-10 text-center sm:p-14 border-amber-500/30">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(560px 260px at 50% 0%, rgba(245, 175, 25, 0.15), transparent 70%)',
            }}
          />
          <img src="/amrat-logo.png" alt="AmratGames" className="relative mx-auto h-16 w-16 object-contain mb-4 drop-shadow-[0_0_15px_rgba(245,175,25,0.6)]" />
          <h2 className="display relative mt-0 mb-0 text-3xl font-extrabold sm:text-4xl gold-gradient-text">
            Elevate Your Game Development to Royalty.
          </h2>
          <p className="relative mx-auto mt-4 mb-0 max-w-md leading-relaxed text-moss">
            Join game studios and developers using AmratGames.com to create, test, and deploy slot games on the Amrat Engine.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/api-explorer" className="btn btn-primary">
              ⚡ Explore Amrat API Studio
            </Link>
            <Link to="/pricing" className="btn btn-ghost">
              View Cloud Plans
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
