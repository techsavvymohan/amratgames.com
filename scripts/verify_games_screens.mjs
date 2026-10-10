import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ARTIFACTS_DIR = 'C:\\Users\\Zarvis\\.gemini\\antigravity-ide\\brain\\5f5d2a2f-305d-46a0-a496-9eeba8affacd'
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9333

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
    console.log('🚀 Launching headless Chrome on port', PORT)
    const chrome = spawn(CHROME_PATH, [
        '--headless=new',
        '--disable-gpu',
        `--remote-debugging-port=${PORT}`,
        '--user-data-dir=' + path.resolve('.chrome-temp-profile-' + Date.now()),
        'about:blank'
    ])

    await sleep(2500)

    try {
        const newTabRes = await fetch(`http://127.0.0.1:${PORT}/json/new?https://amratgames.com/color-match`, { method: 'PUT' })
        const target = await newTabRes.json()
        console.log('Target tab created:', target.id)

        const ws = new WebSocket(target.webSocketDebuggerUrl)
        let msgId = 1
        const callbacks = new Map()

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data)
            if (data.id && callbacks.has(data.id)) {
                callbacks.get(data.id)(data.result, data.error)
                callbacks.delete(data.id)
            }
        }

        const send = (method, params = {}) => {
            return new Promise((resolve, reject) => {
                const id = msgId++
                callbacks.set(id, (res, err) => {
                    if (err) reject(new Error(err.message))
                    else resolve(res)
                })
                ws.send(JSON.stringify({ id, method, params }))
            })
        }

        await new Promise(resolve => ws.onopen = resolve)
        console.log('Connected to Chrome DevTools Protocol')

        await send('Page.enable')
        await send('Network.enable')
        await send('Runtime.enable')

        const capture = async (name, width, height, isMobile = false) => {
            console.log(`📸 Capturing ${name} (${width}x${height})...`)
            await send('Emulation.setDeviceMetricsOverride', {
                width,
                height,
                deviceScaleFactor: 1,
                mobile: isMobile
            })
            await sleep(2500)
            const shot = await send('Page.captureScreenshot', { format: 'png' })
            const filePath = path.join(ARTIFACTS_DIR, name)
            fs.writeFileSync(filePath, Buffer.from(shot.data, 'base64'))
            console.log(`✓ Saved: ${filePath}`)
        }

        const games = [
            { key: 'color-match', name: 'color_match' },
            { key: 'plinko', name: 'plinko' },
            { key: 'crash', name: 'crash' },
            { key: 'mines', name: 'mines' },
            { key: 'limbo', name: 'limbo' },
            { key: 'dragon-tiger', name: 'dragon_tiger' },
            { key: 'coin-toss', name: 'coin_toss' },
            { key: 'dino', name: 'dino' }
        ]

        for (const g of games) {
            console.log(`\nNavigating to https://amratgames.com/${g.key}...`)
            await send('Page.navigate', { url: `https://amratgames.com/${g.key}` })
            await sleep(3500)
            await capture(`laptop_${g.name}_verified.png`, 1427, 788, false)
            await capture(`mobile_${g.name}_verified.png`, 390, 844, true)
        }

        console.log('🎉 ALL SCREENSHOTS CAPTURED SUCCESSFULLY!')
        ws.close()
    } finally {
        chrome.kill()
    }
}

main().catch(err => {
    console.error('Error:', err)
    process.exit(1)
})
