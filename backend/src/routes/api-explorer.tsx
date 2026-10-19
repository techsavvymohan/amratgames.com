import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import SectionRule from '../components/SectionRule'

export const Route = createFileRoute('/api-explorer')({
  head: () => ({
    meta: [
      { title: 'Amrat GraphQL API Studio — AmratGames.com' },
      {
        name: 'description',
        content:
          'Comprehensive AmratGames.com GraphQL API Explorer & Documentation: Active Bets, Crypto Balances, Highrollers, Withdrawals, Tips, and Transactions with instant cURL, Python, and Node.js code generators.',
      },
    ],
  }),
  component: ApiExplorerPage,
})

interface QueryEndpoint {
  id: string
  name: string
  category: 'Bets' | 'Wallet' | 'Casino' | 'Social' | 'Finance'
  description: string
  requiresAuth: boolean
  query: string
  variables: Record<string, unknown>
  mockResponse: Record<string, unknown>
}

const ENDPOINTS: QueryEndpoint[] = [
  {
    id: 'active_bets',
    name: 'Active Bets',
    category: 'Bets',
    description: 'Get currently active (open) sport bets with fixture status, odds, and potential total multipliers.',
    requiresAuth: true,
    query: `query GetActiveBets($limit: Int) {
  user {
    sportBetList(limit: $limit, offset: 0) {
      id
      bet {
        ... on SportBet {
          id
          amount
          currency
          status
          active
          potentialMultiplier
          createdAt
          outcomes {
            odds
            fixtureName
            outcome {
              name
            }
            fixture {
              name
              status
              tournament {
                category {
                  sport {
                    name
                    slug
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}`,
    variables: { limit: 10 },
    mockResponse: {
      data: {
        user: {
          sportBetList: [
            {
              id: 'sbet_849204819',
              bet: {
                id: 'sb_918239',
                amount: 150.0,
                currency: 'usdt',
                status: 'pending',
                active: true,
                potentialMultiplier: 4.85,
                createdAt: '2026-09-22T10:45:00Z',
                outcomes: [
                  {
                    odds: 2.15,
                    fixtureName: 'Real Madrid vs Barcelona',
                    outcome: { name: 'Real Madrid Win' },
                    fixture: {
                      name: 'Real Madrid vs Barcelona',
                      status: 'live',
                      tournament: {
                        category: { sport: { name: 'Soccer', slug: 'soccer' } },
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    },
  },
  {
    id: 'balance',
    name: 'User Balances',
    category: 'Wallet',
    description: 'Get all available and vault crypto balances across BTC, ETH, USDT, LTC, DOGE, SOL, and more.',
    requiresAuth: true,
    query: `query GetUserBalance {
  user {
    id
    name
    balances {
      available {
        amount
        currency
      }
      vault {
        amount
        currency
      }
    }
  }
}`,
    variables: {},
    mockResponse: {
      data: {
        user: {
          id: 'usr_amrat_vip_99',
          name: 'AmratHighroller',
          balances: [
            { available: { amount: 2.3451, currency: 'btc' }, vault: { amount: 1.0, currency: 'btc' } },
            { available: { amount: 25400.5, currency: 'usdt' }, vault: { amount: 10000.0, currency: 'usdt' } },
            { available: { amount: 14.85, currency: 'eth' }, vault: { amount: 5.0, currency: 'eth' } },
            { available: { amount: 125.0, currency: 'ltc' }, vault: { amount: 25.0, currency: 'ltc' } },
            { available: { amount: 84000.0, currency: 'doge' }, vault: { amount: 15000.0, currency: 'doge' } },
          ],
        },
      },
    },
  },
  {
    id: 'highrollers',
    name: 'Highrollers Feed',
    category: 'Casino',
    description: 'Real-time public feed of the largest bets placed across the platform (no authentication required).',
    requiresAuth: false,
    query: `query GetHighrollers($limit: Int, $offset: Int) {
  highrollerSportBets(limit: $limit, offset: $offset) {
    bet {
      ... on SportBet {
        id
        amount
        currency
        status
        payout
        payoutMultiplier
        potentialMultiplier
        createdAt
        user {
          name
        }
        outcomes {
          odds
          fixtureName
          outcome {
            name
          }
          fixture {
            name
            status
            tournament {
              name
              category {
                sport {
                  name
                  slug
                }
              }
            }
          }
        }
      }
    }
  }
}`,
    variables: { limit: 5, offset: 0 },
    mockResponse: {
      data: {
        highrollerSportBets: [
          {
            bet: {
              id: 'sb_9948123',
              amount: 10000.0,
              currency: 'usdt',
              status: 'won',
              payout: 38500.0,
              payoutMultiplier: 3.85,
              potentialMultiplier: 3.85,
              createdAt: '2026-09-22T11:15:30Z',
              user: { name: 'CrownWhale' },
              outcomes: [
                {
                  odds: 3.85,
                  fixtureName: 'Manchester City vs Liverpool',
                  outcome: { name: 'Over 3.5 Goals' },
                  fixture: {
                    name: 'Manchester City vs Liverpool',
                    status: 'finished',
                    tournament: {
                      name: 'Premier League',
                      category: { sport: { name: 'Soccer', slug: 'soccer' } },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    },
  },
  {
    id: 'bet_history',
    name: 'Bet History',
    category: 'Bets',
    description: 'Fetch detailed bet history for sports and casino games, including win amounts and multipliers.',
    requiresAuth: true,
    query: `query GetBetHistory($limit: Int, $offset: Int) {
  user {
    betList(limit: $limit, offset: $offset) {
      id
      iid
      game
      amount
      currency
      payout
      payoutMultiplier
      createdAt
    }
  }
}`,
    variables: { limit: 10, offset: 0 },
    mockResponse: {
      data: {
        user: {
          betList: [
            {
              id: 'bet_883921',
              iid: 'house:amrat_royal_gold',
              game: 'Amrat Royal Gold Slot',
              amount: 25.0,
              currency: 'usdt',
              payout: 1250.0,
              payoutMultiplier: 50.0,
              createdAt: '2026-09-22T11:10:04Z',
            },
            {
              id: 'bet_883920',
              iid: 'house:plinko',
              game: 'Plinko 16-Row',
              amount: 50.0,
              currency: 'usdt',
              payout: 5000.0,
              payoutMultiplier: 100.0,
              createdAt: '2026-09-22T11:05:12Z',
            },
          ],
        },
      },
    },
  },
  {
    id: 'trending',
    name: 'Trending Bets',
    category: 'Casino',
    description: 'Public feed of currently popular sport bets and live match fixtures tracking market momentum.',
    requiresAuth: false,
    query: `query GetTrendingBets {
  sportTrendingBets {
    bet {
      ... on SportBet {
        id
        amount
        currency
        potentialMultiplier
        createdAt
        outcomes {
          odds
          fixtureName
          outcome {
            name
          }
          fixture {
            name
            status
            tournament {
              name
              category {
                sport {
                  name
                  slug
                }
              }
            }
          }
        }
      }
    }
  }
}`,
    variables: {},
    mockResponse: {
      data: {
        sportTrendingBets: [
          {
            bet: {
              id: 'tr_109284',
              amount: 500.0,
              currency: 'usdt',
              potentialMultiplier: 2.1,
              createdAt: '2026-09-22T11:20:00Z',
              outcomes: [
                {
                  odds: 2.1,
                  fixtureName: 'Lakers vs Warriors',
                  outcome: { name: 'Warriors -4.5' },
                  fixture: {
                    name: 'Lakers vs Warriors',
                    status: 'live',
                    tournament: {
                      name: 'NBA',
                      category: { sport: { name: 'Basketball', slug: 'basketball' } },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    },
  },
  {
    id: 'transactions',
    name: 'Transaction Ledger',
    category: 'Finance',
    description: 'Query account ledger for deposits, withdrawals, tips, bonuses, and rakeback claims.',
    requiresAuth: true,
    query: `query GetTransactions($limit: Int, $offset: Int) {
  user {
    transactions(limit: $limit, offset: $offset) {
      id
      amount
      currency
      createdAt
      type
      status
    }
  }
}`,
    variables: { limit: 10, offset: 0 },
    mockResponse: {
      data: {
        user: {
          transactions: [
            { id: 'tx_98124', amount: 5000.0, currency: 'usdt', createdAt: '2026-09-22T08:00:00Z', type: 'deposit', status: 'completed' },
            { id: 'tx_98123', amount: 150.0, currency: 'usdt', createdAt: '2026-09-21T22:30:00Z', type: 'rakeback', status: 'completed' },
            { id: 'tx_98122', amount: 2500.0, currency: 'usdt', createdAt: '2026-09-21T18:15:00Z', type: 'withdrawal', status: 'completed' },
          ],
        },
      },
    },
  },
  {
    id: 'tips',
    name: 'Tip History',
    category: 'Social',
    description: 'Retrieve tip transactions received and sent to other players in chat or via username.',
    requiresAuth: true,
    query: `query GetTipHistory($limit: Int, $offset: Int) {
  user {
    tips(limit: $limit, offset: $offset) {
      id
      amount
      currency
      createdAt
      sender {
        name
      }
      receiver {
        name
      }
    }
  }
}`,
    variables: { limit: 10, offset: 0 },
    mockResponse: {
      data: {
        user: {
          tips: [
            { id: 'tip_3391', amount: 50.0, currency: 'usdt', createdAt: '2026-09-22T09:12:00Z', sender: { name: 'AmratHighroller' }, receiver: { name: 'LuckySlot' } },
            { id: 'tip_3390', amount: 25.0, currency: 'usdt', createdAt: '2026-09-21T14:40:00Z', sender: { name: 'CryptoKing' }, receiver: { name: 'AmratHighroller' } },
          ],
        },
      },
    },
  },
  {
    id: 'send_tip',
    name: 'Send Tip Mutation',
    category: 'Social',
    description: 'Execute instant cryptocurrency tipping to another AmratGames.com user.',
    requiresAuth: true,
    query: `mutation SendTip(
  $username: String!
  $amount: Float!
  $currency: CurrencyEnum!
  $chat: Boolean
) {
  tip(
    username: $username
    amount: $amount
    currency: $currency
    chat: $chat
  ) {
    id
    amount
    currency
    receiver {
      name
    }
    createdAt
  }
}`,
    variables: { username: 'LuckyPlayer7', amount: 20.0, currency: 'usdt', chat: true },
    mockResponse: {
      data: {
        tip: {
          id: 'tip_99412',
          amount: 20.0,
          currency: 'usdt',
          receiver: { name: 'LuckyPlayer7' },
          createdAt: '2026-09-22T11:25:00Z',
        },
      },
    },
  },
  {
    id: 'withdrawal',
    name: 'Withdrawal Flow (3-Steps)',
    category: 'Finance',
    description: '3-Step withdrawal process: Check network settings, dispatch email OTP code, and submit signed withdrawal.',
    requiresAuth: true,
    query: `# Step 1: Query currency network limits & fees
query GetWithdrawalSettings {
  getCurrencySettings {
    currency
    chains {
      name
      withdrawalFee
      minWithdrawal
      maxWithdrawal
    }
  }
}

# Step 2: Request email OTP code
mutation SendWithdrawalEmail(
  $currency: CurrencyEnum!
  $chain: String!
  $address: String!
  $amount: Float!
) {
  sendWalletWithdrawalEmail(
    currency: $currency
    chain: $chain
    address: $address
    amount: $amount
  ) {
    success
  }
}

# Step 3: Execute withdrawal with OTP
mutation CreateWithdrawal(
  $amount: Float!
  $currency: CurrencyEnum!
  $address: String!
  $chain: String!
  $otp: String!
) {
  createWithdrawal(
    amount: $amount
    currency: $currency
    address: $address
    chain: $chain
    otp: $otp
  ) {
    id
    hash
    amount
    currency
    createdAt
  }
}`,
    variables: { currency: 'usdt', chain: 'erc20', address: '0x71C...4e', amount: 1000.0, otp: '849201' },
    mockResponse: {
      data: {
        createWithdrawal: {
          id: 'wth_78201',
          hash: '0x3a9f1b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a',
          amount: 1000.0,
          currency: 'usdt',
          createdAt: '2026-09-22T11:28:40Z',
        },
      },
    },
  },
]

const CURRENCIES = [
  { symbol: 'INR', name: 'Indian Rupee (₹)', network: 'UPI / NetBanking / IMPS (Instant Settlement)', decimals: 2 },
  { symbol: 'BTC', name: 'Bitcoin', network: 'Bitcoin (SegWit/Legacy)', decimals: 8 },
  { symbol: 'ETH', name: 'Ethereum', network: 'ERC-20', decimals: 8 },
  { symbol: 'USDT', name: 'Tether USDT', network: 'ERC-20, TRC-20, Polygon, Arbitrum, Solana', decimals: 6 },
  { symbol: 'LTC', name: 'Litecoin', network: 'Litecoin Mainnet', decimals: 8 },
  { symbol: 'DOGE', name: 'Dogecoin', network: 'Dogecoin Mainnet', decimals: 8 },
  { symbol: 'SOL', name: 'Solana', network: 'Solana Native', decimals: 9 },
  { symbol: 'TRX', name: 'TRON', network: 'TRC-20', decimals: 6 },
  { symbol: 'BNB', name: 'Binance Coin', network: 'BNB Smart Chain (BEP-20)', decimals: 8 },
  { symbol: 'XRP', name: 'Ripple', network: 'Ripple (XRP Ledger)', decimals: 6 },
]

function ApiExplorerPage() {
  const [selectedId, setSelectedId] = useState<string>('active_bets')
  const [apiKey, setApiKey] = useState<string>('')
  const [copied, setCopied] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'graphql' | 'curl' | 'python' | 'node' | 'response'>('graphql')

  const endpoint = ENDPOINTS.find((e) => e.id === selectedId) || ENDPOINTS[0]

  function copyCode(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const cleanQuery = endpoint.query.trim().replace(/"/g, '\\"').replace(/\n/g, '\\n')
  const curlSnippet = `curl -X POST https://amratgames.com/_api/graphql \\
  -H "Content-Type: application/json" \\
  -H "x-access-token: ${apiKey || 'YOUR_AMRAT_API_KEY'}" \\
  -d '{"query":"${cleanQuery}","variables":${JSON.stringify(endpoint.variables)}}'`

  const pythonSnippet = `import requests

API_KEY = "${apiKey || 'YOUR_AMRAT_API_KEY'}"
ENDPOINT = "https://amratgames.com/_api/graphql"

headers = {
    "Content-Type": "application/json",
    "x-access-token": API_KEY,
}

payload = {
    "query": """${endpoint.query}""",
    "variables": ${JSON.stringify(endpoint.variables, null, 4)}
}

response = requests.post(ENDPOINT, json=payload, headers=headers)
data = response.json()
print(data)`

  const nodeSnippet = `const API_KEY = '${apiKey || 'YOUR_AMRAT_API_KEY'}';
const ENDPOINT = 'https://amratgames.com/_api/graphql';

async function executeQuery() {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-access-token': API_KEY,
    },
    body: JSON.stringify({
      query: \`${endpoint.query}\`,
      variables: ${JSON.stringify(endpoint.variables, null, 2)},
    }),
  });

  const result = await response.json();
  console.log(JSON.stringify(result, null, 2));
}

executeQuery();`

  return (
    <main className="wrap pt-16 pb-24">
      {/* Header Banner */}
      <div className="flex flex-col items-start justify-between gap-6 pb-8 sm:flex-row sm:items-end">
        <div>
          <div className="gold-badge mb-3">
            <img src="https://res.cloudinary.com/r1fegrxo/image/upload/f_auto,q_auto,w_64/v1792395452/amratgames/amrat-logo.png" alt="" className="h-4 w-4 object-contain" />
            <span>AmratGames.com · Amrat GraphQL API Studio</span>
          </div>
          <h1 className="display text-3xl font-black tracking-tight sm:text-5xl gold-gradient-text">
            AmratGames.com GraphQL Studio
          </h1>
          <p className="mt-3 max-w-2xl text-base text-moss">
            Interactive developer suite for AmratGames.com GraphQL operations. Test queries, view response schemas, and copy production-ready code in Python, Node.js, and cURL.
          </p>
        </div>

        <div className="w-full sm:w-auto">
          <label className="block text-xs font-mono uppercase tracking-wider text-amber-400 mb-1.5 font-semibold">
            Amrat x-access-token (Optional)
          </label>
          <input
            type="password"
            placeholder="Paste your API token..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full sm:w-72 rounded-md border border-line2 bg-panel px-3.5 py-2.5 text-xs font-mono text-ink placeholder:text-faint focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400/40"
          />
          <span className="block mt-1 text-[0.7rem] text-faint">
            Settings → Security → API Tokens on AmratGames.com
          </span>
        </div>
      </div>

      <SectionRule label="Operations & Schema Explorer" />

      {/* Main Studio Grid */}
      <div className="mt-10 grid gap-8 lg:grid-cols-[280px_1fr]">
        {/* Sidebar Query Selector */}
        <aside className="flex flex-col gap-2">
          <span className="font-mono text-xs uppercase tracking-widest text-faint px-2">
            API Endpoints ({ENDPOINTS.length})
          </span>
          {ENDPOINTS.map((item) => {
            const isSelected = item.id === endpoint.id
            return (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedId(item.id)
                  setActiveTab('graphql')
                }}
                className={`flex flex-col items-start gap-1 rounded-lg border p-3.5 text-left transition-all ${
                  isSelected
                    ? 'border-amber-400/80 bg-panel2 shadow-[0_0_15px_rgba(245,175,25,0.2)] text-ink'
                    : 'border-line bg-panel/60 text-moss hover:border-line2 hover:text-ink'
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-semibold text-sm">{item.name}</span>
                  <span
                    className={`rounded text-[0.65rem] font-mono px-1.5 py-0.5 uppercase tracking-wider ${
                      item.category === 'Casino'
                        ? 'bg-amber-500/20 text-amber-300'
                        : item.category === 'Wallet'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : item.category === 'Bets'
                            ? 'bg-blue-500/20 text-blue-300'
                            : item.category === 'Finance'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-purple-500/20 text-purple-300'
                    }`}
                  >
                    {item.category}
                  </span>
                </div>
                <span className="text-xs text-faint line-clamp-1">{item.description}</span>
              </button>
            )
          })}
        </aside>

        {/* Code & Response Workspace */}
        <div className="card overflow-hidden border-line">
          {/* Endpoint Info Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-panel2/70 px-6 py-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="live-dot"></span>
                <h2 className="text-lg font-bold text-ink">{endpoint.name}</h2>
                {endpoint.requiresAuth ? (
                  <span className="rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[0.68rem] font-mono text-amber-400">
                    🔒 Requires x-access-token
                  </span>
                ) : (
                  <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[0.68rem] font-mono text-emerald-400">
                    🌐 Public (No Auth)
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-moss">{endpoint.description}</p>
            </div>

            {/* View Tabs */}
            <div className="flex items-center gap-1 rounded-lg border border-line bg-pit p-1">
              {(
                [
                  { id: 'graphql', label: 'Query' },
                  { id: 'curl', label: 'cURL' },
                  { id: 'python', label: 'Python' },
                  { id: 'node', label: 'Node.js' },
                  { id: 'response', label: 'Payload' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-md px-3 py-1 text-xs font-mono transition-colors ${
                    activeTab === tab.id
                      ? 'bg-mint text-pit font-bold shadow-sm'
                      : 'text-moss hover:text-ink'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Code Viewer Panel */}
          <div className="relative p-6 bg-[#07080c]">
            <button
              onClick={() => {
                const text =
                  activeTab === 'graphql'
                    ? endpoint.query
                    : activeTab === 'curl'
                      ? curlSnippet
                      : activeTab === 'python'
                        ? pythonSnippet
                        : activeTab === 'node'
                          ? nodeSnippet
                          : JSON.stringify(endpoint.mockResponse, null, 2)
                copyCode(text, activeTab)
              }}
              className="absolute top-4 right-4 z-10 btn btn-ghost !px-2.5 !py-1 text-xs font-mono"
            >
              {copied === activeTab ? '✓ Copied!' : 'Copy'}
            </button>

            {activeTab === 'graphql' && (
              <pre className="m-0 overflow-x-auto font-mono text-xs leading-relaxed text-amber-200/90">
                <code>{endpoint.query}</code>
              </pre>
            )}

            {activeTab === 'curl' && (
              <pre className="m-0 overflow-x-auto font-mono text-xs leading-relaxed text-amber-300/90">
                <code>{curlSnippet}</code>
              </pre>
            )}

            {activeTab === 'python' && (
              <pre className="m-0 overflow-x-auto font-mono text-xs leading-relaxed text-emerald-400/90">
                <code>{pythonSnippet}</code>
              </pre>
            )}

            {activeTab === 'node' && (
              <pre className="m-0 overflow-x-auto font-mono text-xs leading-relaxed text-blue-300/90">
                <code>{nodeSnippet}</code>
              </pre>
            )}

            {activeTab === 'response' && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-xs text-mint">HTTP 200 OK · application/json</span>
                  <span className="font-mono text-xs text-faint">simulated response</span>
                </div>
                <pre className="m-0 max-h-[480px] overflow-auto rounded border border-line bg-panel p-4 font-mono text-xs leading-relaxed text-dim">
                  <code>{JSON.stringify(endpoint.mockResponse, null, 2)}</code>
                </pre>
              </div>
            )}
          </div>

          {/* Footer info strip */}
          <div className="flex flex-wrap items-center justify-between border-t border-line bg-panel px-6 py-3 text-xs text-moss font-mono">
            <span>Endpoint: POST https://amrat.com/_api/graphql</span>
            <span className="text-amber-400 font-semibold">AmratGames.com API Hub</span>
          </div>
        </div>
      </div>

      {/* Supported Currencies & Network Reference */}
      <section className="mt-20">
        <SectionRule label="Supported Currencies & Networks" />
        <h2 className="display mt-8 mb-4 text-2xl font-bold">
          Platform Crypto Asset Reference
        </h2>
        <p className="text-sm text-moss max-w-xl mb-6">
          AmratGames.com supports direct deposits, wagers, and withdrawals across major Layer 1 and Layer 2 blockchains.
        </p>

        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-line bg-panel2/60 text-faint uppercase">
              <tr>
                <th className="py-3 px-5">Symbol</th>
                <th className="py-3 px-5">Asset Name</th>
                <th className="py-3 px-5">Supported Networks</th>
                <th className="py-3 px-5">Precision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {CURRENCIES.map((c) => (
                <tr key={c.symbol} className="hover:bg-panel2/30 transition-colors">
                  <td className="py-3 px-5 font-bold text-amber-400">{c.symbol}</td>
                  <td className="py-3 px-5 text-ink">{c.name}</td>
                  <td className="py-3 px-5 text-moss">{c.network}</td>
                  <td className="py-3 px-5 text-faint">{c.decimals} decimals</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
