/**
 * Phone Validator & Normalizer
 * Standardizes Indian phone numbers (+91, 0, or raw 10 digits)
 */
export function normalizeIndianPhone(input) {
    if (!input) return { isValid: false, raw: '', formatted: '', error: 'Phone number is required' }

    // Strip everything except digits
    let cleaned = String(input).replace(/\D/g, '')

    // Remove leading country codes
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
        cleaned = cleaned.slice(2)
    } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
        cleaned = cleaned.slice(1)
    }

    // Must be exactly 10 digits
    if (cleaned.length !== 10) {
        return {
            isValid: false,
            raw: cleaned,
            formatted: '',
            error: 'Phone number must be exactly 10 digits'
        }
    }

    // Must start with 6, 7, 8, or 9 (Standard Indian mobile prefix)
    if (!/^[6-9]/.test(cleaned)) {
        return {
            isValid: false,
            raw: cleaned,
            formatted: '',
            error: 'Indian mobile numbers must start with 6, 7, 8, or 9'
        }
    }

    return {
        isValid: true,
        raw: cleaned,
        formatted: `+91${cleaned}`,
        error: null
    }
}
