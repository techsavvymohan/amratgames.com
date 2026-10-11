import { InHouseOtpProvider } from './InHouseOtpProvider.js'
import { MockSmsProvider } from './MockSmsProvider.js'
import { TwoFactorSmsProvider } from './TwoFactorSmsProvider.js'
import { Fast2SmsProvider } from './Fast2SmsProvider.js'

export { BaseSmsProvider } from './BaseSmsProvider.js'
export { InHouseOtpProvider } from './InHouseOtpProvider.js'
export { MockSmsProvider } from './MockSmsProvider.js'
export { TwoFactorSmsProvider } from './TwoFactorSmsProvider.js'
export { Fast2SmsProvider } from './Fast2SmsProvider.js'

/**
 * Factory to create an OTP provider instance.
 * Defaults to 'in-house' (100% self-contained, zero API key required).
 * @param {string} [provider='in-house']
 * @param {object} [options]
 */
export function createSmsProvider(provider = 'in-house', options = {}) {
    const norm = String(provider).toLowerCase().trim()

    switch (norm) {
        case '2factor':
        case 'twofactor':
            return new TwoFactorSmsProvider(options)
        case 'fast2sms':
            return new Fast2SmsProvider(options)
        case 'mock':
            return new MockSmsProvider(options)
        case 'in-house':
        case 'inhouse':
        case 'self':
        default:
            return new InHouseOtpProvider(options)
    }
}
