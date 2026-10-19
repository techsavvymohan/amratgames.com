/**
 * Cloudinary High-Performance Media Optimization Engine
 * Account: r1fegrxo
 * 
 * Provides automated next-gen format negotiation (AVIF/WebP), intelligent compression (q_auto),
 * responsive scaling (w_auto or fixed bounds), and global edge CDN caching.
 */

import { CLOUDINARY_MANIFEST, getCloudinaryAsset } from './cloudinaryAssets'

export { CLOUDINARY_MANIFEST, getCloudinaryAsset }

export const CLOUDINARY_CLOUD_NAME = 'r1fegrxo'
export const PRODUCTION_DOMAIN = 'https://amratgames.com'

/**
 * Transforms an image path into a high-performance Cloudinary CDN delivery URL.
 * Prioritizes directly uploaded assets from CLOUDINARY_MANIFEST, with dynamic CDN fallback.
 * 
 * @param {string} src - Relative local path (e.g. '/images/crash.jpg') or absolute URL
 * @param {Object} [options]
 * @param {number} [options.width] - Max target width in pixels
 * @param {number} [options.height] - Max target height in pixels
 * @param {string} [options.crop='limit'] - Cropping / scaling mode ('limit', 'fill', 'scale', 'thumb')
 * @param {string} [options.quality='auto'] - Compression quality ('auto', 'auto:best', 'auto:eco')
 * @param {string} [options.format='auto'] - Target format ('auto', 'webp', 'avif', 'png')
 * @returns {string} - Optimized CDN URL or fallback original src
 */
export function getOptimizedImageUrl(src, options = {}) {
    if (!src || typeof src !== 'string') return ''

    // Skip optimization for data URIs or blobs
    if (src.startsWith('data:') || src.startsWith('blob:')) {
        return src
    }

    // Check if Cloudinary is explicitly disabled in developer mode
    if (typeof window !== 'undefined' && window.__DISABLE_CLOUDINARY__) {
        return src
    }

    // 1. Direct match in pre-compiled Cloudinary manifest
    const cleanPath = src.split('?')[0].trim()
    const directEntry = CLOUDINARY_MANIFEST[cleanPath] || CLOUDINARY_MANIFEST['/' + cleanPath.replace(/^\/+/, '')]
    if (directEntry && directEntry.secureUrl) {
        // If SVG and no dimension changes requested, return original SVG secureUrl
        if (cleanPath.endsWith('.svg') && !options.width && !options.height) {
            return directEntry.secureUrl
        }
        return getCloudinaryAsset(cleanPath, options)
    }

    // 2. If already a Cloudinary URL, return as-is
    if (src.includes('res.cloudinary.com')) {
        return src
    }

    // 3. Fallback: Dynamic Cloudinary Fetch Delivery
    const {
        width,
        height,
        crop = 'limit',
        quality = 'auto',
        format = 'auto'
    } = options

    const transforms = [`f_${format}`, `q_${quality}`]
    if (width) transforms.push(`w_${width}`)
    if (height) transforms.push(`h_${height}`)
    if (width || height) transforms.push(`c_${crop}`)
    const transformStr = transforms.join(',')

    let targetUrl = src
    if (!src.startsWith('http://') && !src.startsWith('https://')) {
        const cleanLeadingSlash = src.startsWith('/') ? src : `/${src}`
        targetUrl = `${PRODUCTION_DOMAIN}${cleanLeadingSlash}`
    }

    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/fetch/${transformStr}/${encodeURI(targetUrl)}`
}

/**
 * Convenience helper for game cards and thumbnails (e.g., 400px width limit).
 */
export function getGameCoverUrl(src, width = 450) {
    return getOptimizedImageUrl(src, { width, quality: 'auto', format: 'auto', crop: 'limit' })
}

/**
 * Convenience helper for hero banners and wide backdrops (e.g., 1400px width limit).
 */
export function getHeroBannerUrl(src, width = 1400) {
    return getOptimizedImageUrl(src, { width, quality: 'auto:best', format: 'auto', crop: 'limit' })
}
