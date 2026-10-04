import nodemailer from 'nodemailer'
import { CONFIG } from '../config.js'

/**
 * EmailService — Handles outgoing transactional emails and OTP dispatch from support@amratgames.com
 */
class EmailService {
    constructor() {
        this.transporter = null
        this.initTransporter()
    }

    initTransporter() {
        if (CONFIG.SMTP_HOST && CONFIG.SMTP_PASS) {
            try {
                this.transporter = nodemailer.createTransport({
                    host: CONFIG.SMTP_HOST,
                    port: CONFIG.SMTP_PORT,
                    secure: CONFIG.SMTP_SECURE,
                    auth: {
                        user: CONFIG.SMTP_USER,
                        pass: CONFIG.SMTP_PASS
                    },
                    tls: {
                        rejectUnauthorized: false
                    }
                })
                console.log(`[EMAIL] SMTP transporter initialized for ${CONFIG.SUPPORT_EMAIL} via ${CONFIG.SMTP_HOST}:${CONFIG.SMTP_PORT}`)
            } catch (err) {
                console.error('[EMAIL] Failed to initialize SMTP transporter:', err.message)
                this.transporter = null
            }
        } else {
            this.transporter = null
        }
    }

    isSmtpConfigured() {
        return Boolean(this.transporter)
    }

    /**
     * Test SMTP connectivity and verify credentials with the mail server
     */
    async verifyConnection() {
        if (!this.transporter) {
            return {
                ok: false,
                configured: false,
                message: `SMTP not configured in .env (SMTP_HOST=${CONFIG.SMTP_HOST || 'not set'}, SMTP_PASS=${CONFIG.SMTP_PASS ? 'set' : 'not set'})`
            }
        }

        const start = Date.now()
        try {
            await this.transporter.verify()
            const latencyMs = Date.now() - start
            return {
                ok: true,
                configured: true,
                latencyMs,
                host: CONFIG.SMTP_HOST,
                port: CONFIG.SMTP_PORT,
                user: CONFIG.SMTP_USER,
                message: `Connected successfully to Spacemail SMTP (${CONFIG.SMTP_HOST}:${CONFIG.SMTP_PORT}) in ${latencyMs}ms!`
            }
        } catch (err) {
            return {
                ok: false,
                configured: true,
                error: err.message,
                message: `SMTP verification failed: ${err.message}`
            }
        }
    }

    /**
     * Send 6-Digit OTP verification email to player
     */
    async sendOtpEmail({ to, otp, username = 'Player' }) {
        const subject = `Your AmratGames Verification Code: ${otp}`
        const cleanTo = String(to).trim().toLowerCase()

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${subject}</title>
            <style>
                body { margin: 0; padding: 0; background-color: #0b0e14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc; }
                .container { max-width: 560px; margin: 40px auto; background: #121721; border-radius: 16px; border: 1px solid rgba(245, 175, 25, 0.25); overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
                .header { background: linear-gradient(135deg, #182030 0%, #0d121c 100%); padding: 32px 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06); }
                .logo-badge { display: inline-flex; align-items: center; gap: 8px; font-size: 24px; font-weight: 800; color: #f5af19; letter-spacing: 0.5px; }
                .tagline { color: #94a3b8; font-size: 13px; margin-top: 6px; }
                .body { padding: 36px 32px; }
                .greeting { font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
                .desc { font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px; }
                .otp-card { background: rgba(0,0,0,0.4); border: 2px dashed #f5af19; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; }
                .otp-title { font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: #f5af19; font-weight: 700; margin-bottom: 8px; }
                .otp-code { font-family: 'SF Mono', Consolas, Monaco, monospace; font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #ffd700; margin: 0; text-shadow: 0 0 20px rgba(245,175,25,0.4); }
                .otp-note { font-size: 12px; color: #64748b; margin-top: 10px; }
                .warning { background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 6px; font-size: 13px; color: #fca5a5; margin: 24px 0; }
                .footer { background: #0c0f16; padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.04); }
                .footer a { color: #f5af19; text-decoration: none; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo-badge">👑 AmratGames.com</div>
                    <div class="tagline">India's Premier Provably Fair Crypto & INR Gaming Platform</div>
                </div>
                <div class="body">
                    <div class="greeting">Hello ${username || 'Player'},</div>
                    <div class="desc">
                        Use the verification code below to complete your login or registration on AmratGames.com.
                    </div>
                    <div class="otp-card">
                        <div class="otp-title">Your 6-Digit One-Time Code</div>
                        <div class="otp-code">${otp}</div>
                        <div class="otp-note">Valid for 5 minutes • Do not share with anyone</div>
                    </div>
                    <div class="warning">
                        ⚠️ <strong>Security Notice:</strong> AmratGames staff will never ask for your verification code or password.
                    </div>
                    <div class="desc" style="margin-bottom: 0; font-size: 13px;">
                        Need assistance? Reach our 24/7 dedicated support team at <a href="mailto:${CONFIG.SUPPORT_EMAIL}" style="color: #f5af19;">${CONFIG.SUPPORT_EMAIL}</a>.
                    </div>
                </div>
                <div class="footer">
                    &copy; ${new Date().getFullYear()} AmratGames.com. All rights reserved.<br>
                    Official Support: <a href="mailto:${CONFIG.SUPPORT_EMAIL}">${CONFIG.SUPPORT_EMAIL}</a>
                </div>
            </div>
        </body>
        </html>
        `

        const text = `
👑 AmratGames.com Verification Code
====================================
Your 6-Digit Verification Code is: ${otp}

This code is valid for 5 minutes.
Never share this code with anyone.

Official Support: ${CONFIG.SUPPORT_EMAIL}
© ${new Date().getFullYear()} AmratGames.com
        `.trim()

        if (this.transporter) {
            try {
                const info = await this.transporter.sendMail({
                    from: CONFIG.SMTP_FROM,
                    to: cleanTo,
                    subject,
                    text,
                    html
                })
                console.log(`[EMAIL] OTP sent to ${cleanTo} via SMTP: ${info.messageId}`)
                return { success: true, messageId: info.messageId }
            } catch (err) {
                console.error(`[EMAIL] Failed to send email to ${cleanTo}:`, err.message)
                return { success: false, error: err.message }
            }
        } else {
            console.log(`\n======================================================`)
            console.log(`📧 [EMAIL OTP DISPATCH — ${CONFIG.SUPPORT_EMAIL}]`)
            console.log(`🎯 Recipient:  ${cleanTo}`)
            console.log(`🔑 OTP Code:   ${otp} (Valid for 5 mins)`)
            console.log(`📨 Sender:     ${CONFIG.SMTP_FROM}`)
            console.log(`💡 SMTP Note:  To deliver real emails, set SMTP_PASS in .env`)
            console.log(`======================================================\n`)
            return { success: true, simulated: true }
        }
    }

    /**
     * Send contact form inquiry to support@amratgames.com
     */
    async sendContactInquiry({ name, email, phone = '', subject, message }) {
        const ticketId = 'TKT_' + Date.now().toString(36).toUpperCase()
        const cleanFrom = String(email).trim().toLowerCase()
        const mailSubject = `[Support Request #${ticketId}] ${subject || 'New Player Inquiry'}`

        const html = `
        <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 24px; color: #1e293b;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0;">
                <h2 style="color: #0f172a; margin-top: 0;">New Support Inquiry (${ticketId})</h2>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;">
                <p><strong>From Name:</strong> ${name}</p>
                <p><strong>Reply-To Email:</strong> <a href="mailto:${cleanFrom}">${cleanFrom}</a></p>
                ${phone ? `<p><strong>Mobile / Phone:</strong> ${phone}</p>` : ''}
                <p><strong>Subject:</strong> ${subject || 'General Inquiry'}</p>
                <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 16px 0; font-size: 14px; line-height: 1.6;">
                    ${String(message).replace(/\n/g, '<br>')}
                </div>
                <p style="font-size: 12px; color: #64748b;">Received at ${new Date().toISOString()} via AmratGames.com Contact Gateway</p>
            </div>
        </div>
        `

        if (this.transporter) {
            try {
                await this.transporter.sendMail({
                    from: CONFIG.SMTP_FROM,
                    to: CONFIG.SUPPORT_EMAIL,
                    replyTo: cleanFrom,
                    subject: mailSubject,
                    html,
                    text: `From: ${name} (${cleanFrom})\nPhone: ${phone}\nSubject: ${subject}\n\n${message}`
                })
            } catch (err) {
                console.error('[EMAIL] Failed to send contact inquiry to support:', err.message)
            }
        } else {
            console.log(`\n📬 [NEW CONTACT MESSAGE TO ${CONFIG.SUPPORT_EMAIL}] Ticket: ${ticketId} From: ${name} (${cleanFrom}) Message: ${message}\n`)
        }

        return { ticketId, success: true }
    }
}

export const emailService = new EmailService()
