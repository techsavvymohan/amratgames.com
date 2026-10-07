export const GAMES = [
    { id: 'crash', name: 'Crash', navLabel: 'Crash', path: '/crash', icon: 'crash', image: '/images/crash.jpg', rtp: '99% RTP', volatility: 'High', badge: 'HOT', maxWin: '100,000x', category: 'Fast' },
    { id: 'plinko', name: 'Plinko', navLabel: 'Plinko', path: '/plinko', icon: 'plinko', image: '/images/plinko.jpg', rtp: '99% RTP', volatility: 'Medium', badge: 'POPULAR', maxWin: '1,000x', category: 'Originals' },
    { id: 'mines', name: 'Mines', navLabel: 'Mines', path: '/mines', icon: 'mines', image: '/images/mines.jpg', rtp: '99% RTP', volatility: 'Medium', badge: 'TRENDING', maxWin: '10,000x', category: 'Originals' },
    { id: 'limbo', name: 'Limbo', navLabel: 'Limbo', path: '/limbo', icon: 'limbo', image: '/images/limbo.jpg', rtp: '99% RTP', volatility: 'Adjustable', badge: '1,000,000X', maxWin: '1,000,000x', category: 'Fast' },
    { id: 'dragon-tiger', name: 'Dragon Tiger', navLabel: 'Dragon Tiger', path: '/dragon-tiger', icon: 'cards', image: '/images/dragon-tiger.jpg', rtp: '99% RTP', volatility: 'Low', badge: 'VIP CARDS', maxWin: '8x', category: 'Table' },
    { id: 'color-match', name: 'Color Match', navLabel: 'Color Match', path: '/color-match', icon: 'circle', image: '/images/color-match.jpg', rtp: '99% RTP', volatility: 'Medium', badge: 'FAST 30S', maxWin: '9x', category: 'Fast' },
    { id: 'dino', name: 'Dino', navLabel: 'Dino', path: '/dino', icon: 'dino', image: '/images/dino.jpg', rtp: '99% RTP', volatility: 'Low', badge: 'RUNNER', maxWin: '1,000x', category: 'Originals' },
]

export function isGamePath(pathname) {
    return GAMES.some((game) => pathname.startsWith(game.path))
}

