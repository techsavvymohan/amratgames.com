import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ARTIFACTS_DIR = 'C:\\Users\\Zarvis\\.gemini\\antigravity-ide\\brain\\5f5d2a2f-305d-46a0-a496-9eeba8affacd'
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9336

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
    console.log('🚀 Launching headless Chrome on port', PORT)
    const chrome = spawn(CHROME_PATH, [
        '--headless=new',
        '--disable-gpu',
        `--remote-debugging-port=${PORT}`,
        '--user-data-dir=' + path.resolve('.chrome-temp-profile-dino'),
        'about:blank'
    ])

    await sleep(2500)

    try {
        const newTabRes = await fetch(`http://127.0.0.1:${PORT}/json/new?https://amratgames.com/dino`, { method: 'PUT' })
        const target = await newTabRes.json()
        const ws = new WebSocket(target.webSocketDebuggerUrl)
        let msgId = 1
        const callbacks = new Map()

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data)
            if (data.method === 'Runtime.consoleAPICalled') {
                console.log('CONSOLE:', data.params.type, data.params.args?.map(a => a.value || a.description).join(' '))
            } else if (data.method === 'Runtime.exceptionThrown') {
                console.log('EXCEPTION:', data.params.exceptionDetails?.text, data.params.exceptionDetails?.exception?.description)
            } else if (data.id && callbacks.has(data.id)) {
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
        await send('Page.enable')
        await send('Runtime.enable')

        console.log('Navigating to https://amratgames.com/dino...')
        await send('Page.navigate', { url: 'https://amratgames.com/dino' })
        await sleep(3500)

        const phaserEval = await send('Runtime.evaluate', { expression: 'Boolean(window.Phaser)' })
        console.log('window.Phaser:', phaserEval?.result?.value)

        const htmlEval = await send('Runtime.evaluate', { expression: 'document.body.innerHTML.slice(0, 500)' })
        console.log('HTML preview:', htmlEval?.result?.value)

        const scriptEval = await send('Runtime.evaluate', { expression: '[...document.querySelectorAll("script")].map(s => s.src)' })
        console.log('Scripts:', scriptEval?.result?.value)

        // Wait an extra 2 seconds for canvas to initialize
        await sleep(2500)

        // Capture Laptop
        await send('Emulation.setDeviceMetricsOverride', { width: 1427, height: 788, deviceScaleFactor: 1, mobile: false })
        await sleep(1500)
        const shotLaptop = await send('Page.captureScreenshot', { format: 'png' })
        fs.writeFileSync(path.join(ARTIFACTS_DIR, 'laptop_dino_verified.png'), Buffer.from(shotLaptop.data, 'base64'))
        console.log('✓ Saved laptop_dino_verified.png')

        // Capture Mobile
        await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
        await sleep(1500)
        const shotMobile = await send('Page.captureScreenshot', { format: 'png' })
        fs.writeFileSync(path.join(ARTIFACTS_DIR, 'mobile_dino_verified.png'), Buffer.from(shotMobile.data, 'base64'))
        console.log('✓ Saved mobile_dino_verified.png')

        ws.close()
    } finally {
        chrome.kill()
    }
}

main().catch(console.error)
