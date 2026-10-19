import { v2 as cloudinary } from 'cloudinary'

/**
 * Cloudinary Media Service
 * Manages automated image optimization, transformations, and asset delivery for AmratGames.
 */
class CloudinaryService {
    constructor() {
        this.cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'r1fegrxo'
        this.apiKey = process.env.CLOUDINARY_API_KEY || ''
        this.apiSecret = process.env.CLOUDINARY_API_SECRET || ''

        this.isInitialized = false
        this.init()
    }

    /**
     * Initializes Cloudinary configuration
     */
    init() {
        if (process.env.CLOUDINARY_URL) {
            cloudinary.config({
                url: process.env.CLOUDINARY_URL,
                secure: true
            })
            this.isInitialized = true
        } else {
            cloudinary.config({
                cloud_name: this.cloudName,
                api_key: this.apiKey,
                api_secret: this.apiSecret,
                secure: true
            })
            this.isInitialized = Boolean(this.apiKey && this.apiSecret)
        }
    }

    /**
     * Checks if authenticated programmatic uploads are configured with API keys.
     */
    isUploadEnabled() {
        return Boolean(this.apiKey && this.apiSecret) || Boolean(process.env.CLOUDINARY_URL)
    }

    /**
     * Uploads an image or file buffer to Cloudinary.
     * 
     * @param {string|Buffer} file - Local path, data URI, or Buffer
     * @param {Object} [options]
     * @returns {Promise<Object>}
     */
    async uploadImage(file, options = {}) {
        if (!this.isUploadEnabled()) {
            throw new Error('Cloudinary upload requires CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in environment.')
        }

        const uploadOptions = {
            folder: `amratgames/${options.folder || 'uploads'}`,
            resource_type: options.resourceType || 'auto',
            overwrite: options.overwrite ?? true,
            transformation: options.transformation || [
                { quality: 'auto', fetch_format: 'auto' }
            ],
            ...options
        }

        if (Buffer.isBuffer(file)) {
            return new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
                    if (error) return reject(error)
                    resolve({
                        success: true,
                        publicId: result.public_id,
                        secureUrl: result.secure_url,
                        format: result.format,
                        bytes: result.bytes,
                        width: result.width,
                        height: result.height
                    })
                })
                uploadStream.end(file)
            })
        }

        const result = await cloudinary.uploader.upload(file, uploadOptions)
        return {
            success: true,
            publicId: result.public_id,
            secureUrl: result.secure_url,
            format: result.format,
            bytes: result.bytes,
            width: result.width,
            height: result.height
        }
    }

    /**
     * Generates a transformed CDN delivery URL for a given public ID or remote URL.
     * 
     * @param {string} publicId - Cloudinary public ID or remote image URL
     * @param {Object} [options]
     * @returns {string}
     */
    getUrl(publicId, options = {}) {
        const {
            width,
            height,
            crop = 'limit',
            quality = 'auto',
            format = 'auto'
        } = options

        return cloudinary.url(publicId, {
            secure: true,
            fetch_format: format,
            quality,
            width,
            height,
            crop
        })
    }
}

export const cloudinaryService = new CloudinaryService()
