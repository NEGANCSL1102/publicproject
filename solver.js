const { connect } = require("puppeteer-real-browser");
require('colors');

const DETECTION_RULES = {
    CDNFLYNEW_rotate: { title: [], html: ["_guard/rotate.js", "js=rotate_html"], solver: "CDNFLY新版_旋转图片" },
    CDNFLYNEW_click: { title: [], html: ["_guard/click.js", "js=click_html"], solver: "CDNFLY新版_困难点击" },
    CDNFLYNEW_ezclick: { title: [], html: ["_guard/easy_click.js", "js=easy_click_html"], solver: "CDNFLY新版_简单点击" },
    CDNFLYNEW_slide: { title: [], html: ["_guard/slide.js", "js=slider_html", "puzzle-piece"], solver: "CDNFLY新版_困难滑块" },
    CDNFLYNEW_ezslide: { title: [], html: ["_guard/easy_slide.js", "js=easy_slider_html", "puzzle-image"], solver: "CDNFLY新版_简单滑块" },

    custom_cdnfly_slide: { 
        title: [], 
        html: ["_guard/slide.js", "_guard/encrypt.js", "alert-success"], 
        solver: "CDNFLY_按钮滑动",   
        handler: handle_Custom_slide,
        recheck: true,
        maxRecheck: 3 },

    Cloudflare: {
        title: ["Just a moment..."],
        html: ["#challenge-error-text"],
        solver: "CloudFlare",
        handler: handle_Cloudflare,
        recheck: true,
        maxRecheck: 3
    },
};

async function handle_Cloudflare(page, browser, log) {
    log('[BYPASS|CloudFlare]'.magenta);
    const MAX_WAIT = 60000;
    const start = Date.now();
    while (true) {
        const title = await page.title();
        if (!title.includes('Just a moment...') && !title.startsWith('Failed to load URL')) return;
        if (title.startsWith('Failed to load URL')) return;
        if (Date.now() - start > MAX_WAIT) {
            log('[Cloudflare] Max wait 60s timeout, still challenge!'.yellow);
            return;
        }
        await sleep(6000);
    }
}

async function handle_Custom_slide(page, browser, log) {
    log('[Handler] 开始自动拖动滑块'.cyan);

    const sliderSelector = '#btn';
    const trackSelector = '#slider';

    // 等待滑块和轨道出现
    await page.waitForSelector(sliderSelector, { timeout: 10000 });
    await page.waitForSelector(trackSelector, { timeout: 10000 });

    // 获取滑块和轨道的位置信息
    const sliderInfo = await page.$eval(sliderSelector, el => {
        const rect = el.getBoundingClientRect();
        return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
        };
    });
    const trackInfo = await page.$eval(trackSelector, el => {
        const rect = el.getBoundingClientRect();
        return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
        };
    });

    // 计算起点和终点
    const startX = sliderInfo.x + sliderInfo.width / 2;
    const startY = sliderInfo.y + sliderInfo.height / 2;
    const endX = trackInfo.x + trackInfo.width - sliderInfo.width / 2 - 2; // -2 留点边距防止超界
    const dragDistance = endX - startX;

    // 鼠标按下
    await page.mouse.move(startX, startY);
    await page.mouse.down();

    // 分步拖动（拟人操作）
    const steps = 30 + Math.floor(Math.random() * 8);
    for (let i = 0; i <= steps; i++) {
        const x = startX + (dragDistance * i / steps);
        await page.mouse.move(x, startY, { steps: 1 });
        await page.waitForTimeout(8 + Math.random() * 10);
    }

    // 松开鼠标
    await page.mouse.up();

    log('[Handler] 滑块拖动完成，等待验证...'.green);

    // 可选：等待页面验证响应
    await sleep(1500)
}


async function waitForRealPage(page, log, maxWait = 30000) {
    const start = Date.now();
    while (true) {
        const title = await page.title();
        let isProtected = false;
        for (const rule of Object.values(DETECTION_RULES)) {
            if (rule.title && rule.title.length > 0) {
                for (const keyword of rule.title) {
                    if (keyword && title.toLowerCase().includes(keyword.toLowerCase())) {
                        isProtected = true;
                        break;
                    }
                }
            }
            if (isProtected) break;
        }
        if (isProtected) {
            if (Date.now() - start > maxWait) {
            //    log('[PROTECTION] 超时退出'.red);
                break;
            }
            await sleep(1000);
            continue;
        }
        break;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function parseProxy(proxy) {
    if (!proxy) return undefined;
    if (typeof proxy === 'object' && proxy.host && proxy.port) return proxy;
    if (typeof proxy === 'string') {
        const [host, port] = proxy.split(':');
        if (!host || !port) return undefined;
        return { host, port: Number(port) };
    }
    return undefined;
}


async function solving({ url, proxy, log = console.log, optimize = false }) {
    const parsedProxy = parseProxy(proxy);
    let browser, page;
    try {
        const args = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-infobars',
            '--disable-blink-features=AutomationControlled',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows',
            '--disable-extensions',
            '--disable-default-apps',
            '--ignore-certificate-errors',
            '--ignore-certificate-errors-spki-list',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-background-mode',
            '--force-color-profile=srgb',
            '--enable-features=NetworkService,NetworkServiceInProcess',
            '--lang=en-US,en',
        ];
        const obj = await connect({
            headless: false,
            turnstile: true,
            args,
            ...(parsedProxy ? { proxy: parsedProxy } : {})
        });
        browser = obj.browser;
        page = obj.page;

        if (optimize) {
            await page.setRequestInterception(true);
            page.on('request', req => {
                if (['image', 'stylesheet', 'font'].includes(req.resourceType())) req.abort();
                else req.continue();
            });
        }

        await page.setJavaScriptEnabled(true);
        await page.setDefaultNavigationTimeout(0);

        await page.goto(url, { waitUntil: "domcontentloaded" });
        await waitForRealPage(page, log);

        // parsePage
        const getUA = () => page.evaluate(() => navigator.userAgent);

      async function detect() {
    const checked_title = await page.title();
    const html = await page.content();
    const lowerTitle = checked_title.toLowerCase();
    const lowerHtml = html.toLowerCase();

    for (const [type, rule] of Object.entries(DETECTION_RULES)) {
        let titleHit = true, htmlHit = true, matchedMode = '', matchedKey = '';

        if (rule.title && rule.title.length > 0) {
            // title 所有关键字必须都包含
            titleHit = rule.title.every(keyword => keyword && lowerTitle.includes(keyword.toLowerCase()));
            if (titleHit && rule.title.length > 0) {
                matchedMode += 'title';
                matchedKey += rule.title.join(' & ');
            }
        }
        if (rule.html && rule.html.length > 0) {
            // html 所有关键字必须都包含
            htmlHit = rule.html.every(keyword => keyword && lowerHtml.includes(keyword.toLowerCase()));
            if (htmlHit && rule.html.length > 0) {
                if (matchedMode) matchedMode += ' + ';
                matchedMode += 'html';
                if (matchedKey) matchedKey += ' & ';
                matchedKey += rule.html.join(' & ');
            }
        }
        // 只有两类都要且都命中时，或者仅有 title/html 配置且命中时才算命中
        if (
            (rule.title.length > 0 && rule.html.length > 0 && titleHit && htmlHit) ||
            (rule.title.length > 0 && rule.html.length === 0 && titleHit) ||
            (rule.html.length > 0 && rule.title.length === 0 && htmlHit)
        ) {
            return { matchedType: type, matchedKey, matchedRule: rule, matchedMode, checked_title };
        }
    }
    return { matchedType: null, matchedKey: null, matchedRule: null, matchedMode: null, checked_title };
}


        const proxyStr = (proxy || 'N/A').cyan;
        let { matchedType, matchedKey, matchedRule, matchedMode, checked_title } = await detect();
        let recheckCount = 0, maxRecheck = 2;

        while (matchedType && matchedRule && recheckCount < (matchedRule.maxRecheck || maxRecheck)) {
            log(
                'HIT'.black.bgYellow +
                ' | 命中检测: '.yellow + matchedType.bold.yellow +
                ` (${(matchedRule.solver || '').yellow}) [${matchedMode}: ${matchedKey}]`.yellow
            );
            if (matchedRule.handler) await matchedRule.handler(page, browser, log);

            ({ matchedType, matchedKey, matchedRule, matchedMode, checked_title } = await detect());
            if (!matchedType) break;

            recheckCount++;
            log(`[RECHECK] 第${recheckCount}次重新检测...`.white.bgMagenta);
            await page.reload({ waitUntil: "domcontentloaded" });
        }

        // 检测最终结果
        if (matchedType) {
            await page.close();
            if (browser) await browser.close().catch(() => { });
            return { valid: false, reason: `${matchedType} (${matchedMode}: ${matchedKey})` };
        }

        await sleep(1000);

        let cookieStr = '';
        try {
            const cookies = await page.cookies();
            if (cookies.length > 0) cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
        } catch { }

        // 只有标题和 cookie 都不为空才算有效
        if (!checked_title.trim() || !cookieStr.trim()) {
            await page.close();
            if (browser) await browser.close().catch(() => { });
            return { valid: false, reason: 'TITLE_OR_COOKIE_EMPTY' };
        }

        let userAgent = '';
        try { userAgent = await getUA(); } catch { }
     
        log(
            ' SOLVER '.black.bgGreen +
            ` | UA: "${userAgent}" | Cookie: "${cookieStr}" | Title: "${checked_title}"`.yellow
        );
        await page.close();
        if (browser) await browser.close().catch(() => { });
        return {
            valid: true,
            title: checked_title,
            cookie: cookieStr,
            ua : userAgent
        };
    } catch (e) {
        if (browser) await browser.close().catch(() => { });
        throw e;
    }
}

module.exports = {
    solving,
    sleep,
    DETECTION_RULES,
};
