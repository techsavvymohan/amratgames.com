import { useState, useEffect } from 'react'
import './ProvablyFairVerifierModal.css'

export default function ProvablyFairVerifierModal({ isOpen, onClose, initialData = null }) {
    const [game, setGame] = useState('limbo')
    const [serverSeed, setServerSeed] = useState('')
    const [clientSeed, setClientSeed] = useState('amrat-player')
    const [nonce, setNonce] = useState('1')
    const [plinkoRows, setPlinkoRows] = useState('16')
    const [plinkoRisk, setPlinkoRisk] = useState('medium')
    const [minesCount, setMinesCount] = useState('3')

    const [isVerifying, setIsVerifying] = useState(false)
    const [verificationResult, setVerificationResult] = useState(null)
    const [errorMsg, setErrorMsg] = useState('')

    // Pre-populate if initialData provided (e.g. from bet slip or game seed)
    useEffect(() => {
        if (!isOpen) return

        if (initialData?.game) {
            setGame(initialData.game.toLowerCase())
        }
        if (initialData?.serverSeed) {
            setServerSeed(initialData.serverSeed)
        }
        if (initialData?.clientSeed) {
            setClientSeed(initialData.clientSeed)
        }
        if (initialData?.nonce) {
            setNonce(String(initialData.nonce))
        }

        // If empty server seed, fetch public seed hash as placeholder
        if (!serverSeed && !initialData?.serverSeed) {
            fetch('/api/games/provably-fair/seed')
                .then((res) => res.json())
                .then((data) => {
                    if (data.serverSeedHash) {
                        setServerSeed('amrat_genesis_provably_fair_secret_seed_2025_99rtp_unbreakable')
                    }
                })
                .catch(() => {})
        }
    }, [isOpen, initialData])

    // Run verification
    const handleVerify = async (e) => {
        if (e) e.preventDefault()
        if (!serverSeed.trim()) {
            setErrorMsg('Server Seed is required')
            return
        }

        setIsVerifying(true)
        setErrorMsg('')
        setVerificationResult(null)

        try {
            const res = await fetch('/api/games/provably-fair/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    game,
                    serverSeed: serverSeed.trim(),
                    clientSeed: clientSeed.trim(),
                    nonce: parseInt(nonce, 10) || 1,
                    rows: parseInt(plinkoRows, 10) || 16,
                    risk: plinkoRisk,
                    minesCount: parseInt(minesCount, 10) || 3
                })
            })

            const data = await res.json()
            if (res.ok && data.success) {
                setVerificationResult(data)
            } else {
                setErrorMsg(data.error || 'Failed to verify outcome')
            }
        } catch {
            setErrorMsg('Network error verifying outcome')
        } finally {
            setIsVerifying(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="verifier-modal-overlay" onClick={onClose}>
            <div className="verifier-modal-container" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="verifier-modal-header">
                    <div className="verifier-header-titles">
                        <span className="verifier-badge">⚖️ MATHEMATICAL FAIRNESS</span>
                        <h2 className="verifier-title">Provably Fair Outcome Verifier</h2>
                        <p className="verifier-subtitle">
                            Verify cryptographic HMAC-SHA256 roll integrity independently. Zero house tampering possible.
                        </p>
                    </div>
                    <button className="verifier-close-btn" onClick={onClose} title="Close">
                        ✕
                    </button>
                </div>

                <div className="verifier-modal-body">
                    {/* Game Selector Tabs */}
                    <div className="verifier-game-tabs">
                        {[
                            { id: 'limbo', label: '🎯 Limbo' },
                            { id: 'crash', label: '🚀 Crash' },
                            { id: 'plinko', label: '🟢 Plinko' },
                            { id: 'dragon-tiger', label: '🐉 Dragon Tiger' },
                            { id: 'color-match', label: '🎨 Color Match' },
                            { id: 'mines', label: '💣 Mines' }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                className={`verifier-tab-btn ${game === tab.id ? 'active' : ''}`}
                                onClick={() => {
                                    setGame(tab.id)
                                    setVerificationResult(null)
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Verification Form */}
                    <form onSubmit={handleVerify} className="verifier-form">
                        <div className="verifier-inputs-grid">
                            <label className="verifier-label full-width">
                                Revealed Server Seed (Secret Key)
                                <input
                                    type="text"
                                    className="verifier-input"
                                    placeholder="Enter server seed..."
                                    value={serverSeed}
                                    onChange={(e) => setServerSeed(e.target.value)}
                                    required
                                />
                                <span className="verifier-input-hint">
                                    The secret seed revealed by the platform upon seed rotation.
                                </span>
                            </label>

                            <label className="verifier-label">
                                Client Seed
                                <input
                                    type="text"
                                    className="verifier-input"
                                    value={clientSeed}
                                    onChange={(e) => setClientSeed(e.target.value)}
                                    required
                                />
                                <span className="verifier-input-hint">Your client-side randomness parameter.</span>
                            </label>

                            <label className="verifier-label">
                                Round Nonce
                                <input
                                    type="number"
                                    min="1"
                                    className="verifier-input"
                                    value={nonce}
                                    onChange={(e) => setNonce(e.target.value)}
                                    required
                                />
                                <span className="verifier-input-hint">The round counter sequence number.</span>
                            </label>

                            {/* Game-Specific Inputs */}
                            {game === 'plinko' && (
                                <>
                                    <label className="verifier-label">
                                        Rows
                                        <select
                                            className="verifier-input"
                                            value={plinkoRows}
                                            onChange={(e) => setPlinkoRows(e.target.value)}
                                        >
                                            {[8, 9, 10, 11, 12, 13, 14, 15, 16].map((r) => (
                                                <option key={r} value={r}>{r} Rows</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="verifier-label">
                                        Risk Level
                                        <select
                                            className="verifier-input"
                                            value={plinkoRisk}
                                            onChange={(e) => setPlinkoRisk(e.target.value)}
                                        >
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                        </select>
                                    </label>
                                </>
                            )}

                            {game === 'mines' && (
                                <label className="verifier-label">
                                    Mines Count
                                    <input
                                        type="number"
                                        min="1"
                                        max="24"
                                        className="verifier-input"
                                        value={minesCount}
                                        onChange={(e) => setMinesCount(e.target.value)}
                                    />
                                </label>
                            )}
                        </div>

                        {errorMsg && <div className="verifier-error-msg">{errorMsg}</div>}

                        <button type="submit" className="verifier-submit-btn" disabled={isVerifying}>
                            {isVerifying ? 'Calculating Cryptographic Roll...' : '⚡ Verify Mathematical Outcome'}
                        </button>
                    </form>

                    {/* Verification Results Panel */}
                    {verificationResult && (
                        <div className="verifier-result-card">
                            <div className="verifier-result-header">
                                <span className="verifier-verified-tag">
                                    ✅ Cryptographically Verified
                                </span>
                                <span className="verifier-result-game">
                                    Game: {game.toUpperCase()}
                                </span>
                            </div>

                            {/* Mathematical Breakdown */}
                            <div className="verifier-math-details">
                                <div className="math-row">
                                    <span className="math-label">Server Seed SHA-256 Hash:</span>
                                    <code className="math-code">{verificationResult.serverSeedSha256}</code>
                                </div>
                                <div className="math-row">
                                    <span className="math-label">HMAC Message Input:</span>
                                    <code className="math-code">{verificationResult.hmacMessage}</code>
                                </div>
                                <div className="math-row">
                                    <span className="math-label">HMAC-SHA256 Outcome Hash:</span>
                                    <code className="math-code hash-highlight">{verificationResult.hmacHash}</code>
                                </div>
                            </div>

                            {/* Outcome Display */}
                            <div className="verifier-outcome-box">
                                <span className="outcome-title">Exact Calculated Outcome:</span>

                                {game === 'limbo' && (
                                    <div className="outcome-stat-highlight">
                                        <span className="outcome-main-number">
                                            {verificationResult.outcome?.roll?.toFixed(2)}x
                                        </span>
                                        <span className="outcome-desc">Limbo Crash Multiplier Roll</span>
                                    </div>
                                )}

                                {game === 'crash' && (
                                    <div className="outcome-stat-highlight">
                                        <span className="outcome-main-number">
                                            {verificationResult.outcome?.crashPoint?.toFixed(2)}x
                                        </span>
                                        <span className="outcome-desc">Flight Bust Multiplier</span>
                                    </div>
                                )}

                                {game === 'plinko' && (
                                    <div className="outcome-stat-highlight">
                                        <span className="outcome-main-number">
                                            {verificationResult.outcome?.multiplier}x
                                        </span>
                                        <span className="outcome-desc">
                                            Landed in Bin #{verificationResult.outcome?.binIndex} ({verificationResult.outcome?.rows} rows, {verificationResult.outcome?.risk} risk)
                                        </span>
                                    </div>
                                )}

                                {game === 'dragon-tiger' && (
                                    <div className="outcome-stat-highlight">
                                        <span className="outcome-main-number">
                                            {verificationResult.outcome?.winner?.toUpperCase()} WINS!
                                        </span>
                                        <span className="outcome-desc">
                                            Dragon: {verificationResult.outcome?.dragon?.value}{verificationResult.outcome?.dragon?.suit} vs Tiger: {verificationResult.outcome?.tiger?.value}{verificationResult.outcome?.tiger?.suit}
                                        </span>
                                    </div>
                                )}

                                {game === 'color-match' && (
                                    <div className="outcome-stat-highlight">
                                        <span className="outcome-main-number">
                                            {verificationResult.outcome?.luckyNumber} (
                                            {verificationResult.outcome?.winningColors?.join(' + ').toUpperCase()}
                                            )
                                        </span>
                                        <span className="outcome-desc">
                                            Category: {verificationResult.outcome?.bigSmall?.toUpperCase()}
                                        </span>
                                    </div>
                                )}

                                {game === 'mines' && (
                                    <div className="outcome-mines-grid-view">
                                        <p className="outcome-desc">
                                            Mine indices on 5×5 grid (0–24): {verificationResult.outcome?.mineIndices?.join(', ')}
                                        </p>
                                        <div className="mines-preview-grid">
                                            {Array.from({ length: 25 }, (_, idx) => {
                                                const isMine = verificationResult.outcome?.mineIndices?.includes(idx)
                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`mines-preview-tile ${isMine ? 'mine' : 'safe'}`}
                                                    >
                                                        {isMine ? '💣' : '💎'}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
