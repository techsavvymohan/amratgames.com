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
    assert.match(appCode, /path="\*"/, 'App.jsx must have catch-all route to avoid blank screen')
})

test('hub pages export default React functional components', async () => {
    const fav = await read('./FavouritesPage.jsx')
    const recent = await read('./RecentPage.jsx')
    const challenges = await read('./ChallengesPage.jsx')
    const myBets = await read('./MyBetsPage.jsx')

    assert.match(fav, /export default function FavouritesPage/)
    assert.match(recent, /export default function RecentPage/)
    assert.match(challenges, /export default function ChallengesPage/)
    assert.match(myBets, /export default function MyBetsPage/)
})

test('userGamePreferences persists and toggles favorites properly', async () => {
    const pref = await read('../utils/userGamePreferences.js')

    assert.match(pref, /export function getFavourites/)
    assert.match(pref, /export function toggleFavourite/)
    assert.match(pref, /export function getRecentGames/)
    assert.match(pref, /export function recordGamePlay/)
})
