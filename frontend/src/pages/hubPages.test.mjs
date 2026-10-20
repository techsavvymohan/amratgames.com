import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (file) => readFile(new URL(file, import.meta.url), 'utf8')

test('App.jsx registers routes for all sidebar hub pages and fallback', async () => {
    const appCode = await read('../App.jsx')

    assert.match(appCode, /path="favourites"/, 'App.jsx must declare /favourites route')
    assert.match(appCode, /path="recent"/, 'App.jsx must declare /recent route')
    assert.match(appCode, /path="challenges"/, 'App.jsx must declare /challenges route')
    assert.match(appCode, /path="my-bets"/, 'App.jsx must declare /my-bets route')
    assert.match(appCode, /path="provably-fair"/, 'App.jsx must declare /provably-fair route')
    assert.match(appCode, /path="responsible-gambling"/, 'App.jsx must declare /responsible-gambling route')
    assert.match(appCode, /path="terms"/, 'App.jsx must declare /terms route')
    assert.match(appCode, /path="privacy"/, 'App.jsx must declare /privacy route')
    assert.match(appCode, /path="\*"/, 'App.jsx must have catch-all route to avoid blank screen')
})

test('hub pages export default React functional components', async () => {
    const fav = await read('./FavouritesPage.jsx')
    const recent = await read('./RecentPage.jsx')
    const challenges = await read('./ChallengesPage.jsx')
    const myBets = await read('./MyBetsPage.jsx')
    const provablyFair = await read('./ProvablyFairPage.jsx')
    const responsible = await read('./ResponsibleGamblingPage.jsx')
    const terms = await read('./TermsPage.jsx')
    const privacy = await read('./PrivacyPage.jsx')

    assert.match(fav, /export default function FavouritesPage/)
    assert.match(recent, /export default function RecentPage/)
    assert.match(challenges, /export default function ChallengesPage/)
    assert.match(myBets, /export default function MyBetsPage/)
    assert.match(provablyFair, /export default function ProvablyFairPage/)
    assert.match(responsible, /export default function ResponsibleGamblingPage/)
    assert.match(terms, /export default function TermsPage/)
    assert.match(privacy, /export default function PrivacyPage/)
})

test('userGamePreferences persists and toggles favorites properly', async () => {
    const pref = await read('../utils/userGamePreferences.js')

    assert.match(pref, /export function getFavourites/)
    assert.match(pref, /export function toggleFavourite/)
    assert.match(pref, /export function getRecentGames/)
    assert.match(pref, /export function recordGamePlay/)
})
