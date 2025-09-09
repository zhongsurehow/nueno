// 全局变量
let cryptoData = [];
let sortConfig = {
    column: 'name',
    direction: 'asc'
};
let refreshInterval = null;
let isLoading = false;
let announcements = [];
let depositWithdrawInfo = {};
let arbitrageOpportunities = [];

// 交易所配置
const exchanges = ['binance', 'okx', 'mexc', 'gate', 'kucoin', 'bitget', 'bybit', 'htx'];
const exchangeNames = {
    'binance': 'Binance',
    'okx': 'OKX', 
    'mexc': 'MEXC',
    'gate': 'Gate',
    'kucoin': 'Kucoin',
    'bitget': 'Bitget',
    'bybit': 'Bybit',
    'htx': 'HTX'
};

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    // 初始化事件监听器
    initEventListeners();
    
    // 初始化功能面板
    initFeaturePanels();
    
    // 请求通知权限
    requestNotificationPermission();
    
    // 首次加载数据
    fetchData();
    
    // 获取公告信息
    fetchAnnouncements();
    
    // 获取充提信息
    fetchDepositWithdrawInfo();
    
    // 默认设置30秒自动刷新
    setAutoRefresh(30);
});

// 请求通知权限
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                console.log('通知权限已获取');
            }
        });
    }
}

// 初始化所有事件监听器
function initEventListeners() {
    // 刷新按钮点击事件
    document.getElementById('refresh-btn').addEventListener('click', () => {
        fetchData();
    });
    
    // 自动刷新选择事件
    document.getElementById('auto-refresh').addEventListener('change', (e) => {
        const seconds = parseFloat(e.target.value);
        setAutoRefresh(seconds);
    });
    
    // 搜索功能
    document.getElementById('search-btn').addEventListener('click', filterData);
    document.getElementById('search-input').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            filterData();
        }
    });
    
    // 表头排序点击事件
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.getAttribute('data-sort');
            sortData(column);
        });
    });
}

// 初始化功能面板
function initFeaturePanels() {
    // 套利机会按钮
    document.getElementById('arbitrage-btn').addEventListener('click', () => {
        togglePanel('arbitrage-panel', 'arbitrage-btn');
    });
    
    // 公告监控按钮
    document.getElementById('announcements-btn').addEventListener('click', () => {
        togglePanel('announcements-panel', 'announcements-btn');
    });
    
    // 充提信息按钮
    document.getElementById('deposit-withdraw-btn').addEventListener('click', () => {
        togglePanel('deposit-withdraw-panel', 'deposit-withdraw-btn');
    });
}

// 切换面板显示
function togglePanel(panelId, buttonId) {
    const panel = document.getElementById(panelId);
    const button = document.getElementById(buttonId);
    
    if (panel.style.display === 'none') {
        // 隐藏所有面板
        document.querySelectorAll('.feature-panel').forEach(p => p.style.display = 'none');
        document.querySelectorAll('.feature-btn').forEach(b => b.classList.remove('active'));
        
        // 显示当前面板
        panel.style.display = 'block';
        button.classList.add('active');
        
        // 更新面板内容
        updatePanelContent(panelId);
    } else {
        panel.style.display = 'none';
        button.classList.remove('active');
    }
}

// 更新面板内容
function updatePanelContent(panelId) {
    switch(panelId) {
        case 'arbitrage-panel':
            updateArbitragePanel();
            break;
        case 'announcements-panel':
            updateAnnouncementsPanel();
            break;
        case 'deposit-withdraw-panel':
            updateDepositWithdrawPanel();
            break;
    }
}

// 设置自动刷新
function setAutoRefresh(seconds) {
    // 清除现有的刷新间隔
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
    
    // 如果选择了自动刷新，设置新的间隔
    if (seconds > 0) {
        // 将字符串转换为数字
        const interval = parseFloat(seconds) * 1000;
        refreshInterval = setInterval(() => {
            fetchData();
        }, interval);
    }
}

// CoinAPI key - 替换为你自己的API密钥
const apiKey = "YOUR_API_KEY_HERE";

// 从CoinAPI获取数据
async function fetchData() {
    if (isLoading) return;

    isLoading = true;
    showLoading(true);
    hideError();

    // 如果没有提供API密钥，则使用模拟数据并显示提示
    if (apiKey === "YOUR_API_KEY_HERE") {
        showError("请在script.js中设置您的CoinAPI密钥以获取实时数据。正在显示模拟数据。");
        cryptoData = getMockDataWithRealStructure();
        calculateArbitrageOpportunities();
        updateTable();
        updateLastUpdateTime();
        isLoading = false;
        showLoading(false);
        return;
    }

    try {
        const symbolsToFetch = ['BTC', 'ETH', 'SOL', 'DOGE', 'LINK'];
        const promises = symbolsToFetch.map(symbol => {
            const filter = `&filter_symbol_id=SPOT_${symbol}_USDT`;
            return fetch(`https://rest.coinapi.io/v1/quotes/current?${filter}`, {
                headers: {
                    'X-CoinAPI-Key': apiKey
                }
            }).then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            });
        });

        const results = await Promise.all(promises);
        
        // 将API返回的数据转换为我们需要的格式
        const newCryptoData = [];
        const cryptoMap = new Map();

        results.flat().forEach(quote => {
            const parts = quote.symbol_id.split('_');
            const exchange = parts[0].toLowerCase();
            const symbol = parts[2];

            if (!cryptoMap.has(symbol)) {
                cryptoMap.set(symbol, {
                    name: `${symbol}/USDT`,
                    symbol: symbol,
                    market_cap: 0, // API不直接提供，需要另外获取或模拟
                    volume_24h: 0, // API不直接提供
                });
            }

            const cryptoItem = cryptoMap.get(symbol);
            cryptoItem[exchange] = {
                bid: quote.bid_price,
                ask: quote.ask_price,
                mid: (quote.bid_price + quote.ask_price) / 2,
                volume: quote.bid_size + quote.ask_size, // 这是一个近似值
                walletStatus: 'ok', // 需要另外的API来获取真实状态
                tradingFee: 0.001 // 模拟手续费
            };
        });
        
        cryptoData = Array.from(cryptoMap.values());

        calculateArbitrageOpportunities();
        updateTable();
        updateLastUpdateTime();

    } catch (error) {
        console.error('获取CoinAPI数据失败:', error);
        showError('获取实时价格数据失败，请检查您的API密钥或网络连接。');
        // 发生错误时可以加载模拟数据作为备用
        cryptoData = getMockDataWithRealStructure();
        calculateArbitrageOpportunities();
        updateTable();
        updateLastUpdateTime();
    } finally {
        isLoading = false;
        showLoading(false);
    }
}

// 更新表格数据
function updateTable() {
    const tableBody = document.getElementById('price-data');
    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput.value.trim().toLowerCase();
    
    // 过滤数据
    let filteredData = cryptoData;
    if (searchTerm) {
        filteredData = cryptoData.filter(crypto => 
            crypto.name.toLowerCase().includes(searchTerm) ||
            crypto.symbol.toLowerCase().includes(searchTerm)
        );
    }
    
    // 排序数据
    filteredData = sortDataByConfig(filteredData);
    
    // 清空表格
    tableBody.innerHTML = '';
    
    // 如果没有数据
    if (filteredData.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="10" style="text-align: center;">没有找到匹配的数据</td>`;
        tableBody.appendChild(row);
        return;
    }
    
    // 填充表格
    filteredData.forEach(crypto => {
        const row = document.createElement('tr');
        
        // 计算最高和最低价格（使用中间价）
        const prices = exchanges.map(exchange => crypto[exchange].mid).filter(price => price !== null && isFinite(price));
        
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const spread = maxPrice - minPrice;
        const spreadPercentage = (minPrice > 0) ? ((spread / minPrice) * 100).toFixed(2) : "0.00";
        
        // 计算套利机会
        const arbitrageInfo = calculateCryptoArbitrage(crypto);
        
        // 创建单元格并添加高亮
        row.innerHTML = `
            <td>
                <div style="font-weight: bold;">${crypto.name}</div>
                <div style="color: #7f8c8d; font-size: 0.8rem;">${crypto.symbol}</div>
            </td>
            ${createBidAskCell(crypto.binance, maxPrice, minPrice)}
            ${createBidAskCell(crypto.okx, maxPrice, minPrice)}
            ${createBidAskCell(crypto.mexc, maxPrice, minPrice)}
            ${createBidAskCell(crypto.gate, maxPrice, minPrice)}
            ${createBidAskCell(crypto.kucoin, maxPrice, minPrice)}
            ${createBidAskCell(crypto.bitget, maxPrice, minPrice)}
            ${createBidAskCell(crypto.bybit, maxPrice, minPrice)}
            ${createBidAskCell(crypto.htx, maxPrice, minPrice)}
            <td class="price-spread">${spread > 0 ? spread.toFixed(6) : '0.00'} (${spreadPercentage}%)</td>
            ${createArbitrageCell(arbitrageInfo)}
        `;
        
        tableBody.appendChild(row);
    });
}

// 创建买卖价格单元格HTML
function createBidAskCell(priceData, maxPrice, minPrice) {
    if (!priceData || !priceData.bid || !priceData.ask) {
        return '<td>-</td>';
    }
    
    const midPrice = priceData.mid;
    let className = '';

    // Heatmap logic
    if (maxPrice > minPrice) {
        const range = maxPrice - minPrice;
        const position = (midPrice - minPrice) / range;
        const heatIndex = Math.floor(position * 10);
        className = `price-heatmap-${Math.min(heatIndex, 9)}`; // Cap at 9
    }
    
    // Function to format large numbers
    const formatVolume = (vol) => {
        if (vol > 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`;
        if (vol > 1_000) return `${(vol / 1_000).toFixed(1)}K`;
        return vol.toFixed(0);
    };

    return `<td class="${className}">
        <div class="bid-ask-prices">
            <div class="bid-price">买: ${priceData.bid.toFixed(6)}</div>
            <div class="ask-price">卖: ${priceData.ask.toFixed(6)}</div>
        </div>
        <div class="cell-info">
            <span>Vol: ${formatVolume(priceData.volume)}</span>
            <span class="wallet-status ${priceData.walletStatus}" title="Wallet Status: ${priceData.walletStatus}"></span>
        </div>
    </td>`;
}

// 创建套利机会单元格
function createArbitrageCell(arbitrageInfo) {
    if (!arbitrageInfo || arbitrageInfo.profit <= 0) {
        return '<td class="arbitrage-cell">-</td>';
    }
    
    const profitPercentage = arbitrageInfo.profitPercentage.toFixed(2);
    let className = 'arbitrage-cell';
    
    if (arbitrageInfo.profitPercentage > 2) {
        className += ' high-opportunity';
    } else if (arbitrageInfo.profitPercentage > 0.5) {
        className += ' opportunity';
    }
    
    return `<td class="${className}">
        <div class="profit">${profitPercentage}%</div>
        <div class="path">${arbitrageInfo.buyExchange} → ${arbitrageInfo.sellExchange}</div>
    </td>`;
}

// 计算单个货币的套利机会
function calculateCryptoArbitrage(crypto) {
    let bestBuy = null;
    let bestSell = null;
    let maxNetProfit = 0;

    exchanges.forEach(buyExchange => {
        const buyData = crypto[buyExchange];
        if (!buyData || buyData.walletStatus !== 'ok') return;

        exchanges.forEach(sellExchange => {
            if (buyExchange === sellExchange) return;

            const sellData = crypto[sellExchange];
            if (!sellData || sellData.walletStatus !== 'ok') return;

            const buyPrice = buyData.ask;
            const sellPrice = sellData.bid;

            // 考虑交易费用
            const actualBuyPrice = buyPrice * (1 + buyData.tradingFee);
            const actualSellPrice = sellPrice * (1 - sellData.tradingFee);
            const netProfit = actualSellPrice - actualBuyPrice;

            if (netProfit > maxNetProfit) {
                maxNetProfit = netProfit;
                bestBuy = buyExchange;
                bestSell = sellExchange;
            }
        });
    });

    if (maxNetProfit > 0 && bestBuy && bestSell) {
        const buyPrice = crypto[bestBuy].ask;
        const sellPrice = crypto[bestSell].bid;
        const grossProfit = sellPrice - buyPrice;
        const profitPercentage = (grossProfit / buyPrice) * 100;

        return {
            profit: grossProfit,
            profitPercentage: profitPercentage,
            buyExchange: exchangeNames[bestBuy],
            sellExchange: exchangeNames[bestSell],
            buyPrice: buyPrice,
            sellPrice: sellPrice,
            netProfit: maxNetProfit
        };
    }

    return null;
}

// 计算所有套利机会
function calculateArbitrageOpportunities() {
    arbitrageOpportunities = [];
    
    cryptoData.forEach(crypto => {
        const arbitrageInfo = calculateCryptoArbitrage(crypto);
        if (arbitrageInfo && arbitrageInfo.profitPercentage > 0.1) { // 只显示利润超过0.1%的机会
            arbitrageOpportunities.push({
                symbol: crypto.symbol,
                name: crypto.name,
                ...arbitrageInfo
            });
        }
    });
    
    // 按利润率排序
    arbitrageOpportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
}

// 创建价格单元格HTML，添加高亮（保留原函数用于兼容）
function createPriceCell(price, maxPrice, minPrice) {
    if (price === null || !isFinite(price)) {
        return '<td>-</td>';
    }
    
    let className = '';
    if (price === maxPrice && maxPrice !== minPrice) {
        className = 'price-high';
    } else if (price === minPrice && maxPrice !== minPrice) {
        className = 'price-low';
    }
    
    return `<td class="${className}">${parseFloat(price).toFixed(6)}</td>`;
}

// 根据搜索框过滤数据
function filterData() {
    updateTable();
}

// 排序数据
function sortData(column) {
    // 如果点击的是当前排序列，则切换排序方向
    if (sortConfig.column === column) {
        sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortConfig.column = column;
        sortConfig.direction = 'asc';
    }
    
    // 更新表头样式
    updateSortIndicators();
    
    // 更新表格
    updateTable();
}

// 根据当前排序配置排序数据
function sortDataByConfig(data) {
    return [...data].sort((a, b) => {
        let valueA, valueB;
        
        if (sortConfig.column === 'name') {
            valueA = a.name;
            valueB = b.name;
        } else if (sortConfig.column === 'spread') {
            // 计算价差
            const pricesA = [
                a.binance, a.okx, a.mexc, a.gate, a.kucoin, a.bitget, a.bybit, a.htx
            ].filter(price => price !== null && isFinite(price));
            const pricesB = [
                b.binance, b.okx, b.mexc, b.gate, b.kucoin, b.bitget, b.bybit, b.htx
            ].filter(price => price !== null && isFinite(price));
            
            valueA = pricesA.length > 0 ? Math.max(...pricesA) - Math.min(...pricesA) : 0;
            valueB = pricesB.length > 0 ? Math.max(...pricesB) - Math.min(...pricesB) : 0;
        } else {
            // 对于交易所价格列
            valueA = a[sortConfig.column] === null || !isFinite(a[sortConfig.column]) ? -Infinity : a[sortConfig.column];
            valueB = b[sortConfig.column] === null || !isFinite(b[sortConfig.column]) ? -Infinity : b[sortConfig.column];
        }
        
        // 比较
        if (valueA < valueB) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (valueA > valueB) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });
}

// 更新排序指示器
function updateSortIndicators() {
    // 移除所有排序类
    document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    
    // 添加当前排序类
    const currentTh = document.querySelector(`th[data-sort="${sortConfig.column}"]`);
    if (currentTh) {
        currentTh.classList.add(`sort-${sortConfig.direction}`);
    }
}

// 显示/隐藏加载指示器
function showLoading(show) {
    document.getElementById('loading-indicator').style.display = show ? 'flex' : 'none';
}

// 显示错误消息
function showError(message) {
    const errorElement = document.getElementById('error-message');
    const errorTextElement = document.getElementById('error-text');
    
    errorTextElement.textContent = message;
    errorElement.style.display = 'flex';
}

// 隐藏错误消息
function hideError() {
    document.getElementById('error-message').style.display = 'none';
}

// 更新最后更新时间
function updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-CN');
    document.getElementById('last-update-time').textContent = timeString;
}

// 获取交易所公告
async function fetchAnnouncements() {
    try {
        // 模拟公告数据（实际应用中需要调用各交易所的API）
        announcements = [
            {
                exchange: 'Binance',
                title: 'Binance将上线新币种XYZ',
                content: 'Binance将于2024年1月15日上线XYZ/USDT交易对',
                date: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2小时前
                type: 'new_listing',
                isNew: true
            },
            {
                exchange: 'OKX',
                title: 'OKX系统维护通知',
                content: 'OKX将于今晚22:00-23:00进行系统维护',
                date: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4小时前
                type: 'maintenance',
                isNew: false
            },
            {
                exchange: 'Gate',
                title: 'Gate新增ABC币种交易',
                content: 'Gate.io新增ABC/USDT交易对，现已开放交易',
                date: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6小时前
                type: 'new_listing',
                isNew: true
            }
        ];
        
        // 检查新上币提醒
        checkNewListingAlerts();
    } catch (error) {
        console.error('获取公告失败:', error);
    }
}

// 检查新上币提醒
function checkNewListingAlerts() {
    const newListings = announcements.filter(ann => ann.type === 'new_listing' && ann.isNew);
    
    if (newListings.length > 0) {
        // 显示新上币提醒
        showNewListingNotification(newListings);
    }
}

// 显示新上币通知
function showNewListingNotification(listings) {
    listings.forEach(listing => {
        if (Notification.permission === 'granted') {
            new Notification(`${listing.exchange} 新上币提醒`, {
                body: listing.title,
                icon: '/favicon.ico'
            });
        } else {
            // 在页面上显示提醒
            const alertDiv = document.createElement('div');
            alertDiv.className = 'new-listing-alert';
            alertDiv.innerHTML = `
                <div class="alert alert-warning">
                    <strong>新上币提醒:</strong> ${listing.exchange} - ${listing.title}
                    <button onclick="this.parentElement.parentElement.remove()" class="close-btn">×</button>
                </div>
            `;
            document.body.insertBefore(alertDiv, document.body.firstChild);
            
            // 5秒后自动消失
            setTimeout(() => {
                if (alertDiv.parentElement) {
                    alertDiv.remove();
                }
            }, 5000);
        }
    });
}

// 获取充值提现信息
async function fetchDepositWithdrawInfo() {
    try {
        // 模拟充提信息数据
        depositWithdrawInfo = {
            'BTC': {
                networks: [
                    { name: 'Bitcoin', symbol: 'BTC', depositFee: 0, withdrawFee: 0.0005, minWithdraw: 0.001 },
                    { name: 'Lightning Network', symbol: 'BTC-Lightning', depositFee: 0, withdrawFee: 0.000001, minWithdraw: 0.00001 }
                ]
            },
            'ETH': {
                networks: [
                    { name: 'Ethereum', symbol: 'ETH', depositFee: 0, withdrawFee: 0.005, minWithdraw: 0.01 },
                    { name: 'Arbitrum', symbol: 'ETH-ARBITRUM', depositFee: 0, withdrawFee: 0.0001, minWithdraw: 0.001 }
                ]
            },
            'USDT': {
                networks: [
                    { name: 'Ethereum (ERC20)', symbol: 'USDT-ERC20', depositFee: 0, withdrawFee: 15, minWithdraw: 20 },
                    { name: 'Tron (TRC20)', symbol: 'USDT-TRC20', depositFee: 0, withdrawFee: 1, minWithdraw: 10 },
                    { name: 'BSC (BEP20)', symbol: 'USDT-BEP20', depositFee: 0, withdrawFee: 0.8, minWithdraw: 10 }
                ]
            }
        };
    } catch (error) {
        console.error('获取充提信息失败:', error);
    }
}

// 更新套利面板
function updateArbitragePanel() {
    const container = document.getElementById('arbitrage-opportunities');
    
    if (arbitrageOpportunities.length === 0) {
        container.innerHTML = '<p>暂无值得关注的套利机会。</p>';
        return;
    }
    
    // 只显示前5个最佳机会
    const topOpportunities = arbitrageOpportunities.slice(0, 5);

    const html = topOpportunities.map(opp => {
        const profitClass = opp.profitPercentage > 2 ? 'profit-high' : 
                           opp.profitPercentage > 1 ? 'profit-medium' : 'profit-low';
        
        // 假设买卖费用都是0.1%
        const buyFee = opp.buyPrice * 0.001;
        const sellFee = opp.sellPrice * 0.001;
        const netProfit = opp.profit - buyFee - sellFee;
        const netProfitPercentage = (netProfit / opp.buyPrice) * 100;

        return `
            <div class="arbitrage-opportunity-card ${opp.profitPercentage > 2 ? 'high-profit' : ''}">
                <h4>${opp.name} (${opp.symbol})</h4>
                <div class="arbitrage-profit ${profitClass}">
                    +${opp.profitPercentage.toFixed(2)}%
                </div>
                <div class="arbitrage-details">
                    <div><strong>路径:</strong> ${opp.buyExchange} → ${opp.sellExchange}</div>
                    <div><strong>买入价:</strong> $${opp.buyPrice.toFixed(4)}</div>
                    <div><strong>卖出价:</strong> $${opp.sellPrice.toFixed(4)}</div>
                    <hr style="margin: 0.5rem 0;">
                    <div><strong>预估净利润率:</strong> <span class="${netProfitPercentage > 0 ? 'profit-low' : 'profit-high'}">${netProfitPercentage.toFixed(2)}%</span> (已考虑0.1%手续费)</div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

// 更新公告面板
function updateAnnouncementsPanel() {
    const container = document.getElementById('announcements-list');
    
    if (announcements.length === 0) {
        container.innerHTML = '<p>暂无公告信息</p>';
        return;
    }
    
    const html = announcements.map(ann => {
        return `
            <div class="announcement-item ${ann.type === 'new_listing' ? 'new-listing' : ''}">
                <div class="d-flex justify-content-between">
                    <strong>${ann.exchange}</strong>
                    <span class="announcement-date">${ann.date.toLocaleString('zh-CN')}</span>
                </div>
                <h5>${ann.title}</h5>
                <p>${ann.content}</p>
                ${ann.isNew ? '<span class="badge badge-warning">新</span>' : ''}
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

// 更新充提信息面板
function updateDepositWithdrawPanel() {
    const container = document.getElementById('deposit-withdraw-info');
    
    if (Object.keys(depositWithdrawInfo).length === 0) {
        container.innerHTML = '<p>暂无充提信息</p>';
        return;
    }
    
    const html = Object.entries(depositWithdrawInfo).map(([symbol, info]) => {
        const networksHtml = info.networks.map(network => {
            return `
                <div class="network-info">
                    <span><strong>${network.name}</strong></span>
                    <span>提现费: ${network.withdrawFee} ${symbol}</span>
                </div>
                <div class="fee-info">
                    充值费: ${network.depositFee} ${symbol} | 
                    最小提现: ${network.minWithdraw} ${symbol}
                </div>
            `;
        }).join('');
        
        return `
            <div class="deposit-withdraw-item">
                <h5>${symbol}</h5>
                ${networksHtml}
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

// 生成具有真实结构的模拟数据（占位符）
function getMockDataWithRealStructure() {
    const symbols = ['BTC', 'ETH', 'SOL', 'DOGE', 'LINK'];
    const mockData = symbols.map(symbol => {
        let basePrice;
        // Assign more realistic base prices
        switch (symbol) {
            case 'BTC': basePrice = 67000 + (Math.random() - 0.5) * 2000; break;
            case 'ETH': basePrice = 3500 + (Math.random() - 0.5) * 200; break;
            case 'SOL': basePrice = 150 + (Math.random() - 0.5) * 20; break;
            case 'DOGE': basePrice = 0.15 + (Math.random() - 0.5) * 0.05; break;
            case 'LINK': basePrice = 18 + (Math.random() - 0.5) * 2; break;
            default: basePrice = Math.random() * 1000;
        }

        const cryptoItem = {
            name: `${symbol}/USDT`,
            symbol: symbol,
            market_cap: Math.random() * 1e12,
            volume_24h: Math.random() * 1e10,
        };

        exchanges.forEach(exchange => {
            // More realistic, smaller variations
            const priceVariation = (Math.random() - 0.5) * basePrice * 0.01; // Max 0.5% variation from base
            const midPrice = basePrice + priceVariation;
            // Spread based on price
            const spread = midPrice * 0.0005 * (Math.random() + 0.5); // 0.025% to 0.075% spread

            cryptoItem[exchange] = {
                bid: midPrice - spread / 2,
                ask: midPrice + spread / 2,
                mid: midPrice,
                volume: Math.random() * 1e8, // 24h volume on this exchange
                walletStatus: ['ok', 'ok', 'ok', 'maintenance'][Math.floor(Math.random() * 4)], // 'ok' or 'maintenance'
                tradingFee: 0.001 + Math.random() * 0.001 // 0.1% to 0.2%
            };
        });
        return cryptoItem;
    });
    return mockData;
}

// 实际API调用示例（注释掉，因为需要后端支持）
/*
async function fetchBinancePrice(symbol) {
    try {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
        const data = await response.json();
        return parseFloat(data.price);
    } catch (error) {
        console.error('Binance API error:', error);
        return null;
    }
}

async function fetchOkxPrice(symbol) {
    try {
        const response = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${symbol}`);
        const data = await response.json();
        return parseFloat(data.data[0].last);
    } catch (error) {
        console.error('OKX API error:', error);
        return null;
    }
}

// 其他交易所的API调用函数...
*/

// 注意：在实际应用中，应该使用后端服务来聚合各交易所的数据
// 这样可以避免跨域问题，并且可以隐藏API密钥等敏感信息
// 前端只需要调用自己的后端API即可