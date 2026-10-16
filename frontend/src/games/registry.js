export const GAMES = [
    { id: 'crash', name: 'Crash (Rocket)', navLabel: 'Crash', path: '/crash', icon: 'crash', image: '/images/crash.jpg?v=3', rtp: '99% Return', volatility: 'Big Multiplier', badge: 'HOT', maxWin: '10,000x', category: 'Fast' },
    { id: 'plinko', name: 'Plinko', navLabel: 'Plinko', path: '/plinko', icon: 'plinko', image: '/images/plinko.jpg?v=3', rtp: '99% Return', volatility: 'Easy Play', badge: 'POPULAR', maxWin: '1,000x', category: 'Originals' },
    { id: 'mines', name: 'Mines (Diamonds)', navLabel: 'Mines', path: '/mines', icon: 'mines', image: '/images/mines.jpg?v=3', rtp: '99% Return', volatility: 'Pick & Win', badge: 'TRENDING', maxWin: '10,000x', category: 'Originals' },
    { id: 'limbo', name: 'Limbo', navLabel: 'Limbo', path: '/limbo', icon: 'limbo', image: '/images/limbo.jpg?v=3', rtp: '99% Return', volatility: 'Target Multiplier', badge: 'BIG WIN', maxWin: '100,000x', category: 'Fast' },
    { id: 'dragon-tiger', name: 'Dragon Tiger', navLabel: 'Dragon Tiger', path: '/dragon-tiger', icon: 'cards', image: '/images/dragon-tiger.jpg?v=3', rtp: '99% Return', volatility: 'Fast Cards', badge: 'CARDS', maxWin: '8x', category: 'Table' },
    { id: 'color-match', name: 'Color Match', navLabel: 'Color Match', path: '/color-match', icon: 'circle', image: '/images/color-match.jpg?v=3', rtp: '99% Return', volatility: 'Color Guess', badge: 'FAST 30S', maxWin: '9x', category: 'Fast' },
    { id: 'coin-toss', name: 'Coin Toss (Heads or Tails)', navLabel: 'Coin Toss', path: '/coin-toss', icon: 'coin', image: '/images/coin-toss.jpg?v=1', rtp: '96% Return', volatility: 'Instant 1.96x', badge: 'NEW', maxWin: '1.96x', category: 'Fast' },
    { id: 'dino', name: 'Dino Runner', navLabel: 'Dino', path: '/dino', icon: 'dino', image: '/images/dino.jpg?v=3', rtp: '99% Return', volatility: 'Jump & Win', badge: 'RUNNER', maxWin: '1,000x', category: 'Originals' },
]

export function isGamePath(pathname) {
    return GAMES.some((game) => pathname.startsWith(game.path))
}

