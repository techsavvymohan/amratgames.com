import crypto from 'node:crypto'

/**
 * Generate a cryptographically secure numeric OTP
 * @param {number} length Default 6 digits
 * @returns {string} 6-digit numeric string
 */
export function generateSecureOtp(length = 6) {
    const min = Math.pow(10, length - 1)
    const max = Math.pow(10, length)
    // crypto.randomInt is cryptographically strong (unlike Math.random)
    const num = crypto.randomInt(min, max)
    return num.toString()
}
