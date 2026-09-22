export const GAMES = [
    { id: 'crash', name: 'Crash', navLabel: 'Crash', path: '/crash', icon: 'crash', image: '/images/crash.avif', rtp: '99% RTP', volatility: 'High volatility' },
    { id: 'plinko', name: 'Plinko', navLabel: 'Plinko', path: '/plinko', icon: 'plinko', image: '/images/plinko.avif', rtp: '99% RTP', volatility: 'Medium volatility' },
    { id: 'mines', name: 'Mines', navLabel: 'Mines', path: '/mines', icon: 'mines', image: '/images/mines.avif', rtp: '99% RTP', volatility: 'Medium volatility' },
    { id: 'limbo', name: 'Limbo', navLabel: 'Limbo', path: '/limbo', icon: 'limbo', image: '/images/limbo.svg', rtp: '99% RTP', volatility: 'Adjustable volatility' },
    { id: 'dragon-tiger', name: 'Dragon Tiger', navLabel: 'Dragon Tiger', path: '/dragon-tiger', icon: 'cards', image: '/images/dragon-tiger.svg', rtp: '99% RTP', volatility: 'Low volatility' },
    { id: 'color-match', name: 'Color Match', navLabel: 'Color Match', path: '/color-match', icon: 'circle', image: '/images/color-match.svg', rtp: '99% RTP', volatility: 'Medium volatility' },
    { id: 'dino', name: 'Dino', navLabel: 'Dino Run', path: '/dino', icon: 'dino', image: '/images/dino.avif', rtp: '99% RTP', volatility: 'Low volatility' },
]

export function isGamePath(pathname) {
    return GAMES.some((game) => pathname.startsWith(game.path))
}
