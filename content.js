// YouTube Live Chat Analyzer v12 - С МЕТРИКАМИ ЭФИРА
console.log('🚀 YouTube Live Chat Analyzer v12 загружен!', new Date().toLocaleTimeString());

let comments = [];
let collectionInterval = null;
let metricsInterval = null;

// Метрики эфира
let metricsData = {
    viewers: [],      // { time, count }
    likes: [],        // { time, count }
    startTime: Date.now(),
    maxViewers: 0,
    maxLikes: 0,
    currentViewers: 0,
    currentLikes: 0
};

// Функция поиска всех сообщений чата
function getAllChatMessages() {
    let allMessages = [];
    
    const directMessages = document.querySelectorAll('yt-live-chat-text-message-renderer');
    if (directMessages.length > 0) {
        allMessages.push(...directMessages);
        console.log(`📊 Найдено ${directMessages.length} сообщений в основном DOM`);
    }
    
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc) {
                const iframeMessages = iframeDoc.querySelectorAll('yt-live-chat-text-message-renderer');
                if (iframeMessages.length > 0) {
                    allMessages.push(...iframeMessages);
                    console.log(`📊 Найдено ${iframeMessages.length} сообщений в iframe`);
                }
            }
        } catch(e) {}
    });
    
    return allMessages;
}

// Сбор метрик эфира (зрители, лайки) — ТОЛЬКО ОДНА ВЕРСИЯ
function collectMetrics() {
    const timestamp = Date.now();
    
    // 1. Количество зрителей (для LIVE и обычных видео)
    let viewersCount = 0;
    const viewersSelectors = [
        '.view-count',  // "Сейчас смотрят: 3 630"
        '#info #count yt-formatted-string',
        '#count .view-count'
    ];
    
    for (let sel of viewersSelectors) {
        const el = document.querySelector(sel);
        if (el) {
            let viewersText = el.innerText.trim();
            const match = viewersText.match(/(\d[\d\s]*)/);
            if (match) {
                viewersCount = parseInt(match[1].replace(/\s/g, '')) || 0;
                break;
            }
        }
    }
    // 2. Количество лайков (ищем кнопку "Нравится")
// 2. Количество лайков
let likesCount = 0;

// Ищем кнопку лайка по иконке LIKE
const likeIcon = document.querySelector('yt-animated-icon[animated-icon-type="LIKE"]');
if (likeIcon) {
    const likeButton = likeIcon.closest('button');
    if (likeButton) {
        const ariaLabel = likeButton.getAttribute('aria-label');
        if (ariaLabel) {
            // Парсим число из "понравилось 5 904 пользователям"
            const match = ariaLabel.match(/(\d[\d\s]*)\s*пользовател/);
            if (match) {
                likesCount = parseInt(match[1].replace(/\s/g, '')) || 0;
            }
        }
    }
}

console.log(`🔍 Найдена кнопка лайка, лайков: ${likesCount}`);
    
    // Обновляем текущие значения
    metricsData.currentViewers = viewersCount;
    metricsData.currentLikes = likesCount;
    
    // Сохраняем с меткой времени
    if (viewersCount > 0) {
        metricsData.viewers.push({ time: timestamp, count: viewersCount });
        if (viewersCount > metricsData.maxViewers) metricsData.maxViewers = viewersCount;
    }
    if (likesCount > 0) {
        metricsData.likes.push({ time: timestamp, count: likesCount });
        if (likesCount > metricsData.maxLikes) metricsData.maxLikes = likesCount;
    }
    
    // Логируем
    console.log(`📈 Метрики: зрителей ${viewersCount}, лайков ${likesCount}`);
    
    // Сохраняем в storage
    chrome.storage.local.set({ 'youtubeMetrics': metricsData });
}

// Функция сбора сообщений
function collectMessages() {
    const messages = getAllChatMessages();
    
    if (messages.length === 0) {
        console.log('⏳ Сообщений пока нет...');
        return;
    }
    
    let newCount = 0;
    
    messages.forEach(msg => {
        if (msg.hasAttribute('data-analyzed')) return;
        
        let author = null;
        const authorSelectors = ['#author-name', '#author-name span', '.author-name', '[id*="author-name"]'];
        for (let sel of authorSelectors) {
            const el = msg.querySelector(sel);
            if (el && el.innerText?.trim()) {
                author = el.innerText.trim();
                break;
            }
        }
        
        let message = null;
        const messageSelectors = ['#message', '#message span', '.message', '[id*="message"]'];
        for (let sel of messageSelectors) {
            const el = msg.querySelector(sel);
            if (el && el.innerText?.trim()) {
                message = el.innerText.trim();
                break;
            }
        }
        
        let time = null;
        const timeSelectors = ['#timestamp', '#timestamp span', '.timestamp', '[id*="timestamp"]'];
        for (let sel of timeSelectors) {
            const el = msg.querySelector(sel);
            if (el && el.innerText?.trim()) {
                time = el.innerText.trim();
                break;
            }
        }
        
        if (author && message) {
            msg.setAttribute('data-analyzed', 'true');
            
            comments.push({
                id: Date.now() + '-' + Math.random(),
                author: author.replace(/^@/, ''),
                message: message,
                time: time || new Date().toLocaleTimeString(),
                collectedAt: new Date().toISOString(),
                viewersAtTime: metricsData.currentViewers,
                likesAtTime: metricsData.currentLikes
            });
            
            newCount++;
            
            if (newCount % 10 === 1) {
                console.log(`💬 ${author}: ${message.substring(0, 50)}...`);
            }
        }
    });
    
    if (newCount > 0) {
        console.log(`📊 Добавлено ${newCount} сообщений. Всего: ${comments.length}`);
        chrome.storage.local.set({ 'youtubeComments': comments, 'youtubeMetrics': metricsData });
    }
}

// Запуск сбора
function startCollecting() {
    console.log('🎯 Запуск сбора сообщений и метрик...');
    
    if (collectionInterval) clearInterval(collectionInterval);
    if (metricsInterval) clearInterval(metricsInterval);
    
    // Сбор сообщений каждые 2 секунды
    setTimeout(() => {
        collectMessages();
        collectionInterval = setInterval(collectMessages, 2000);
    }, 2000);
    
    // Сбор метрик каждые 10 секунд
    setTimeout(() => {
        collectMetrics();
        metricsInterval = setInterval(collectMetrics, 10000);
    }, 1000);
}

// Запускаем на страницах YouTube
if (window.location.hostname.includes('youtube.com')) {
    console.log('🎬 YouTube обнаружен');
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startCollecting);
    } else {
        startCollecting();
    }
}

// Следим за изменениями URL
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        console.log('🔄 Страница изменена, перезапуск...');
        comments = [];
        metricsData = { viewers: [], likes: [], startTime: Date.now(), maxViewers: 0, maxLikes: 0, currentViewers: 0, currentLikes: 0 };
        setTimeout(startCollecting, 3000);
    }
}).observe(document, { subtree: true, childList: true });

// Обработка сообщений от popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Запрос от popup:', request.action);
    
    if (request.action === 'getStats') {
        const authors = {};
        comments.forEach(c => {
            authors[c.author] = (authors[c.author] || 0) + 1;
        });
        
        const topAuthors = Object.entries(authors)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([name, count]) => ({ name, count }));
        
        sendResponse({
            total: comments.length,
            uniqueAuthors: Object.keys(authors).length,
            topAuthors: topAuthors,
            lastUpdated: new Date().toLocaleTimeString(),
            metrics: {
                maxViewers: metricsData.maxViewers,
                currentViewers: metricsData.currentViewers,
                maxLikes: metricsData.maxLikes,
                currentLikes: metricsData.currentLikes,
                viewersHistory: metricsData.viewers.slice(-100),
                likesHistory: metricsData.likes.slice(-100)
            }
        });
    }
    
    if (request.action === 'getComments') {
        sendResponse({ comments: comments });
    }
    
    if (request.action === 'getMetrics') {
        sendResponse({ metrics: metricsData });
    }
    
    if (request.action === 'reset') {
        comments = [];
        metricsData = { viewers: [], likes: [], startTime: Date.now(), maxViewers: 0, maxLikes: 0, currentViewers: 0, currentLikes: 0 };
        chrome.storage.local.set({ 'youtubeComments': [], 'youtubeMetrics': metricsData });
        sendResponse({ success: true });
    }
    
    return true;
});

// Автосохранение каждые 10 секунд
setInterval(() => {
    if (comments.length > 0) {
        chrome.storage.local.set({ 'youtubeComments': comments, 'youtubeMetrics': metricsData });
    }
}, 10000);