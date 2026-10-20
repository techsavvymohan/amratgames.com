import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function source(relativePath) {
    return readFile(new URL(relativePath, import.meta.url), 'utf8').catch(() => '')
}

async function sources(relativePaths) {
    return Promise.all(relativePaths.map(source))
}

test('mobile shell exposes drawer, compact header, and five-route bottom navigation', async () => {
    const [app, layout, header, navigation, navigationCss, globalCss] = await sources([
        './src/App.jsx',
        './src/components/Layout.jsx',
        './src/components/Header.jsx',
        './src/components/MobileNavigation.jsx',
        './src/components/MobileNavigation.css',
        './src/styles/index.css',
    ])

    assert.match(app, /role="status"/)
    assert.doesNotMatch(app, /fallback=\{null\}/)
    assert.match(layout, /<MobileNavigation/)
    assert.match(header, /aria-label="Open navigation menu"/)
    assert.match(header, /ref=\{menuButtonRef\}/)
    assert.match(navigation, /afterOpenChange=/)
    assert.match(header, /className="mobile-wallet-balance"/)
    assert.match(header, /openWalletModal\('deposit'\)/)
    assert.match(header, /!isGamePage &&/)
    assert.match(navigation, /aria-label="Primary navigation"/)
    assert.match(navigation, /const primaryRoutes = \[/)
    assert.match(navigation, /path: '\/'/)
    assert.match(navigation, /\.\.\.GAMES\.map/)
    assert.match(navigation, /const hubNavItems = \[/)
    assert.match(navigationCss, /safe-area-inset-bottom/)
    assert.match(globalCss, /height:\s*100dvh/)
    assert.match(globalCss, /padding-bottom:\s*var\(--mobile-nav-space\)/)
})


test('Home uses compact mobile hero, category rail, and adaptive card grid', async () => {
    const css = await source('./src/styles/home.css')
    assert.match(css, /\.game-category-list\s*\{[^}]*overflow-x:\s*auto/s)
    assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*grid-template-columns:\s*repeat\(2,/)
    assert.match(css, /@media\s*\(max-width:\s*359px\)[\s\S]*grid-template-columns:\s*1fr/)
    assert.match(css, /touch-action:\s*pan-x/)
})

test('Mines keeps the square board ahead of a collapsible betting sheet', async () => {
    const [component, css] = await sources([
        './src/games/mines/MinesGame.jsx',
        './src/games/mines/MinesGame.css',
    ])
    assert.match(component, /<MobileBetSheet[^>]*title="Mines bet controls"/)
    assert.match(component, /mines-bet-sheet/)
    assert.match(component, /mobile-sheet-secondary/)
    assert.match(component, /rootClassName="mines-fairness-modal-portal mobile-game-modal"/)
    assert.match(component, /rootClassName="mines-history-modal-portal mobile-game-modal"/)
    assert.match(css, /\.mines-display\s*\{[^}]*aspect-ratio:\s*1/s)
    assert.match(css, /\.mines-bet-sheet .mines-sidebar/)
    assert.match(css, /@media\s*\(max-width:\s*768px\)/)
})


test('Crash prioritizes chart, cashout, and mobile player tabs', async () => {
    const [game, panel, history, css] = await sources([
        './src/games/crash/CrashGame.jsx',
        './src/games/crash/BettingPanel.jsx',
        './src/games/crash/GameHistory.jsx',
        './src/games/crash/CrashGame.css',
    ])
    assert.match(game, /<BettingPanel/)
    assert.match(game, /<GameChart/)
    assert.match(game, /<GameHistory/)
    assert.match(game, /<PlayerBets/)
    assert.match(game, /aviator-main-layout/)
    assert.match(panel, /handleActionClick/)
    assert.match(history, /aviator-history-bar/)
    assert.match(css, /\.aviator-main-layout/)
    assert.match(css, /\.aviator-stage-column/)
    assert.match(css, /\.aviator-bets-column/)
    assert.match(css, /\.aviator-dual-panels-wrap/)
})

test('Plinko mobile presentation preserves board ratio and critical controls', async () => {
    const [game, sidebar, board, gameCss, sidebarCss, boardCss] = await sources([
        './src/games/plinko/PlinkoGame.jsx',
        './src/games/plinko/Sidebar.jsx',
        './src/games/plinko/Plinko.jsx',
        './src/games/plinko/PlinkoGame.css',
        './src/games/plinko/Sidebar.css',
        './src/games/plinko/Plinko.css',
    ])
    assert.match(game, /<MobileBetSheet[^>]*title="Plinko bet controls"/)
    assert.match(game, /plinko-bet-sheet/)
    assert.match(sidebar, /mobile-sheet-secondary/)
    assert.match(gameCss, /\.recent-plays-list\s*\{[^}]*overflow-x:\s*auto/s)
    assert.match(sidebarCss, /\.ball-types-grid\s*\{[^}]*overflow-x:\s*auto/s)
    assert.match(boardCss, /aspect-ratio:\s*760\s*\/\s*570/)
    assert.match(boardCss, /\.plinko-canvas\s*\{[^}]*width:\s*100%\s*!important[^}]*height:\s*100%\s*!important/s)
    assert.equal((board.match(/className="plinko-canvas"/g) || []).length, 1)
})

test('mobile bet sheet owns collapse, escape, focus, and scroll-lock behavior', async () => {
    const [component, css] = await sources([
        './src/components/MobileBetSheet.jsx',
        './src/components/MobileBetSheet.css',
    ])

    assert.match(component, /data-state=/)
    assert.match(component, /aria-expanded=/)
    assert.match(component, /event\.key === 'Escape'/)
    assert.match(component, /event\.key === 'Tab'/)
    assert.match(component, /backgroundNode\.inert = true/)
    assert.match(component, /aria-modal=/)
    assert.match(component, /mobile-overlay-open/)
    assert.match(css, /position:\s*static/)
    assert.match(css, /\.mobile-bet-sheet\[data-state='collapsed'\]/)
    assert.match(css, /prefers-reduced-motion/)
})

test('admin panel enables full desktop and mobile scrolling without breaking casino zero-scroll', async () => {
    const [adminPanelJsx, adminPanelCss, globalCss] = await sources([
        './src/admin-panel/AdminPanel.jsx',
        './src/admin-panel/AdminPanel.css',
        './src/styles/index.css',
    ])

    // AdminPanel component activates and cleans up scrollable body class
    assert.match(adminPanelJsx, /classList\.add\('admin-page-active'\)/)
    assert.match(adminPanelJsx, /classList\.remove\('admin-page-active'\)/)

    // Global CSS provides viewport scroll override for admin
    assert.match(globalCss, /html\.admin-page-active[\s\S]*overflow-y:\s*auto\s*!important/)
    assert.match(globalCss, /body\.admin-page-active[\s\S]*height:\s*auto\s*!important/)
    assert.match(globalCss, /:has\(\.admin-container\)/)

    // AdminPanel CSS provides scrollbar and modal scrolling
    assert.match(adminPanelCss, /html\.admin-page-active[\s\S]*overflow-y:\s*auto\s*!important/)
    assert.match(adminPanelCss, /\.admin-modal\s*\{[^}]*max-height:\s*90(?:vh|dvh)[^}]*overflow-y:\s*auto/s)
    assert.match(adminPanelCss, /\.admin-table-wrapper\s*\{[^}]*overflow-x:\s*auto/s)

    // Casino game zero-scroll isolation is preserved in globalCss
    assert.match(globalCss, /html,\s*body\s*\{[^}]*height:\s*100%;[^}]*overflow:\s*hidden;/s)
    assert.match(globalCss, /\.main-content:has\(\.crash-game\)/)
})


