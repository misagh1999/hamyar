import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer-core';
import { countFilledMarriageCaseFields, parseMarriageCaseText } from '../shared/marriageCaseParser.js';

function loadEnvFile(filePath, { override = false } = {}) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(process.cwd(), '.env'));
loadEnvFile(path.join(process.cwd(), '.env.local'), { override: true });

const PORT = Number(process.env.EITAA_MONITOR_PORT || 4179);
const TARGET_URL = process.env.EITAA_TARGET_URL?.trim() || 'https://web.eitaa.com/#@Moarefe_Moshavere';
const SCAN_INTERVAL_MS = Number(process.env.EITAA_SCAN_INTERVAL_MS || 2500);
const FAST_SCAN_INTERVAL_MS = Number(process.env.EITAA_FAST_SCAN_INTERVAL_MS || 0);
const NAVIGATION_SETTLE_MS = Number(process.env.EITAA_NAVIGATION_SETTLE_MS || 500);
const BURST_SCROLL_STEPS = Number(process.env.EITAA_BURST_SCROLL_STEPS || 20);
const BURST_STEP_DELAY_MS = Number(process.env.EITAA_BURST_STEP_DELAY_MS || 0);
const PAGE_JUMP_STEPS = Number(process.env.EITAA_PAGE_JUMP_STEPS || 8);
const PAGE_JUMP_DELAY_MS = Number(process.env.EITAA_PAGE_JUMP_DELAY_MS || 0);
const MAX_MESSAGES = Number(process.env.EITAA_MAX_MESSAGES || 300);
const HEADLESS = /^(1|true|yes)$/i.test(process.env.EITAA_HEADLESS || '');
const REMOTE_DEBUGGING_URL = process.env.EITAA_REMOTE_DEBUGGING_URL?.trim() || '';
const BROWSER_WS_ENDPOINT = process.env.EITAA_BROWSER_WS_ENDPOINT?.trim() || '';
const BROWSER_EXECUTABLE_PATH = process.env.EITAA_BROWSER_EXECUTABLE_PATH?.trim() || '';
const USER_DATA_DIR = process.env.EITAA_USER_DATA_DIR?.trim() || guessUserDataDir();
const PROFILE_DIRECTORY = process.env.EITAA_PROFILE_DIRECTORY?.trim() || 'Default';
const COPY_PROFILE_ON_LOCK = !/^(0|false|no)$/i.test(process.env.EITAA_COPY_PROFILE_ON_LOCK || '1');
const MESSAGE_SELECTOR =
  process.env.EITAA_MESSAGE_SELECTOR?.trim() ||
  '[data-message-id], [data-mid], [data-message], [class*="message"], [class*="Message"], [class*="bubble"], [class*="Bubble"], [role="listitem"]';
const SCROLL_CONTAINER_SELECTOR = process.env.EITAA_SCROLL_CONTAINER_SELECTOR?.trim() || '';
const AUTHOR_SELECTOR = process.env.EITAA_AUTHOR_SELECTOR?.trim() || '[class*="sender"], [class*="author"], strong, b';
const TIME_SELECTOR = process.env.EITAA_TIME_SELECTOR?.trim() || 'time';
const MESSAGE_TEXT_SELECTOR = process.env.EITAA_MESSAGE_TEXT_SELECTOR?.trim() || '';
const DEBUG_EXCERPT_CHARS = Number(process.env.EITAA_DEBUG_EXCERPT_CHARS || 1800);
const DEBUG_HTML_CHARS = Number(process.env.EITAA_DEBUG_HTML_CHARS || 3000);

const clients = new Set();
const messageStore = [];
const seenMessageKeys = new Set();
const tempProfileDirs = [];

let browser = null;
let page = null;
let ownedBrowser = false;
let running = false;
let phase = 'idle';
let browserMode = 'uninitialized';
let lastError = null;
let lastDiscoveredAt = null;
let traversalDirection = 'up';
let busy = false;
let tickTimer = null;
let lastScan = {
  when: null,
  candidateCount: 0,
  visibleCount: 0,
  fallbackCount: 0,
  scrollTop: 0,
  maxScrollTop: 0,
  pageTitle: '',
  pageUrl: '',
  note: 'idle',
};
let lastPageSnapshot = {
  when: null,
  pageTitle: '',
  pageUrl: '',
  bodyText: '',
  bodyHtml: '',
  totalElements: 0,
  messageSelectorCount: 0,
  scrollContainerCount: 0,
  note: 'idle',
};

function guessUserDataDir() {
  const home = os.homedir();
  const candidates = process.platform === 'darwin'
    ? [
        path.join(home, 'Library', 'Application Support', 'Google', 'Chrome'),
        path.join(home, 'Library', 'Application Support', 'Chromium'),
      ]
    : process.platform === 'win32'
      ? [
          path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data'),
          path.join(process.env.LOCALAPPDATA || '', 'Chromium', 'User Data'),
        ]
      : [
          path.join(home, '.config', 'google-chrome'),
          path.join(home, '.config', 'chromium'),
          path.join(home, '.config', 'brave-browser'),
        ];

  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || candidates[0];
}

function guessExecutablePath() {
  const candidates = process.platform === 'darwin'
    ? [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
      ]
    : process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files\\Chromium\\Application\\chrome.exe',
        ]
      : [
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable',
          '/usr/bin/chromium',
          '/usr/bin/chromium-browser',
          '/snap/bin/chromium',
        ];

  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || null;
}

function nowIso() {
  return new Date().toISOString();
}

function isProfileLockError(error) {
  const message = error instanceof Error ? error.message : String(error ?? '');

  return (
    /already running for/i.test(message) ||
    /userDataDir/i.test(message) ||
    /user data directory/i.test(message) ||
    /profile appears to be in use/i.test(message) ||
    /profile is in use/i.test(message) ||
    /locked the profile/i.test(message) ||
    /another google chrome process/i.test(message) ||
    (/profile/i.test(message) && /running/i.test(message))
  );
}

function buildProfileLockMessage() {
  return [
    'Chrome is already using that profile directory.',
    'I will try a temporary snapshot of that profile first when possible.',
    'To reuse the logged-in Eitaa session reliably, either:',
    '1. Close all Chrome windows that use the profile, then start the monitor again, or',
    '2. Start Chrome with remote debugging and set `EITAA_REMOTE_DEBUGGING_URL` or `EITAA_BROWSER_WS_ENDPOINT` in `.env`.',
    '',
    'Example:',
    '  google-chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.config/google-chrome"',
  ].join('\n');
}

async function createProfileSnapshot(sourceDir) {
  const snapshotDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'hamyar-eitaa-profile-'));
  await fs.promises.cp(sourceDir, snapshotDir, {
    recursive: true,
    force: true,
    preserveTimestamps: true,
    errorOnExist: false,
    filter: (source) => {
      const baseName = path.basename(source);
      if (
        baseName === 'SingletonLock' ||
        baseName === 'SingletonCookie' ||
        baseName === 'SingletonSocket' ||
        baseName === 'SingletonSharedMemory' ||
        baseName === 'DevToolsActivePort'
      ) {
        return false;
      }

      if (/^Singleton/i.test(baseName)) {
        return false;
      }

      return true;
    },
  });
  tempProfileDirs.push(snapshotDir);
  return snapshotDir;
}

function buildStatus() {
  return {
    running,
    phase,
    browserMode,
    targetUrl: TARGET_URL,
    lastError,
    messageCount: messageStore.length,
    traversalDirection,
    lastDiscoveredAt,
    lastScan,
    lastPageSnapshot,
    recentMessages: messageStore.slice(),
  };
}

function resetMonitorHistory() {
  messageStore.length = 0;
  seenMessageKeys.clear();
  lastDiscoveredAt = null;
  lastScan = {
    when: null,
    candidateCount: 0,
    visibleCount: 0,
    fallbackCount: 0,
    scrollTop: 0,
    maxScrollTop: 0,
    pageTitle: '',
    pageUrl: '',
    note: 'cleared',
  };
  lastPageSnapshot = {
    when: null,
    pageTitle: '',
    pageUrl: '',
    bodyText: '',
    bodyHtml: '',
    totalElements: 0,
    messageSelectorCount: 0,
    scrollContainerCount: 0,
    note: 'cleared',
  };
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function broadcast(event, payload) {
  const serialized = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;

  for (const client of clients) {
    client.write(serialized);
  }
}

function broadcastStatus() {
  broadcast('state', buildStatus());
}

function broadcastLog(message) {
  broadcast('log', { message, status: buildStatus() });
}

function broadcastMessage(message) {
  broadcast('message', { message, status: buildStatus() });
}

function recordMessage(message) {
  if (seenMessageKeys.has(message.key)) {
    return false;
  }

  seenMessageKeys.add(message.key);
  messageStore.push(message);
  lastDiscoveredAt = message.discoveredAt;

  if (messageStore.length > MAX_MESSAGES) {
    messageStore.splice(0, messageStore.length - MAX_MESSAGES);
  }

  broadcastMessage(message);
  return true;
}

function buildCasePreview(text) {
  const parsed = parseMarriageCaseText(text);
  const fieldCount = countFilledMarriageCaseFields(parsed.values);

  if (fieldCount < 5) {
    return null;
  }

  return {
    fieldCount,
    code: parsed.code || '',
    title: parsed.values.profile_title || '',
    matchedFields: parsed.matchedFields,
    values: parsed.values,
  };
}

async function connectBrowser() {
  if (browser) {
    return browser;
  }

  if (BROWSER_WS_ENDPOINT) {
    browser = await puppeteer.connect({ browserWSEndpoint: BROWSER_WS_ENDPOINT });
    ownedBrowser = false;
    browserMode = 'connected-ws';
    return browser;
  }

  if (REMOTE_DEBUGGING_URL) {
    browser = await puppeteer.connect({ browserURL: REMOTE_DEBUGGING_URL });
    ownedBrowser = false;
    browserMode = 'connected-url';
    return browser;
  }

  const executablePath = BROWSER_EXECUTABLE_PATH || guessExecutablePath();
  if (!executablePath || !fs.existsSync(executablePath)) {
    throw new Error(
      'Chrome/Chromium executable not found. Set EITAA_BROWSER_EXECUTABLE_PATH or EITAA_REMOTE_DEBUGGING_URL in .env.'
    );
  }

  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: HEADLESS ? 'new' : false,
      userDataDir: USER_DATA_DIR,
      defaultViewport: null,
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        `--profile-directory=${PROFILE_DIRECTORY}`,
      ],
    });

    ownedBrowser = true;
    browserMode = 'launched';
    return browser;
  } catch (error) {
    if (!COPY_PROFILE_ON_LOCK || !isProfileLockError(error)) {
      throw error;
    }

    const snapshotDir = await createProfileSnapshot(USER_DATA_DIR);
    browser = await puppeteer.launch({
      executablePath,
      headless: HEADLESS ? 'new' : false,
      userDataDir: snapshotDir,
      defaultViewport: null,
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        `--profile-directory=${PROFILE_DIRECTORY}`,
      ],
    });

    ownedBrowser = true;
    browserMode = 'launched-snapshot';
    lastError = 'Using a temporary snapshot of your Chrome profile because the live profile was locked.';
    return browser;
  }
}

async function ensurePage() {
  await connectBrowser();

  if (page && !page.isClosed()) {
    return page;
  }

  page = await browser.newPage();
  page.on('close', () => {
    if (page && page.isClosed()) {
      page = null;
    }
  });

  return page;
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncateText(value, maxChars) {
  if (!value) {
    return '';
  }

  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars)}\n… [truncated]`;
}

async function capturePageSnapshot(note = 'snapshot') {
  const currentPage = await ensurePage();

  const snapshot = await currentPage.evaluate((options) => {
    const messageSelector = options.messageSelector;
    const scrollContainerSelector = options.scrollContainerSelector;
    const body = document.body;
    const html = document.documentElement;
    const allElements = Array.from(document.querySelectorAll('*'));
    const tagCounts = new Map();

    for (const element of allElements) {
      const tag = element.tagName.toLowerCase();
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }

    const topTags = Array.from(tagCounts.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 12)
      .map(([tag, count]) => `${tag}:${count}`);

    const scrollContainers = scrollContainerSelector
      ? document.querySelectorAll(scrollContainerSelector).length
      : allElements.filter((element) => {
          if (!(element instanceof HTMLElement)) {
            return false;
          }

          const styles = window.getComputedStyle(element);
          return /(auto|scroll)/.test(styles.overflowY) && element.scrollHeight - element.clientHeight > 120;
        }).length;

    return {
      pageTitle: document.title || '',
      pageUrl: location.href || '',
      bodyText: body ? body.innerText || body.textContent || '' : '',
      bodyHtml: body ? body.innerHTML || '' : '',
      totalElements: allElements.length,
      messageSelectorCount: document.querySelectorAll(messageSelector).length,
      scrollContainerCount: scrollContainers,
      topTags,
    };
  }, {
    messageSelector: MESSAGE_SELECTOR,
    scrollContainerSelector: SCROLL_CONTAINER_SELECTOR,
  });

  lastPageSnapshot = {
    when: nowIso(),
    pageTitle: snapshot.pageTitle,
    pageUrl: snapshot.pageUrl,
    bodyText: truncateText(snapshot.bodyText.replace(/\s+\n/g, '\n').trim(), DEBUG_EXCERPT_CHARS),
    bodyHtml: truncateText(snapshot.bodyHtml.trim(), DEBUG_HTML_CHARS),
    totalElements: snapshot.totalElements,
    messageSelectorCount: snapshot.messageSelectorCount,
    scrollContainerCount: snapshot.scrollContainerCount,
    note: `${note}. top tags: ${snapshot.topTags.join(', ') || 'none'}`,
  };

  return lastPageSnapshot;
}

async function goToTargetPage() {
  const currentPage = await ensurePage();
  await currentPage.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await currentPage.bringToFront();
  await wait(NAVIGATION_SETTLE_MS);
  await capturePageSnapshot('after navigation');
  await currentPage.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('body *')).filter((element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      const styles = window.getComputedStyle(element);
      const scrollable = /(auto|scroll)/.test(styles.overflowY);
      return scrollable && element.scrollHeight - element.clientHeight > 120;
    });

    const container =
      (candidates.sort((left, right) => right.scrollHeight - right.clientHeight - (left.scrollHeight - left.clientHeight))[0]) ||
      document.scrollingElement ||
      document.documentElement;

    container.scrollTop = container.scrollHeight;
  });
}

async function extractVisibleMessages() {
  const currentPage = await ensurePage();

  return currentPage.evaluate((options) => {
    const selector = options.messageSelector;
    const scrollContainerSelector = options.scrollContainerSelector;
    const authorSelector = options.authorSelector;
    const timeSelector = options.timeSelector;
    const messageTextSelector = options.messageTextSelector;

    function getScrollContainer() {
      if (scrollContainerSelector) {
        const explicitContainer = document.querySelector(scrollContainerSelector);
        if (explicitContainer instanceof HTMLElement) {
          return explicitContainer;
        }
      }

      const candidates = Array.from(document.querySelectorAll('body *')).filter((element) => {
        if (!(element instanceof HTMLElement)) {
          return false;
        }

        const styles = window.getComputedStyle(element);
        const scrollable = /(auto|scroll)/.test(styles.overflowY);
        return scrollable && element.scrollHeight - element.clientHeight > 120;
      });

      return (
        candidates.sort(
          (left, right) =>
            right.scrollHeight - right.clientHeight - (left.scrollHeight - left.clientHeight)
        )[0] ||
        document.scrollingElement ||
        document.documentElement
      );
    }

    function cleanText(value) {
      return value.replace(/\s+/g, ' ').trim();
    }

    function compactText(value) {
      return cleanText(value).replace(/\s*\n\s*/g, ' ');
    }

    function preserveLineBreaks(value) {
      return String(value || '')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n')
        .trim();
    }

    function getMessageText(element) {
      const textContainer = messageTextSelector ? element.querySelector(messageTextSelector) : element;
      const rawText = textContainer?.innerText || textContainer?.textContent || element.innerText || element.textContent || '';
      return preserveLineBreaks(rawText);
    }

    const container = getScrollContainer();
    const candidateElements = Array.from(container.querySelectorAll(selector));
    const picked = [];

    for (const element of candidateElements) {
      if (!(element instanceof HTMLElement)) {
        continue;
      }

      if (element.querySelector(selector)) {
        continue;
      }

      const text = getMessageText(element);
      if (text.length < 12) {
        continue;
      }

      const rect = element.getBoundingClientRect();
      const visible = rect.bottom > 0 && rect.top < window.innerHeight * 1.5;
      const authorElement = element.querySelector(authorSelector);
      const timeElement = element.querySelector(timeSelector);
      const key =
        element.getAttribute('data-message-id') ||
        element.getAttribute('data-mid') ||
        element.getAttribute('data-message') ||
        element.id ||
        compactText(`${authorElement?.textContent || ''}|${timeElement?.textContent || ''}|${text.slice(0, 160)}`);

      picked.push({
        key,
        text,
        author: cleanText(authorElement?.textContent || ''),
        time: cleanText(timeElement?.getAttribute('datetime') || timeElement?.textContent || ''),
        visible,
      });
    }

    if (picked.length === 0) {
      const rawText = preserveLineBreaks(container.innerText || container.textContent || '');
      const blocks = rawText
        .split(/\n{2,}/)
        .map((block) => preserveLineBreaks(block))
        .filter((block) => block.length >= 20)
        .slice(0, 50);

      blocks.forEach((text, index) => {
        picked.push({
          key: `fallback-${index}-${text.slice(0, 80)}`,
          text,
          author: '',
          time: '',
          visible: true,
        });
      });
    }

    return {
      messages: picked.slice(0, 50),
      candidateCount: candidateElements.length,
      visibleCount: picked.filter((item) => item.visible).length,
      fallbackCount: picked.length && candidateElements.length === 0 ? picked.length : 0,
      scrollTop: container.scrollTop || 0,
      maxScrollTop: Math.max(0, container.scrollHeight - container.clientHeight),
      pageTitle: document.title || '',
      pageUrl: location.href || '',
    };
  }, {
    messageSelector: MESSAGE_SELECTOR,
    scrollContainerSelector: SCROLL_CONTAINER_SELECTOR,
    authorSelector: AUTHOR_SELECTOR,
    timeSelector: TIME_SELECTOR,
    messageTextSelector: MESSAGE_TEXT_SELECTOR,
  });
}

async function moveScrollPosition(direction) {
  const currentPage = await ensurePage();

  const target = await currentPage.evaluate(() => {
    const selector =
      '[data-message-id], [data-mid], [data-message], [class*="message"], [class*="Message"], [class*="bubble"], [class*="Bubble"], [role="listitem"]';

    function getScrollContainer() {
      const candidates = Array.from(document.querySelectorAll('body *')).filter((element) => {
        if (!(element instanceof HTMLElement)) {
          return false;
        }

        const styles = window.getComputedStyle(element);
        const scrollable = /(auto|scroll)/.test(styles.overflowY);
        return scrollable && element.scrollHeight - element.clientHeight > 120;
      });

      return (
        candidates.sort(
          (left, right) =>
            right.scrollHeight - right.clientHeight - (left.scrollHeight - left.clientHeight)
        )[0] ||
        document.scrollingElement ||
        document.documentElement
      );
    }

    const container = getScrollContainer();
    const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
    const currentTop = container.scrollTop || 0;
    const rect = container.getBoundingClientRect();

    return {
      scrollTop: currentTop,
      maxScrollTop,
      atTop: currentTop <= 0,
      atBottom: currentTop >= maxScrollTop,
      hasTargetElements: Boolean(container.querySelector(selector)),
      centerX: Math.max(0, Math.min(window.innerWidth - 1, rect.left + rect.width / 2)),
      centerY: Math.max(0, Math.min(window.innerHeight - 1, rect.top + rect.height / 2)),
    };
  });

  await currentPage.mouse.move(target.centerX, target.centerY);
  await currentPage.mouse.click(target.centerX, target.centerY);

  if (direction === 'up') {
    await currentPage.keyboard.press('Home');

    for (let index = 0; index < Math.max(1, PAGE_JUMP_STEPS); index += 1) {
      await currentPage.keyboard.press('PageUp');
      if (PAGE_JUMP_DELAY_MS > 0) {
        await wait(PAGE_JUMP_DELAY_MS);
      }
    }
  } else {
    await currentPage.keyboard.press('End');

    for (let index = 0; index < Math.max(1, PAGE_JUMP_STEPS); index += 1) {
      await currentPage.keyboard.press('PageDown');
      if (PAGE_JUMP_DELAY_MS > 0) {
        await wait(PAGE_JUMP_DELAY_MS);
      }
    }
  }

  return currentPage.evaluate((options) => {
    const selector =
      '[data-message-id], [data-mid], [data-message], [class*="message"], [class*="Message"], [class*="bubble"], [class*="Bubble"], [role="listitem"]';

    function getScrollContainer() {
      const candidates = Array.from(document.querySelectorAll('body *')).filter((element) => {
        if (!(element instanceof HTMLElement)) {
          return false;
        }

        const styles = window.getComputedStyle(element);
        const scrollable = /(auto|scroll)/.test(styles.overflowY);
        return scrollable && element.scrollHeight - element.clientHeight > 120;
      });

      return (
        candidates.sort(
          (left, right) =>
            right.scrollHeight - right.clientHeight - (left.scrollHeight - left.clientHeight)
        )[0] ||
        document.scrollingElement ||
        document.documentElement
      );
    }

    const container = getScrollContainer();
    const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
    const currentTop = container.scrollTop || 0;

    return {
      scrollTop: currentTop,
      maxScrollTop,
      atTop: currentTop <= 0,
      atBottom: currentTop >= maxScrollTop,
      hasTargetElements: Boolean(container.querySelector(selector)),
    };
  });
}

async function captureTick() {
  if (!running || !page || page.isClosed()) {
    return { discoveredAny: false, moved: false };
  }

  let discoveredAny = false;
  let movedAny = false;
  let burstIterations = 0;
  let snapshot = null;

  while (burstIterations < Math.max(1, BURST_SCROLL_STEPS)) {
    snapshot = await extractVisibleMessages();
    lastScan = {
      when: nowIso(),
      candidateCount: snapshot.candidateCount,
      visibleCount: snapshot.visibleCount,
      fallbackCount: snapshot.fallbackCount,
      scrollTop: snapshot.scrollTop,
      maxScrollTop: snapshot.maxScrollTop,
      pageTitle: snapshot.pageTitle,
      pageUrl: snapshot.pageUrl,
      note:
        snapshot.candidateCount > 0
          ? `Matched ${snapshot.candidateCount} candidate nodes.`
          : 'No candidate nodes matched the current selectors yet.',
    };

  for (const item of snapshot.messages) {
    const casePreview = buildCasePreview(item.text);
    const recorded = recordMessage({
      ...item,
      casePreview,
      discoveredAt: nowIso(),
    });

      discoveredAny = discoveredAny || recorded;
    }

    if (snapshot.maxScrollTop <= 0) {
      break;
    }

    const previousScrollTop = snapshot.scrollTop;
    const movement = await moveScrollPosition(traversalDirection);
    const moved = movement.scrollTop !== previousScrollTop;
    movedAny = movedAny || moved;

    if (movement.atTop || movement.atBottom || !moved) {
      traversalDirection = 'up';
      break;
    }

    burstIterations += 1;
    if (burstIterations < BURST_SCROLL_STEPS) {
      await wait(BURST_STEP_DELAY_MS);
    }
  }

  broadcastStatus();
  return { discoveredAny, moved: movedAny };
}

function clearTickTimer() {
  if (tickTimer) {
    clearTimeout(tickTimer);
    tickTimer = null;
  }
}

function scheduleNextTick(delayMs) {
  if (!running || !page || page.isClosed()) {
    return;
  }

  clearTickTimer();
  tickTimer = setTimeout(() => {
    tickTimer = null;
    void captureTick()
      .then((result) => {
        if (!running) {
          return;
        }

        const nextDelay = result.moved ? FAST_SCAN_INTERVAL_MS : SCAN_INTERVAL_MS;
        scheduleNextTick(nextDelay);
      })
      .catch((error) => {
        lastError = error instanceof Error ? error.message : 'Monitor tick failed.';
        phase = 'error';
        broadcastStatus();
        broadcastLog(lastError);
      });
  }, Math.max(0, delayMs));
}

async function startMonitor() {
  if (running || busy) {
    return buildStatus();
  }

  busy = true;
  lastError = null;
  phase = 'starting';
  broadcastStatus();

  try {
    await goToTargetPage();
    running = true;
    phase = 'running';
    traversalDirection = 'up';
    broadcastLog(
      `Eitaa monitor connected. pageTitle="${lastPageSnapshot.pageTitle || 'unknown'}" pageUrl="${lastPageSnapshot.pageUrl || TARGET_URL}" messageSelectorCount=${lastPageSnapshot.messageSelectorCount} scrollContainers=${lastPageSnapshot.scrollContainerCount}`
    );
    broadcastStatus();

    clearTickTimer();
    scheduleNextTick(0);

    return buildStatus();
  } catch (error) {
    if (isProfileLockError(error)) {
      lastError = buildProfileLockMessage();
    } else {
      lastError = error instanceof Error ? error.message : 'Failed to start monitor.';
    }
    phase = 'error';
    running = false;
    broadcastStatus();
    throw new Error(lastError);
  } finally {
    busy = false;
  }
}

async function stopMonitor() {
  phase = 'stopping';
  broadcastStatus();

  clearTickTimer();

  if (page && !page.isClosed()) {
    await page.close().catch(() => {});
  }

  page = null;
  running = false;
  phase = 'idle';
  lastError = null;

  if (browser) {
    if (ownedBrowser) {
      await browser.close().catch(() => {});
    } else {
      browser.disconnect();
    }
  }

  browser = null;
  ownedBrowser = false;
  browserMode = 'stopped';
  broadcastStatus();
  return buildStatus();
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      if (!body) {
        resolve('');
        return;
      }

      resolve(body);
    });

    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const requestUrl = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  if (req.method === 'GET' && requestUrl.pathname === '/api/eitaa/status') {
    sendJson(res, 200, buildStatus());
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === '/api/eitaa/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });

    res.write(`retry: ${SCAN_INTERVAL_MS}\n\n`);
    clients.add(res);

    res.write(`event: state\ndata: ${JSON.stringify(buildStatus())}\n\n`);

    req.on('close', () => {
      clients.delete(res);
    });

    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === '/api/eitaa/start') {
    try {
      const status = await startMonitor();
      sendJson(res, 200, status);
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Failed to start monitor.',
      });
    }

    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === '/api/eitaa/reset') {
    try {
      resetMonitorHistory();
      broadcastStatus();
      sendJson(res, 200, buildStatus());
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Failed to reset monitor state.',
      });
    }

    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === '/api/eitaa/stop') {
    try {
      const status = await stopMonitor();
      sendJson(res, 200, status);
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Failed to stop monitor.',
      });
    }

    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === '/api/eitaa/messages') {
    sendJson(res, 200, {
      messages: messageStore.slice(),
    });
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === '/health') {
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Eitaa monitor API running on http://127.0.0.1:${PORT}`);
});

process.on('SIGINT', async () => {
  await stopMonitor().catch(() => {});
  for (const dir of tempProfileDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  server.close(() => process.exit(0));
});

process.on('SIGTERM', async () => {
  await stopMonitor().catch(() => {});
  for (const dir of tempProfileDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  server.close(() => process.exit(0));
});
