import { useState } from 'react';
import { useWallet } from '../../context/WalletContext';
import './Balance.css';

function Balance({ balance, onAddMoney }) {
    const { currencySymbol, depositPresets } = useWallet();
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);

    const balanceFormatted = (balance ?? 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    const addMoneyAmounts = depositPresets || [500, 1000, 2500];

    return (
        <div className="balance-container">
            <div className="balance-display">
                <span className="balance-symbol">{currencySymbol}</span>
                <span className="balance-value">{balanceFormatted}</span>
            </div>
            <div className="balance-popover-wrapper">
                <button
                    className="add-btn"
                    onClick={() => setIsPopoverOpen(!isPopoverOpen)}
                >
                    Add
                </button>
                {isPopoverOpen && (
                    <div className="add-money-popover">
                        <p className="add-money-title">Add funds</p>
                        <div className="add-money-buttons">
                            {addMoneyAmounts.map((amount) => (
                                <button
                                    key={amount}
                                    className="add-money-btn"
                                    onClick={() => {
                                        onAddMoney?.(amount);
                                        setIsPopoverOpen(false);
                                    }}
                                >
                                    +{currencySymbol}{amount}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Balance;
