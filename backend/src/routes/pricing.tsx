import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import SectionRule from '../components/SectionRule'
import {
  FREE_FEATURES,
  PLAN_FEATURES,
  SELF_HOST_FEATURES,
  SEAT_FIRST_EUR,
  SEAT_ADDITIONAL_EUR,
  SEATS_MIN,
  SEATS_MAX,
  clampSeats,
  seatMonthlyEur,
  seatYearlyEur,
} from '../lib/plans'
import type { BillingInterval } from '../lib/plans'

export const Route = createFileRoute('/pricing')({
  head: () => ({
    meta: [
      { title: 'Pricing Plans — AmratGames.com' },
      {
        name: 'description',
        content:
          'AmratGames.com cloud starts free — build, test, and share games. Scale up with team seats, full revision histories, Amrat GraphQL telemetry, and permanent share links.',
      },
    ],
  }),
  component: PricingPage,
})

const REPO = 'https://amratgames.com'

const FAQ = [
  {
    q: 'Is the paid version different from the open-source one?',
    a: 'No. The entire platform is open source and self-hosters get 100% of the features. There is no enterprise edition and no feature gating. Billing code only runs on our hosted instance.',
  },
  {
    q: 'What does the free cloud plan include?',
    a: 'A full solo workflow, no card required: unlimited games and play sessions, 5 GiB of storage, and one active share link that lives up to 7 days. Each game keeps its latest revision — every push replaces the previous one. Subscribe when you need teammates, full revision history or share links that never expire.',
  },
  {
    q: 'What exactly does the subscription pay for?',
    a: 'Hosting, and room to grow past the free limits: teammates, full revision history, never-expiring share links, and 10 GiB of storage per seat — on our infrastructure with wildcard play subdomains, backups and updates. If you would rather run it yourself, everything is in the repo.',
  },
  {
    q: 'What is a seat?',
    a: 'A seat is a member slot in a workspace. Each seat also raises your quotas: 10 GiB of math storage and 5 active share links per seat. Add or remove seats as your team changes.',
  },
  {
    q: 'How is it priced?',
    a: 'The first seat is €3/month, and every additional seat is €2/month — so a 3-person team is €7/month. Yearly billing gives you 2 months free. Need more storage? Add 10 GiB units for €1/month each.',
  },
  {
    q: 'What do I need to self-host the cloud platform?',
    a: 'A single server binary (or Docker image), Postgres, and Caddy for TLS. Object storage is the local filesystem by default, or any S3-compatible bucket.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Better — the free plan has no clock. Build, test and share on the hosted cloud for as long as you like within the free limits; billing only starts if you subscribe, and you can cancel anytime from the billing portal. Payments and EU VAT are handled by our merchant of record. And self-hosting stays entirely free, with every feature.',
  },
  {
    q: 'Why AGPL for the server?',
    a: 'Self-hosting is untouched. The AGPL only prevents someone from reselling our server as a closed hosted service, the same licence choice Plausible and Cal.com made. The desktop app and the engine stay MIT.',
  },
]

function SeatCalculator() {
  const [interval, setInterval] = useState<BillingInterval>('month')
  const [seats, setSeats] = useState(1)

  const step = (delta: number) => setSeats((s) => clampSeats(s + delta))
  const monthly = seatMonthlyEur(seats)
  const yearly = seatYearlyEur(seats)
  const price = interval === 'month' ? monthly : yearly

  return (
    <article className="card flex flex-col p-7 border-amber/35">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-base font-semibold">Cloud — seat plan</h2>
        <span className="rounded-full border border-amber/40 px-2.5 py-1 font-mono text-[0.62rem] tracking-[0.1em] uppercase text-amber">
          Cloud
        </span>
      </div>

      <p className="mt-4 mb-0 text-sm text-moss">
        €{SEAT_FIRST_EUR}/mo for the first seat, €{SEAT_ADDITIONAL_EUR}/mo per additional seat.
      </p>

      {/* Interval toggle */}
      <div className="mt-5 inline-flex items-center rounded-lg border border-line p-1">
        {(['month', 'year'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setInterval(value)}
            aria-pressed={interval === value}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              interval === value ? 'bg-panel2 text-ink' : 'text-moss hover:text-ink'
            }`}
          >
            {value === 'month' ? 'Monthly' : 'Yearly'}
          </button>
        ))}
        <span className="px-3 font-mono text-[0.65rem] tracking-[0.08em] text-amber">2 months free</span>
      </div>

      {/* Seat stepper */}
      <div className="mt-5 flex items-center gap-3">
        <span className="text-sm text-moss">Seats</span>
        <div className="inline-flex items-center rounded-md border border-line">
          <button
            type="button"
            aria-label="Fewer seats"
            onClick={() => step(-1)}
            disabled={seats <= SEATS_MIN}
            className="px-3 py-1.5 text-lg leading-none text-moss transition-colors hover:text-ink disabled:opacity-40"
          >
            −
          </button>
          <span className="min-w-[3.5rem] px-2 text-center font-mono text-sm font-medium text-ink">
            {seats}
          </span>
          <button
            type="button"
            aria-label="More seats"
            onClick={() => step(1)}
            disabled={seats >= SEATS_MAX}
            className="px-3 py-1.5 text-lg leading-none text-moss transition-colors hover:text-ink disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      {/* Computed total */}
      <p className="display mt-6 mb-0 text-4xl font-bold">
        €{price}
        <span className="font-sans ml-2 text-sm font-normal text-faint">
          / {interval === 'month' ? 'month' : 'year'}
        </span>
      </p>
      <p className="mt-1 mb-0 font-mono text-[0.7rem] tracking-[0.06em] text-faint">
        {interval === 'month'
          ? `= €${monthly}/mo · €${yearly}/yr billed yearly`
          : `= €${monthly}/mo billed monthly · 2 months free`}
      </p>

      <ul
        className="mt-6 mb-0 flex-1 space-y-2.5 pl-0 text-sm text-moss"
        style={{ listStyle: 'none' }}
      >
        {PLAN_FEATURES.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      <a href="https://amratgames.com" className="btn btn-primary mt-7 w-full">
        Get started
      </a>
    </article>
  )
}

function CloudFreeCard() {
  return (
    <article className="card flex flex-col p-7 border-mint/35">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-base font-semibold">Cloud — Free</h2>
        <span className="rounded-full border border-mint/40 px-2.5 py-1 font-mono text-[0.62rem] tracking-[0.1em] uppercase text-mint">
          No card
        </span>
      </div>

      <p className="mt-4 mb-0 text-sm text-moss">
        Everything you need to build and share a game, solo-sized.
      </p>

      <p className="display mt-6 mb-0 text-4xl font-bold">
        €0
        <span className="font-sans ml-2 text-sm font-normal text-faint">/ month</span>
      </p>

      <ul
        className="mt-6 mb-0 flex-1 space-y-2.5 pl-0 text-sm text-moss"
        style={{ listStyle: 'none' }}
      >
        {FREE_FEATURES.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      <a href="https://amratgames.com" className="btn btn-primary mt-7 w-full">
        Start free
      </a>
    </article>
  )
}

function PricingPage() {
  return (
    <main className="wrap pt-16 pb-8">
      <SectionRule label="pricing" />
      <h1 className="display mt-12 mb-0 max-w-xl text-4xl font-bold sm:text-5xl">
        Start free. Cloud or self-host.
      </h1>
      <p className="mt-6 mb-0 max-w-2xl leading-relaxed text-moss">
        The hosted cloud starts free: create a game, push math, test it and hand anyone a
        playable share link — no card required. A seat subscription adds teammates, full
        revision history, permanent share links and per-seat storage. And self-hosting stays
        free forever with every feature — no gating, no enterprise edition.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Self-host */}
        <article className="card flex flex-col border-dashed p-7">
          <h2 className="m-0 text-base font-semibold">Self-host</h2>
          <p className="display mt-4 mb-0 text-4xl font-bold">
            €0
            <span className="font-sans ml-2 text-sm font-normal text-faint">forever</span>
          </p>
          <ul
            className="mt-6 mb-0 flex-1 space-y-2.5 pl-0 text-sm text-moss"
            style={{ listStyle: 'none' }}
          >
            {SELF_HOST_FEATURES.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
          <a
            href={REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost mt-7 w-full"
          >
            Deploy from GitHub
          </a>
        </article>

        <CloudFreeCard />

        <SeatCalculator />
      </div>

      <p className="mt-6 mb-0 font-mono text-[0.7rem] tracking-[0.06em] text-faint">
        Extra storage: €1/mo per 10 GiB · cancel anytime · payments and VAT handled by our merchant
        of record
      </p>

      {/* FAQ */}
      <section className="pt-20">
        <SectionRule label="FAQ" />
        <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <h2 className="display mt-0 mb-0 text-3xl font-bold sm:text-4xl">Fair questions.</h2>
          <div>
            {FAQ.map((item) => (
              <details key={item.q} className="faq-item border-b border-line py-5 first:pt-0">
                <summary className="flex items-baseline justify-between gap-6 text-[0.98rem] font-medium">
                  {item.q}
                  <span className="faq-marker font-mono text-mint" aria-hidden="true" />
                </summary>
                <p className="mt-3 mb-0 max-w-xl text-sm leading-relaxed text-moss">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
