import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SEO_ROUTES = {
    '/': {
        title: "AmratGames.com — India's Premier Online Casino | Instant UPI & Bank Withdrawal",
        description: "Play genuine online casino games in Indian Rupees (₹). Instant UPI deposits, 24/7 bank withdrawals, 99% Return to Player (RTP) across Rocket Crash, Plinko, Mines & Dino.",
        canonical: 'https://amratgames.com/',
        heading: "India's Premier Online Casino & Provably Fair Gaming Platform",
        hasOwnH1: true,
        schema: {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "AmratGames.com",
            "url": "https://amratgames.com/",
            "description": "Premier Provably Fair Casino Gaming Platform in Indian Rupees.",
            "inLanguage": "en-IN"
        }
    },
    '/crash': {
        title: "Play Aviator Crash Game Online — 99% RTP | AmratGames",
        description: "Play genuine Aviator Crash online at AmratGames. Watch the rocket multiplier soar up to 10,000x with 99% RTP, auto-cashout, and instant UPI payouts.",
        canonical: 'https://amratgames.com/crash',
        heading: "Aviator Crash — 99% RTP Provably Fair Rocket Multiplier Game",
        hasOwnH1: false,
        schema: {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Amrat Aviator Crash",
            "applicationCategory": "GameApplication",
            "operatingSystem": "Web, iOS, Android, Windows, macOS",
            "offers": { "@type": "Offer", "price": "0", "priceCurrency": "INR" },
            "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.9", "reviewCount": "840" }
        }
    },
    '/plinko': {
        title: "Plinko Game Online — Up to 1,000x Multipliers | AmratGames",
        description: "Drop balls through customizable 8-16 rows on AmratGames Plinko. Authentic physics, Provably Fair HMAC-SHA256 verification, and 99% RTP.",
        canonical: 'https://amratgames.com/plinko',
        heading: "Plinko — 99% RTP Provably Fair Peg Drop Casino Game",
        hasOwnH1: false,
        schema: {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Amrat Plinko",
            "applicationCategory": "GameApplication",
            "operatingSystem": "Web, iOS, Android, Windows, macOS",
            "offers": { "@type": "Offer", "price": "0", "priceCurrency": "INR" },
            "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.9", "reviewCount": "620" }
        }
    },
    '/mines': {
        title: "Mines & Diamonds Game — 10,000x Win Multiplier | AmratGames",
        description: "Uncover sparkling diamonds on the 5x5 Mines grid at AmratGames. Configurable 1-24 mines, cash out at any time, 99% RTP with instant INR withdrawals.",
        canonical: 'https://amratgames.com/mines',
        heading: "Mines & Diamonds — 99% RTP Provably Fair 5x5 Grid Casino Game",
        hasOwnH1: false,
        schema: {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Amrat Mines & Diamonds",
            "applicationCategory": "GameApplication",
            "operatingSystem": "Web, iOS, Android, Windows, macOS",
            "offers": { "@type": "Offer", "price": "0", "priceCurrency": "INR" },
            "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.9", "reviewCount": "710" }
        }
    },
    '/dino': {
        title: "Dino Runner Casino Game — Jump & Cash Out | AmratGames",
        description: "Guide the T-Rex over obstacles in the Dino Runner casino arcade. Multipliers increase with every jump, 99% RTP Provably Fair gaming.",
        canonical: 'https://amratgames.com/dino',
        heading: "Dino Runner — 99% RTP Arcade Obstacle Casino Game",
        hasOwnH1: false,
        schema: {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Amrat Dino Runner",
            "applicationCategory": "GameApplication",
            "operatingSystem": "Web, iOS, Android, Windows, macOS",
            "offers": { "@type": "Offer", "price": "0", "priceCurrency": "INR" },
            "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "490" }
        }
    },
    '/limbo': {
        title: "Limbo Game Online — Win Up to 1,000,000x | AmratGames",
        description: "Set your target multiplier up to 1,000,000x in Limbo on AmratGames. Provably fair instant roll outcomes with low 1% house edge.",
        canonical: 'https://amratgames.com/limbo',
        heading: "Limbo — 99% RTP 1,000,000x Target Multiplier Roll Game",
        hasOwnH1: false,
        schema: {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Amrat Limbo",
            "applicationCategory": "GameApplication",
            "operatingSystem": "Web, iOS, Android, Windows, macOS",
            "offers": { "@type": "Offer", "price": "0", "priceCurrency": "INR" },
            "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.9", "reviewCount": "530" }
        }
    },
    '/dragon-tiger': {
        title: "Dragon Tiger Live Card Game — High Roller Table | AmratGames",
        description: "Bet Dragon, Tiger, or Tie in high-speed two-card VIP casino gaming. Fast Macau roadmap trends, 8x tie payouts, and instant UPI cashouts.",
        canonical: 'https://amratgames.com/dragon-tiger',
        heading: "Dragon Tiger — High-Roller VIP Two-Card Casino Table Game",
        hasOwnH1: false,
        schema: {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Amrat Dragon Tiger",
            "applicationCategory": "GameApplication",
            "operatingSystem": "Web, iOS, Android, Windows, macOS",
            "offers": { "@type": "Offer", "price": "0", "priceCurrency": "INR" },
            "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "380" }
        }
    },
    '/color-match': {
        title: "Color Match Prediction Game — 30-Second Fast Rounds | AmratGames",
        description: "Predict green, red, or violet colors in 30-second rapid draw rounds on AmratGames. 9x number multipliers, 99% RTP fair outcomes.",
        canonical: 'https://amratgames.com/color-match',
        heading: "Color Match — 30-Second Fast Draw Prediction Casino Game",
        hasOwnH1: false,
        schema: {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Amrat Color Match",
            "applicationCategory": "GameApplication",
            "operatingSystem": "Web, iOS, Android, Windows, macOS",
            "offers": { "@type": "Offer", "price": "0", "priceCurrency": "INR" },
            "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "460" }
        }
    },
    '/coin-toss': {
        title: "Coin Toss Game Online — Heads or Tails 1.98x | AmratGames",
        description: "Flip the 3D coin for instant 1.98x payouts on Heads or Tails at AmratGames. Cryptographic Provably Fair verification with instant UPI settlements.",
        canonical: 'https://amratgames.com/coin-toss',
        heading: "Coin Toss — 1.98x Heads or Tails 3D Casino Game",
        hasOwnH1: false,
        schema: {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Amrat Coin Toss",
            "applicationCategory": "GameApplication",
            "operatingSystem": "Web, iOS, Android, Windows, macOS",
            "offers": { "@type": "Offer", "price": "0", "priceCurrency": "INR" },
            "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.9", "reviewCount": "510" }
        }
    },
    '/profile': {
        title: "Player Profile & VIP Cashier | AmratGames",
        description: "Manage your AmratGames account, verify KYC, claim VIP rakeback, track 0.3% affiliate turnover earnings, and view transaction history.",
        canonical: 'https://amratgames.com/profile',
        heading: "Player Profile, VIP Rakeback & Cashier Management",
        hasOwnH1: false,
        schema: {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "Player Profile — AmratGames",
            "url": "https://amratgames.com/profile"
        }
    },
    '/admin': {
        title: "Admin Portal & Risk Command Console | AmratGames",
        description: "Official AmratGames administrative and cashier settlement dashboard.",
        canonical: 'https://amratgames.com/admin',
        heading: "Admin Dashboard & Casino Command Console",
        hasOwnH1: true
    }
}

function updateMetaTag(attr, val, content) {
    let el = document.querySelector(`meta[${attr}="${val}"]`)
    if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, val)
        document.head.appendChild(el)
    }
    el.setAttribute('content', content)
}

function updateCanonical(url) {
    let link = document.querySelector('link[rel="canonical"]')
    if (!link) {
        link = document.createElement('link')
        link.setAttribute('rel', 'canonical')
        document.head.appendChild(link)
    }
    link.setAttribute('href', url)
}

function updateJsonLd(schema) {
    let script = document.getElementById('route-jsonld-schema')
    if (!schema) {
        if (script) script.remove()
        return
    }
    if (!script) {
        script = document.createElement('script')
        script.id = 'route-jsonld-schema'
        script.type = 'application/ld+json'
        document.head.appendChild(script)
    }
    script.textContent = JSON.stringify(schema)
}

export default function SEOManager() {
    const { pathname } = useLocation()
    const currentMeta = SEO_ROUTES[pathname] || SEO_ROUTES['/']

    useEffect(() => {
        // 1. Update Document Title
        document.title = currentMeta.title

        // 2. Update Primary Meta Tags
        updateMetaTag('name', 'title', currentMeta.title)
        updateMetaTag('name', 'description', currentMeta.description)

        // 3. Update Canonical Link
        updateCanonical(currentMeta.canonical)

        // 4. Update OpenGraph Tags
        updateMetaTag('property', 'og:title', currentMeta.title)
        updateMetaTag('property', 'og:description', currentMeta.description)
        updateMetaTag('property', 'og:url', currentMeta.canonical)

        // 5. Update Twitter Card Tags
        updateMetaTag('name', 'twitter:title', currentMeta.title)
        updateMetaTag('name', 'twitter:description', currentMeta.description)
        updateMetaTag('name', 'twitter:url', currentMeta.canonical)

        // 6. Injected Route Structured Data
        updateJsonLd(currentMeta.schema)
    }, [pathname, currentMeta])

    // Render accessible single semantic <h1> for pages that don't render their own visible H1
    if (currentMeta.hasOwnH1) {
        return null
    }

    return (
        <h1 className="sr-only">
            {currentMeta.heading}
        </h1>
    )
}
