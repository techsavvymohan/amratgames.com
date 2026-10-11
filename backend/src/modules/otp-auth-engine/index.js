import { OtpAuthEngine } from './OtpAuthEngine.js'
import { createOtpRouter } from './routes/expressRouter.js'
import { MemoryOtpStore } from './storage/MemoryOtpStore.js'
import { RedisOtpStore } from './storage/RedisOtpStore.js'
import { TwoFactorSmsProvider } from './providers/TwoFactorSmsProvider.js'
import { Fast2SmsProvider } from './providers/Fast2SmsProvider.js'
import { MockSmsProvider } from './providers/MockSmsProvider.js'
import { normalizeIndianPhone } from './utils/phoneValidator.js'

export {
    OtpAuthEngine,
    createOtpRouter,
    MemoryOtpStore,
    RedisOtpStore,
    TwoFactorSmsProvider,
    Fast2SmsProvider,
    MockSmsProvider,
    normalizeIndianPhone
}

/**
 * Factory helper to instantiate the engine in one line
 * @param {object} options
 * @returns {OtpAuthEngine}
 */
export function createOtpAuthEngine(options = {}) {
    return new OtpAuthEngine(options)
}

export default createOtpAuthEngine
