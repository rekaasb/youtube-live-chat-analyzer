// dashboard.js — полная версия с метриками
let updateInterval = null;
let currentTabId = null;

const tabsAPI = typeof browser !== 'undefined' ? browser : chrome;

async function findYouTubeTab() {
    try {
        const tabs = await tabsAPI.tabs.query({});
        
        if (!tabs || tabs.length === 0) {
            console.log('❌ Нет открытых вкладок');
            return null;
        }
        
        const youtubeTab = tabs.find(tab => 
            tab.url && 
            tab.url.includes('youtube.com/watch') && 
            !tab.url.includes('dashboard')
        );
        
        if (youtubeTab) {
            currentTabId = youtubeTab.id;
            console.log('✅ Найдена YouTube вкладка:', youtubeTab.url);
            return youtubeTab;
        }
        
        const anyYoutube = tabs.find(tab => 
            tab.url && tab.url.includes('youtube.com')
        );
        
        if (anyYoutube) {
            currentTabId = anyYoutube.id;
            console.log('✅ Найдена YouTube вкладка (не видео):', anyYoutube.url);
            return anyYoutube;
        }
        
        console.log('❌ YouTube вкладка не найдена');
        currentTabId = null;
        return null;
        
    } catch (error) {
        console.error('Ошибка при поиске вкладок:', error);
        currentTabId = null;
        return null;
    }
}

function updateStatusElement(id, text, isError = false) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = text;
        if (isError) element.style.color = '#ff0000';
        else element.style.color = '#999';
    }
}

function clearAndAddMessage(containerId, text, color = '#999') {
    const container = document.getElementById(containerId);
    if (container) {
        container.textContent = '';
        const msg = document.createElement('div');
        msg.style.textAlign = 'center';
        msg.style.color = color;
        msg.textContent = text;
        container.appendChild(msg);
    }
}

async function loadStats() {
    // Если нет activeTabId, ищем вкладку
    if (!currentTabId) {
        await findYouTubeTab();
        if (!currentTabId) {
            updateStatusElement('totalCount', '0');
            updateStatusElement('uniqueCount', '0');
            updateStatusElement('lastUpdate', '❌ Не найдена вкладка YouTube');
            clearAndAddMessage('userList', 'Откройте YouTube в любой вкладке', '#ff0000');
            clearAndAddMessage('messageList', 'Откройте YouTube в любой вкладке', '#ff0000');
            const statusIndicator = document.getElementById('statusIndicator');
            if (statusIndicator) statusIndicator.style.background = '#ff0000';
            
            // Скрываем блок метрик
            const metricsStats = document.getElementById('metricsStats');
            if (metricsStats) metricsStats.style.display = 'none';
            return;
        }
    }
    
    // Проверяем, жива ли вкладка
    try {
        const tab = await tabsAPI.tabs.get(currentTabId);
        if (!tab || !tab.url || !tab.url.includes('youtube.com')) {
            console.log('Вкладка изменилась, ищем новую...');
            await findYouTubeTab();
            if (!currentTabId) return;
        }
    } catch (e) {
        console.log('Вкладка закрыта, ищем новую...');
        await findYouTubeTab();
        if (!currentTabId) return;
    }
    
    // Отправляем запрос в content script
    tabsAPI.tabs.sendMessage(currentTabId, {action: 'getStats'}, function(response) {
        if (tabsAPI.runtime.lastError) {
            console.error('Ошибка:', tabsAPI.runtime.lastError.message);
            updateStatusElement('totalCount', '0');
            updateStatusElement('uniqueCount', '0');
            updateStatusElement('lastUpdate', '⚠️ Обновите страницу YouTube');
            clearAndAddMessage('userList', 'Расширение не активно. Обновите страницу YouTube', '#ff9800');
            const statusIndicator = document.getElementById('statusIndicator');
            if (statusIndicator) statusIndicator.style.background = '#ff9800';
            
            // Скрываем блок метрик при ошибке
            const metricsStats = document.getElementById('metricsStats');
            if (metricsStats) metricsStats.style.display = 'none';
            return;
        }
        
        if (response) {
            // Обновляем основные счетчики
            updateStatusElement('totalCount', response.total || '0');
            updateStatusElement('uniqueCount', response.uniqueAuthors || '0');
            
            // ========== ОБНОВЛЕНИЕ МЕТРИК ==========
            if (response.metrics) {
                console.log('📊 Метрики получены:', response.metrics);
                
                const currentViewersEl = document.getElementById('currentViewers');
                const maxViewersEl = document.getElementById('maxViewers');
                const currentLikesEl = document.getElementById('currentLikes');
                
                if (currentViewersEl) {
                    const viewers = response.metrics.currentViewers || 0;
                    currentViewersEl.textContent = viewers.toLocaleString();
                }
                if (maxViewersEl) {
                    const maxViewers = response.metrics.maxViewers || 0;
                    maxViewersEl.textContent = maxViewers.toLocaleString();
                }
                if (currentLikesEl) {
                    const likes = response.metrics.currentLikes || 0;
                    currentLikesEl.textContent = likes.toLocaleString();
                }
                
                // Показываем блок метрик
                const metricsStats = document.getElementById('metricsStats');
                if (metricsStats) {
                    metricsStats.style.display = 'block';
                }
            } else {
                console.log('⚠️ Метрики не пришли в response');
                // Скрываем блок метрик, если их нет
                const metricsStats = document.getElementById('metricsStats');
                if (metricsStats) metricsStats.style.display = 'none';
            }
            // =====================================
            
            const now = new Date();
            updateStatusElement('lastUpdate', `Обновлено: ${now.toLocaleTimeString()}`);
            const statusIndicator = document.getElementById('statusIndicator');
            if (statusIndicator) statusIndicator.style.background = '#4CAF50';
            
            // Топ участников
            const userList = document.getElementById('userList');
            if (userList) {
                userList.textContent = '';
                
                if (!response.topAuthors || response.topAuthors.length === 0) {
                    const msg = document.createElement('div');
                    msg.style.textAlign = 'center';
                    msg.style.color = '#999';
                    msg.textContent = 'Нет сообщений';
                    userList.appendChild(msg);
                } else {
                    response.topAuthors.forEach(user => {
                        const item = document.createElement('div');
                        item.className = 'user-item';
                        const nameSpan = document.createElement('span');
                        nameSpan.className = 'user-name';
                        nameSpan.textContent = user.name;
                        const countSpan = document.createElement('span');
                        countSpan.className = 'user-count';
                        countSpan.textContent = user.count;
                        item.appendChild(nameSpan);
                        item.appendChild(countSpan);
                        userList.appendChild(item);
                    });
                }
            }
            
            // Последние сообщения
            tabsAPI.tabs.sendMessage(currentTabId, {action: 'getComments'}, function(msgResponse) {
                const messageList = document.getElementById('messageList');
                if (messageList && msgResponse && msgResponse.comments) {
                    messageList.textContent = '';
                    const lastMessages = msgResponse.comments.slice(-20).reverse();
                    
                    if (lastMessages.length === 0) {
                        const msg = document.createElement('div');
                        msg.style.textAlign = 'center';
                        msg.style.color = '#999';
                        msg.textContent = 'Нет сообщений';
                        messageList.appendChild(msg);
                    } else {
                        lastMessages.forEach(msg => {
                            const item = document.createElement('div');
                            item.className = 'message-item';
                            const timeDiv = document.createElement('div');
                            timeDiv.className = 'message-time';
                            timeDiv.textContent = msg.time;
                            const contentDiv = document.createElement('div');
                            const authorSpan = document.createElement('span');
                            authorSpan.className = 'message-author';
                            authorSpan.textContent = `${msg.author}: `;
                            const textSpan = document.createElement('span');
                            textSpan.className = 'message-text';
                            textSpan.textContent = (msg.message || msg.text).substring(0, 100);
                            contentDiv.appendChild(authorSpan);
                            contentDiv.appendChild(textSpan);
                            item.appendChild(timeDiv);
                            item.appendChild(contentDiv);
                            messageList.appendChild(item);
                        });
                    }
                }
            });
        }
    });
}

function exportToCSV() {
    if (!currentTabId) {
        alert('Нет активной вкладки YouTube');
        findYouTubeTab().then(() => {
            if (currentTabId) exportToCSV();
            else alert('Откройте YouTube в любой вкладке');
        });
        return;
    }
    
    tabsAPI.tabs.sendMessage(currentTabId, {action: 'getComments'}, function(response) {
        if (response && response.comments && response.comments.length > 0) {
            const csv = response.comments.map(c => 
                `"${c.time.replace(/"/g, '""')}","${c.author.replace(/"/g, '""')}","${(c.message || c.text).replace(/"/g, '""')}"`
            ).join('\n');
            
            const fileName = `youtube_chat_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.csv`;
            const blob = new Blob(['\uFEFFВремя,Автор,Сообщение\n' + csv], {type: 'text/csv;charset=utf-8;'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            alert(`✅ Экспортировано ${response.comments.length} сообщений`);
        } else {
            alert('Нет сообщений для экспорта');
        }
    });
}

function resetData() {
    if (!currentTabId) return;
    if (confirm('Очистить все собранные сообщения?')) {
        tabsAPI.tabs.sendMessage(currentTabId, {action: 'reset'}, function() {
            loadStats();
        });
    }
}

// Слушаем смену активной вкладки
tabsAPI.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await tabsAPI.tabs.get(activeInfo.tabId);
        if (tab.url && tab.url.includes('youtube.com')) {
            currentTabId = activeInfo.tabId;
            loadStats();
        }
    } catch (e) {}
});

// Слушаем обновление вкладок
tabsAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabId === currentTabId && changeInfo.status === 'complete') {
        setTimeout(loadStats, 1000);
    }
});

// Слушаем закрытие вкладок
tabsAPI.tabs.onRemoved.addListener((tabId) => {
    if (tabId === currentTabId) {
        console.log('YouTube вкладка закрыта, ищем другую...');
        findYouTubeTab().then(() => loadStats());
    }
});

// Инициализация
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Dashboard загружен, ищу YouTube вкладку...');
    await findYouTubeTab();
    
    const refreshBtn = document.getElementById('refreshBtn');
    const exportBtn = document.getElementById('exportBtn');
    const resetBtn = document.getElementById('resetBtn');
    const autoUpdateCheckbox = document.getElementById('autoUpdate');
    
    loadStats();
    
    if (refreshBtn) refreshBtn.addEventListener('click', loadStats);
    if (exportBtn) exportBtn.addEventListener('click', exportToCSV);
    if (resetBtn) resetBtn.addEventListener('click', resetData);
    
    function startAutoUpdate() {
        if (updateInterval) clearInterval(updateInterval);
        updateInterval = setInterval(loadStats, 3000);
        console.log('🔄 Автообновление включено');
    }
    
    function stopAutoUpdate() {
        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
            console.log('⏸️ Автообновление выключено');
        }
    }
    
    if (autoUpdateCheckbox && autoUpdateCheckbox.checked) {
        startAutoUpdate();
    }
    
    if (autoUpdateCheckbox) {
        autoUpdateCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                startAutoUpdate();
            } else {
                stopAutoUpdate();
            }
        });
    }
});

window.addEventListener('beforeunload', () => {
    if (updateInterval) clearInterval(updateInterval);
});