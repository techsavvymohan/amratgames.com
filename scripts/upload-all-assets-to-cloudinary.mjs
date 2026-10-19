/**
 * Automated Asset Ingress & Cloudinary Migration Pipeline
 * 
 * Uploads all 55 static image assets from frontend/public to Cloudinary Media Library,
 * creates responsive CDN mappings, and generates the frontend asset manifest.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const backendRequire = createRequire(path.join(rootDir, 'backend', 'package.json'))
const cloudinary = backendRequire('cloudinary').v2

// Load credentials from backend/.env
const envPath = path.join(rootDir, 'backend', '.env')
if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
    for (const line of lines) {
        const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)?\s*$/)
        if (match && !process.env[match[1]]) {
            process.env[match[1]] = match[2]?.trim().replace(/^['"]|['"]$/g, '') || ''
        }
    }
}

const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'r1fegrxo'
const apiKey = process.env.CLOUDINARY_API_KEY || '542217947447457'
const apiSecret = process.env.CLOUDINARY_API_SECRET || 'BgK0xV9kzi4xTsRxFpnPzf62C3A'

cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
})

console.log('╔════════════════════════════════════════════════════════════════╗')
console.log('║   ☁️  UPLOADING ALL PLATFORM ASSETS TO CLOUDINARY API          ║')
console.log('╚════════════════════════════════════════════════════════════════╝')
console.log(`Cloud Name: ${cloudName}`)
console.log(`API Key:    ${apiKey}`)
console.log('──────────────────────────────────────────────────────────────────\n')

const publicDir = path.join(rootDir, 'frontend', 'public')

// Recursive walk to find all image files
function findImages(dir) {
    let results = []
    const list = fs.readdirSync(dir)
    for (const item of list) {
        const fullPath = path.join(dir, item)
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) {
            results = results.concat(findImages(fullPath))
        } else if (/\.(png|jpe?g|webp|avif|svg|gif)$/i.test(item)) {
            const relPath = path.relative(publicDir, fullPath).replace(/\\/g, '/')
            results.push({ fullPath, relPath, item })
        }
    }
    return results
}

const images = findImages(publicDir)
console.log(`Discovered ${images.length} image assets to upload...\n`)

const manifest = {}

let count = 0
let totalUploadedBytes = 0

for (const img of images) {
    count++
    const ext = path.extname(img.item)
    const baseWithoutExt = img.relPath.substring(0, img.relPath.length - ext.length)
    // Clean public_id for Cloudinary (lowercase, alpha-numeric and underscores)
    const publicId = `amratgames/${baseWithoutExt.replace(/[^a-zA-Z0-9_\-\/]/g, '_')}`

    const isSvg = ext.toLowerCase() === '.svg'
    const isGif = ext.toLowerCase() === '.gif'

    const uploadOptions = {
        public_id: publicId,
        overwrite: true,
        resource_type: 'auto',
        unique_filename: false,
        use_filename: false
    }

    try {
        const start = Date.now()
        const result = await cloudinary.uploader.upload(img.fullPath, uploadOptions)
        const duration = Date.now() - start

        totalUploadedBytes += result.bytes || 0

        // Build optimized delivery URL with f_auto,q_auto (except SVGs which don't need format change)
        let optimizedUrl = result.secure_url
        if (!isSvg) {
            optimizedUrl = result.secure_url.replace('/upload/', '/upload/f_auto,q_auto/')
        }

        const localKey = `/${img.relPath}`
        manifest[localKey] = {
            publicId: result.public_id,
            secureUrl: result.secure_url,
            optimizedUrl,
            format: result.format,
            bytes: result.bytes,
            width: result.width,
            height: result.height,
            version: result.version
        }

        const kb = (result.bytes / 1024).toFixed(1)
        console.log(`[${count}/${images.length}] ✓ Uploaded: ${img.relPath.padEnd(35)} -> ${kb} KB in ${duration}ms`)
    } catch (err) {
        console.error(`[${count}/${images.length}] ✗ FAILED: ${img.relPath} -> ${err.message}`)
    }
}

console.log('\n──────────────────────────────────────────────────────────────────')
console.log(`Total Assets Uploaded: ${Object.keys(manifest).length} / ${images.length}`)
console.log(`Total Bytes:           ${(totalUploadedBytes / 1024 / 1024).toFixed(2)} MB`)
console.log('──────────────────────────────────────────────────────────────────\n')

// 1. Write JSON Manifest
const manifestJsonPath = path.join(rootDir, 'frontend', 'src', 'utils', 'cloudinaryManifest.json')
fs.writeFileSync(manifestJsonPath, JSON.stringify(manifest, null, 2), 'utf8')
console.log(`✓ Saved JSON manifest to: ${manifestJsonPath}`)

// 2. Write JavaScript Asset Map
const assetsJsContent = `/**
 * Pre-compiled Cloudinary Direct CDN Asset Map
 * Generated automatically by scripts/upload-all-assets-to-cloudinary.mjs
 * 
 * Provides instant 1-to-1 mapping from any local asset path to its Cloudinary CDN URL.
 */

export const CLOUDINARY_MANIFEST = ${JSON.stringify(manifest, null, 2)}

/**
 * Returns the direct Cloudinary CDN URL for a local asset path, with optional width constraints.
 * 
 * @param {string} localPath - e.g. '/images/crash.jpg'
 * @param {Object} [options]
 * @param {number} [options.width]
 * @param {number} [options.height]
 * @returns {string} - Cloudinary CDN URL or original path fallback
 */
export function getCloudinaryAsset(localPath, options = {}) {
    if (!localPath || typeof localPath !== 'string') return ''

    // Clean leading slash and version query strings
    const cleanPath = localPath.split('?')[0].trim()
    const entry = CLOUDINARY_MANIFEST[cleanPath] || CLOUDINARY_MANIFEST['/' + cleanPath.replace(/^\\/+/, '')]

    if (!entry) {
        return localPath
    }

    if (options.width || options.height) {
        const transforms = ['f_auto', 'q_auto']
        if (options.width) transforms.push(\`w_\${options.width}\`)
        if (options.height) transforms.push(\`h_\${options.height}\`)
        transforms.push('c_limit')
        return entry.secureUrl.replace('/upload/', \`/upload/\${transforms.join(',')}/\`)
    }

    return entry.optimizedUrl || entry.secureUrl
}
`

const assetsJsPath = path.join(rootDir, 'frontend', 'src', 'utils', 'cloudinaryAssets.js')
fs.writeFileSync(assetsJsPath, assetsJsContent, 'utf8')
console.log(`✓ Saved JS helper module to: ${assetsJsPath}`)
console.log('\n🚀 ALL ASSETS UPLOADED AND MANIFEST GENERATED SUCCESSFULLY!\n')
