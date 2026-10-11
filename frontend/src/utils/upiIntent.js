/**
 * Universal NPCI UPI Deep-Link Intent Engine for AmratGames.com
 * Supports universal upi://pay scheme alongside app-specific fallbacks (PhonePe, Paytm, GPay)
 */

/**
 * Normalizes and sanitizes a UPI ID (VPA)
 */
export function sanitizeUpiId(rawUpi) {
    if (!rawUpi || typeof rawUpi !== 'string') return ''
    return rawUpi.trim().toLowerCase().replace(/\s+/g, '')
}

/**
 * Validates if a string matches basic UPI format (identifier@bank)
 */
export function isValidUpiId(rawUpi) {
    const clean = sanitizeUpiId(rawUpi)
    return /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(clean)
}

/**
 * Formats monetary amounts for NPCI UPI intent (2 decimal places)
 */
export function formatUpiAmount(amount) {
    const num = parseFloat(amount)
    if (isNaN(num) || num <= 0) return '0.00'
    return num.toFixed(2)
}

/**
 * Builds standard NPCI Universal UPI Payment Intent URI
 * Format: upi://pay?pa={VPA}&pn={NAME}&am={AMOUNT}&cu=INR&tn={NOTE}
 */
export function buildUpiPayUri({
    upiId,
    amount,
    payeeName = 'Amrat Player',
    transactionNote = 'AmratGames Cashout',
    currency = 'INR'
}) {
    const cleanId = sanitizeUpiId(upiId)
    if (!cleanId) return ''

    const amtStr = formatUpiAmount(amount)
    const cleanName = encodeURIComponent((payeeName || 'Player').trim().slice(0, 50))
    const cleanNote = encodeURIComponent((transactionNote || 'Amrat Payout').trim().slice(0, 80))

    return `upi://pay?pa=${encodeURIComponent(cleanId)}&pn=${cleanName}&am=${amtStr}&cu=${currency}&tn=${cleanNote}`
}

/**
 * Builds app-specific intent URIs
 */
export function buildAppUpiUris(params) {
    const baseUri = buildUpiPayUri(params)
    if (!baseUri) return null

    const queryString = baseUri.replace('upi://pay?', '')

    return {
        universal: baseUri,
        phonepe: `phonepe://pay?${queryString}`,
        paytm: `paytmmp://pay?${queryString}`,
        gpay: `gpay://upi/pay?${queryString}`
    }
}

/**
 * Detects if the current environment is a mobile / tablet browser
 */
export function isMobileDevice() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
    const ua = navigator.userAgent || navigator.vendor || window.opera || ''
    const isMobileUa = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)
    const isTouchScreen = window.innerWidth <= 840 || (navigator.maxTouchPoints && navigator.maxTouchPoints > 1)
    return Boolean(isMobileUa || isTouchScreen)
}

/**
 * Launches UPI Intent on mobile devices
 */
export function launchUpiApp(uri) {
    if (typeof window === 'undefined' || !uri) return false
    try {
        const link = document.createElement('a')
        link.href = uri
        link.rel = 'noopener noreferrer'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        return true
    } catch {
        try {
            window.location.href = uri
            return true
        } catch {
            return false
        }
    }
}
