import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Client } = require('../backend/node_modules/ssh2');

const cmd = process.argv[2] || 'uptime';

const conn = new Client();
conn.on('ready', () => {
    conn.exec(cmd, (err, stream) => {
        if (err) { console.error(err); conn.end(); process.exit(1); }
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', () => { conn.end(); process.exit(0); });
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
