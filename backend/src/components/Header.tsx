import { Link } from '@tanstack/react-router'

const NAV = [
  { to: '/features', label: 'Features' },
  { to: '/cloud', label: 'Cloud' },
  { to: '/api-explorer', label: 'Amrat API Studio' },
  { to: '/cli', label: 'CLI & MCP' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/open-source', label: 'Open source' },
] as const

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-pit/90 backdrop-blur-md">
      <div className="wrap flex flex-wrap items-center justify-between gap-x-4 gap-y-0 py-3 md:h-16 md:py-0">
        <Link to="/" className="flex items-center gap-2.5 no-underline group">
          <img
            src="https://res.cloudinary.com/r1fegrxo/image/upload/f_auto,q_auto,w_96/v1792395452/amratgames/amrat-logo.png"
            alt="AmratGames"
            className="h-8 w-8 object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-[0_0_8px_rgba(245,175,25,0.5)]"
          />
          <div className="flex flex-col">
            <span className="display text-[1.15rem] font-black tracking-tight gold-gradient-text leading-none">
              AmratGames<span className="text-amber-400 font-normal">.com</span>
            </span>
            <span className="text-[0.62rem] font-mono uppercase tracking-widest text-moss/90 leading-none mt-0.5">
              Casino & Slot Workbench
            </span>
          </div>
        </Link>

        <nav className="order-3 -mb-1 flex w-full items-center gap-6 overflow-x-auto pt-2 pb-2 md:order-none md:w-auto md:gap-7 md:pt-0 md:pb-0">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-sm whitespace-nowrap text-moss no-underline transition-colors hover:text-amber-400 font-medium"
              activeProps={{ className: 'text-amber-400 font-semibold' }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/api-explorer"
            className="btn btn-ghost hidden !px-3.5 !py-2 text-xs sm:inline-flex border-amber-500/30 text-amber-300/90 hover:border-amber-400"
          >
            ⚡ API Explorer
          </Link>
          <Link
            to="/cloud"
            className="btn btn-primary hidden !px-4 !py-2 text-xs sm:inline-flex font-semibold shadow-md"
          >
            Launch Workbench
          </Link>
        </div>
      </div>
    </header>
  )
}
