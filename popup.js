// popup.js — исправленная версия (без innerHTML предупреждений)
let updateInterval = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('Popup открыт');
    
    const refreshBtn = document.getElementById('refreshBtn');
    const exportBtn = document.getElementById('exportBtn');
    const resetBtn = document.getElementById('resetBtn');
    const autoUpdateCheckbox = document.getElementById('autoUpdate');
    const openDashboardBtn = document.getElementById('openDashboardBtn');
    
    loadStats();
    
    if (autoUpdateCheckbox && autoUpdateCheckbox.checked) {
        startAutoUpdate();
    }
    
    refreshBtn.addEventListener('click', () => {
        loadStats();
        refreshBtn.style.opacity = '0.5';
        setTimeout(() => { refreshBtn.style.opacity = '1'; }, 200);
    });
    
    exportBtn.addEventListener('click', exportToCSV);
    resetBtn.addEventListener('click', resetData);
    
    if (openDashboardBtn) {
        openDashboardBtn.addEventListener('click', function() {
            const dashboardUrl = chrome.runtime.getURL('dashboard.html');
            window.open(dashboardUrl, '_blank');
        });
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
    
    function startAutoUpdate() {
        if (updateInterval) clearInterval(updateInterval);
        updateInterval = setInterval(loadStats, 5000);
        console.log('🔄 Автообновление включено');
    }
    
    function stopAutoUpdate() {
        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
            console.log('⏸️ Автообновление выключено');
        }
    }
    
    function loadStats() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs[0] || !tabs[0].url || !tabs[0].url.includes('youtube.com')) {
                document.getElementById('totalCount').textContent = '0';
                document.getElementById('uniqueCount').textContent = '0';
                document.getElementById('lastUpdate').textContent = 'Нет активного видео YouTube';
                const userList = document.getElementById('userList');
                userList.textContent = '';
                const msg = document.createElement('div');
                msg.style.textAlign = 'center';
                msg.style.color = '#999';
                msg.textContent = 'Откройте YouTube';
                userList.appendChild(msg);
                return;
            }
            
            chrome.tabs.sendMessage(tabs[0].id, {action: 'getStats'}, function(response) {
                if (chrome.runtime.lastError) {
                    console.error('Ошибка:', chrome.runtime.lastError.message);
                    document.getElementById('totalCount').textContent = '0';
                    document.getElementById('uniqueCount').textContent = '0';
                    document.getElementById('lastUpdate').textContent = 'Ошибка: обновите страницу YouTube';
                    const userList = document.getElementById('userList');
                    userList.textContent = '';
                    const msg = document.createElement('div');
                    msg.style.textAlign = 'center';
                    msg.style.color = '#ff0000';
                    msg.textContent = 'Расширение не активно. Обновите страницу YouTube';
                    userList.appendChild(msg);
                    return;
                }
                
                if (response) {
                    document.getElementById('totalCount').textContent = response.total || 0;
                    document.getElementById('uniqueCount').textContent = response.uniqueAuthors || 0;
                    document.getElementById('lastUpdate').textContent = `Обновлено: ${new Date().toLocaleTimeString()}`;
                    
                    const userList = document.getElementById('userList');
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
                    
                    if (response.lastMessages && response.lastMessages.length > 0) {
                        const lastMessagesDiv = document.getElementById('lastMessages');
                        if (lastMessagesDiv) {
                            lastMessagesDiv.textContent = '';
                            response.lastMessages.slice(-3).reverse().forEach(msg => {
                                const div = document.createElement('div');
                                div.className = 'last-message';
                                const timeSpan = document.createElement('span');
                                timeSpan.className = 'msg-time';
                                timeSpan.textContent = `[${msg.time}] `;
                                const authorSpan = document.createElement('span');
                                authorSpan.className = 'msg-author';
                                authorSpan.textContent = `${msg.author}: `;
                                const textSpan = document.createElement('span');
                                textSpan.className = 'msg-text';
                                textSpan.textContent = msg.message.substring(0, 50);
                                div.appendChild(timeSpan);
                                div.appendChild(authorSpan);
                                div.appendChild(textSpan);
                                lastMessagesDiv.appendChild(div);
                            });
                        }
                    }
                }
            });
        });
    }
    
    function exportToCSV() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: 'getComments'}, function(response) {
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
        });
    }
    
    function resetData() {
        if (confirm('Очистить все собранные сообщения?')) {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {action: 'reset'}, function() {
                    loadStats();
                });
            });
        }
    }
});

window.addEventListener('beforeunload', () => {
    if (updateInterval) clearInterval(updateInterval);
});