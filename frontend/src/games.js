export const GAMES = [
    { id: 'crash', name: 'Crash', navLabel: 'Crash', path: '/crash', icon: 'crash', image: '/images/crash.avif', rtp: '99% RTP', volatility: 'High' },
    { id: 'plinko', name: 'Plinko', navLabel: 'Plinko', path: '/plinko', icon: 'plinko', image: '/images/plinko.avif', rtp: '99% RTP', volatility: 'Medium' },
    { id: 'mines', name: 'Mines', navLabel: 'Mines', path: '/mines', icon: 'mines', image: '/images/mines.avif', rtp: '99% RTP', volatility: 'Medium' },
    { id: 'limbo', name: 'Limbo', navLabel: 'Limbo', path: '/limbo', icon: 'limbo', image: '/images/limbo.svg', rtp: '99% RTP', volatility: 'Adjustable' },
    { id: 'dragon-tiger', name: 'Dragon Tiger', navLabel: 'Dragon Tiger', path: '/dragon-tiger', icon: 'cards', image: '/images/dragon-tiger.svg', rtp: '99% RTP', volatility: 'Low' },
    { id: 'color-match', name: 'Color Match', navLabel: 'Color Match', path: '/color-match', icon: 'circle', image: '/images/color-match.svg', rtp: '99% RTP', volatility: 'Medium' },
    { id: 'dino', name: 'Dino', navLabel: 'Dino', path: '/dino', icon: 'dino', image: '/images/dino.avif', rtp: '99% RTP', volatility: 'Low' },
]

export function isGamePath(pathname) {
    return GAMES.some((game) => pathname.startsWith(game.path))
}
