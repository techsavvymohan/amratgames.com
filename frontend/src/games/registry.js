import { getGameCoverUrl } from '../utils/cloudinary'

export const GAMES = [
    { id: 'crash', name: 'Aviator', navLabel: 'Aviator', path: '/crash', aliasPaths: ['/aviator'], icon: 'crash', image: getGameCoverUrl('/images/crash-v2.jpg'), rtp: '99% Return', volatility: 'Big Multiplier', badge: 'HOT', maxWin: '10,000x', category: 'Fast' },
    { id: 'plinko', name: 'Plinko', navLabel: 'Plinko', path: '/plinko', icon: 'plinko', image: getGameCoverUrl('/images/plinko.jpg'), rtp: '99% Return', volatility: 'Easy Play', badge: 'POPULAR', maxWin: '1,000x', category: 'Originals' },
    { id: 'mines', name: 'Mines (Diamonds)', navLabel: 'Mines', path: '/mines', icon: 'mines', image: getGameCoverUrl('/images/mines.jpg'), rtp: '99% Return', volatility: 'Pick & Win', badge: 'TRENDING', maxWin: '10,000x', category: 'Originals' },
    { id: 'limbo', name: 'Limbo', navLabel: 'Limbo', path: '/limbo', icon: 'limbo', image: getGameCoverUrl('/images/limbo-v2.jpg'), rtp: '99% Return', volatility: 'Target Multiplier', badge: 'BIG WIN', maxWin: '100,000x', category: 'Fast' },
    { id: 'dragon-tiger', name: 'Dragon Tiger', navLabel: 'Dragon Tiger', path: '/dragon-tiger', icon: 'cards', image: getGameCoverUrl('/images/dragon-tiger.jpg'), rtp: '99% Return', volatility: 'Fast Cards', badge: 'CARDS', maxWin: '8x', category: 'Table' },
    { id: 'color-match', name: 'Color Match', navLabel: 'Color Match', path: '/color-match', icon: 'circle', image: getGameCoverUrl('/images/color-match.jpg'), rtp: '99% Return', volatility: 'Color Guess', badge: 'FAST 30S', maxWin: '9x', category: 'Fast' },
    { id: 'coin-toss', name: 'Coin Toss', navLabel: 'Coin Toss', path: '/coin-toss', icon: 'coin', image: getGameCoverUrl('/images/coin-toss-v2.jpg'), rtp: '96% Return', volatility: 'Instant 1.96x', badge: 'NEW', maxWin: '1.96x', category: 'Fast' },
]

export function isGamePath(pathname) {
    return GAMES.some((game) => pathname.startsWith(game.path) || game.aliasPaths?.some(p => pathname.startsWith(p)))
}

