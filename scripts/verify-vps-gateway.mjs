import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Client } = require('../backend/node_modules/ssh2');

const conn = new Client();

conn.on('ready', () => {
    console.log('✓ Connected to VPS (103.216.168.84). Probing Live YouPI Gateway...\n');

    const remoteScript = `
        cd /var/www/amratgames.com
        node -e "
            const jwt = require('./backend/node_modules/jsonwebtoken');
            const { db } = require('./backend/src/db/db.js');
            const { CONFIG } = require('./backend/src/config.js');

            async function test() {
                const user = db.findUserByEmail(CONFIG.ADMIN_EMAIL) || db.getAllUsers()[0];
                if (!user) {
                    throw new Error('No user found in database');
                }
                const token = jwt.sign(
                    { id: user.id, email: user.email, role: user.role || 'admin' },
                    CONFIG.JWT_SECRET
                );

                const sessionRes = await fetch('http://127.0.0.1:3001/api/gateway/session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ amount: 500, gateway: 'youpi' })
                });
                const session = await sessionRes.json();
                console.log('1. Deposit Session Created:');
                console.log(JSON.stringify(session, null, 2));

                const paymentId = session.session?.paymentId || session.paymentId;
                const stateRes = await fetch('http://127.0.0.1:6100/api/v1/checkout/' + paymentId + '/state');
                const state = await stateRes.json();
                console.log('\\n2. Gateway Checkout State & Receiving VPA:');
                console.log('   - Payee VPA:     ' + state.payeeVpa);
                console.log('   - Payee Name:    ' + state.payeeName);
                console.log('   - Merchant Name: ' + state.merchantName);
                console.log('   - Amount Paired: ₹' + state.amount);
                console.log('   - UPI Intent:    ' + state.upiUri);
                console.log('   - Checkout URL:  ' + session.session?.checkoutUrl);
            }
            test().catch(err => console.error('Test error:', err));
        "
    `;

    conn.exec(remoteScript, (err, stream) => {
        if (err) {
            console.error('Exec error:', err);
            conn.end();
            process.exit(1);
        }
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', (code) => {
            console.log(`\nProbe completed with exit code: ${code}`);
            conn.end();
            process.exit(code || 0);
        });
    });
});

conn.on('keyboard-interactive', (name, instr, lang, prompts, finish) => {
    finish(['Hj@KvB8*hDQv$j!Z']);
});

conn.connect({
    host: '103.216.168.84',
    port: 22,
    username: 'root',
    password: 'Hj@KvB8*hDQv$j!Z',
    tryKeyboard: true
});
