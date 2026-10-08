import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const { Client } = require('./backend/node_modules/ssh2')

const VPS_HOST = '103.216.168.84'
const VPS_PORT = 22
const VPS_USER = 'root'
const VPS_PASS = 'Hj@KvB8*hDQv$j!Z'
const BUNDLE_PATH = path.resolve('phase7.bundle')
const REMOTE_DIR = '/var/www/amratgames.com'
const REMOTE_BUNDLE = `${REMOTE_DIR}/phase7.bundle`

console.log('👑 Connecting to VPS at', VPS_HOST, '...')
const conn = new Client()

conn.on('ready', () => {
    console.log('✓ SSH connection established! Opening SFTP session...')
    
    conn.sftp((err, sftp) => {
        if (err) {
            console.error('SFTP Error:', err.message)
            conn.end()
            process.exit(1)
        }

        console.log(`Uploading ${BUNDLE_PATH} -> ${REMOTE_BUNDLE}...`)
        const readStream = fs.createReadStream(BUNDLE_PATH)
        const writeStream = sftp.createWriteStream(REMOTE_BUNDLE)

        writeStream.on('close', () => {
            console.log('✓ phase7.bundle uploaded successfully to VPS!')

            const cmd = `cd ${REMOTE_DIR} && git pull phase7.bundle main && rm -f phase7.bundle && bash scripts/deploy-vps.sh`
            console.log('\nExecuting remote deployment pipeline:')
            console.log(cmd)
            console.log('--------------------------------------------------\n')

            conn.exec(cmd, (execErr, stream) => {
                if (execErr) {
                    console.error('Exec error:', execErr.message)
                    conn.end()
                    process.exit(1)
                }

                stream.on('close', (code, signal) => {
                    console.log(`\n--------------------------------------------------`)
                    console.log(`Remote deployment process exited with code ${code}`)
                    conn.end()
                    process.exit(code === 0 ? 0 : 1)
                })

                stream.on('data', (data) => {
                    process.stdout.write(data)
                })

                stream.stderr.on('data', (data) => {
                    process.stderr.write(data)
                })
            })
        })

        writeStream.on('error', (wErr) => {
            console.error('Write error:', wErr.message)
            conn.end()
            process.exit(1)
        })

        readStream.pipe(writeStream)
    })
})

conn.on('keyboard-interactive', (name, instr, lang, prompts, finish) => {
    finish([VPS_PASS])
})

conn.on('error', (err) => {
    console.error('Connection error:', err.message)
    process.exit(1)
})

conn.connect({
    host: VPS_HOST,
    port: VPS_PORT,
    username: VPS_USER,
    password: VPS_PASS,
    tryKeyboard: true
})
