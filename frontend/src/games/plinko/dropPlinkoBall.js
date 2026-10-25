import { MAX_ACTIVE_BALLS } from './constants';
import casinoAudio from '../../utils/casinoAudio';

export async function dropPlinkoBall({
    engine,
    pendingDrops,
    provablyFair,
    rowCount,
    riskLevel = 'medium',
    betAmount,
    currentBall,
    selectedBallType,
    placeBet,
    executeGameBet,
    isCancelled = () => false,
}) {
    if (!engine || engine.getActiveBallCount() + pendingDrops.current >= MAX_ACTIVE_BALLS) return 'busy';

    pendingDrops.current++;
    try {
        let binIndex = Math.floor(rowCount / 2);
        let betRes = null;

        if (executeGameBet) {
            if (engine.getActiveBallCount() >= MAX_ACTIVE_BALLS) return 'busy';
            betRes = await executeGameBet({
                game: 'plinko',
                gameName: 'Plinko',
                betAmount,
                rows: rowCount,
                risk: riskLevel
            });
            if (!betRes || !betRes.success) {
                return { success: false, error: betRes?.error || 'Failed to place bet', code: betRes?.code };
            }
            binIndex = betRes.binIndex ?? betRes.evaluation?.binIndex ?? binIndex;
        } else if (provablyFair) {
            const fairnessResult = await provablyFair.generatePlinkoPath(rowCount);
            if (isCancelled()) return 'cancelled';
            if (engine.getActiveBallCount() >= MAX_ACTIVE_BALLS) return 'busy';
            if (!placeBet(betAmount)) return 'insufficient-funds';
            binIndex = fairnessResult.path.reduce((sum, direction) => sum + direction, 0);
        }

        if (isCancelled()) return 'cancelled';
        if (engine.getActiveBallCount() >= MAX_ACTIVE_BALLS) return 'busy';

        casinoAudio.playBet();
        engine.updateBallStyle(currentBall.color, currentBall.image);
        return engine.dropBall(binIndex, selectedBallType, false, betRes) ? 'dropped' : 'busy';
    } finally {
        pendingDrops.current--;
    }
}
