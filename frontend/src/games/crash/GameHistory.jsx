import { useState } from 'react'
import { Modal, Typography } from 'antd'
import { MoreOutlined, CloseOutlined, HistoryOutlined } from '@ant-design/icons'

const { Text } = Typography

function GameHistory({ history = [] }) {
    const [historyModalOpen, setHistoryModalOpen] = useState(false)

    // Multiplier color coding matching Spribe Aviator + AmratGames color harmony:
    // < 2x: Amrat cyan/blue (#3b82f6 / #38bdf8)
    // 2x - 10x: Royal violet/purple (#a855f7 / #c084fc)
    // >= 10x: Amrat gold/magenta (#f5af19 / #ec4899)
    const getBadgeCategory = (m) => {
        const num = parseFloat(m) || 1.0
        if (num < 2.0) return 'tier-blue'
        if (num < 10.0) return 'tier-purple'
        return 'tier-gold'
    }

    return (
        <div className="aviator-history-bar">
            {/* Horizontal Scrolling Ribbon */}
            <div className="aviator-history-pills-wrap">
                {history.slice(0, 25).map((mult, idx) => {
                    const num = typeof mult === 'number' ? mult : (parseFloat(mult?.crashPoint || mult) || 1.0)
                    const tier = getBadgeCategory(num)
                    return (
                        <button
                            key={idx}
                            type="button"
                            className={`aviator-history-pill ${tier}`}
                            onClick={() => setHistoryModalOpen(true)}
                        >
                            {num.toFixed(2)}x
                        </button>
                    )
                })}
            </div>

            {/* Right side '...' Button */}
            <button
                type="button"
                className="aviator-history-more-btn"
                onClick={() => setHistoryModalOpen(true)}
                title="Multiplier History"
            >
                <MoreOutlined />
            </button>

            {/* Detailed History Modal */}
            <Modal
                title={
                    <div className="aviator-modal-title">
                        <HistoryOutlined style={{ color: '#f5af19', marginRight: 8 }} />
                        Round Multiplier History
                    </div>
                }
                open={historyModalOpen}
                onCancel={() => setHistoryModalOpen(false)}
                footer={null}
                centered
                width={360}
                className="aviator-history-modal"
                closeIcon={<CloseOutlined style={{ color: '#94a3b8' }} />}
            >
                <div className="aviator-history-grid">
                    {history.map((mult, idx) => {
                        const num = typeof mult === 'number' ? mult : (parseFloat(mult?.crashPoint || mult) || 1.0)
                        const tier = getBadgeCategory(num)
                        return (
                            <div key={idx} className={`aviator-history-grid-item ${tier}`}>
                                <span className="grid-round-num">#{idx + 1}</span>
                                <span className="grid-multiplier-val">{num.toFixed(2)}x</span>
                            </div>
                        )
                    })}
                </div>
            </Modal>
        </div>
    )
}

export default GameHistory
