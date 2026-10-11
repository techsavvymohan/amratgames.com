import { TwoFactorSmsProvider } from './TwoFactorSmsProvider.js'
import { Fast2SmsProvider } from './Fast2SmsProvider.js'
import { MockSmsProvider } from './MockSmsProvider.js'

export { BaseSmsProvider } from './BaseSmsProvider.js'
export { TwoFactorSmsProvider } from './TwoFactorSmsProvider.js'
export { Fast2SmsProvider } from './Fast2SmsProvider.js'
export { MockSmsProvider } from './MockSmsProvider.js'

/**
 * Factory to create an SMS provider instance based on name
 * @param {string} provider '2factor' | 'fast2sms' | 'mock'
 * @param {object} options
 */
export function createSmsProvider(provider = 'mock', options = {}) {
    const norm = String(provider).toLowerCase().trim()

    switch (norm) {
        case '2factor':
        case 'twofactor':
            return new TwoFactorSmsProvider(options)
        case 'fast2sms':
            return new Fast2SmsProvider(options)
        case 'mock':
        default:
            return new MockSmsProvider(options)
    }
}
