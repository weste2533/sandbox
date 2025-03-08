/**
 * Fund Data Fetcher Module
 * filename = fund-data-fetcher.js
 * Fetches historical NAV (Net Asset Value) data from Yahoo Finance via CORS proxies
 * 
 * USAGE:
 * 
 * Basic Function Call:
 * fetchFundData(ticker, startDate, [endDate])
 *   .then(data => { /* handle data *\/ })
 *   .catch(error => { /* handle errors *\/ });
 * 
 * PARAMETERS:
 * @param {string} ticker - Mutual fund ticker symbol (case-sensitive)
 *     Examples: 'ANCFX' (American Funds), 'AGTHX' (Growth Fund of America)
 * 
 * @param {string|Date} startDate - Start date for historical data
 *     - String format: 'YYYY-MM-DD' (e.g., '2024-01-01')
 *     - Date object: JavaScript Date instance
 * 
 * @param {string|Date} [endDate] - Optional end date (default: current date)
 *     - Same format as startDate
 *     - Omit for data up to current date
 * 
 * RETURNS:
 * @returns {Promise<Array<NavDataPoint>>} - Promise resolving to array of:
 *     [
 *       {
 *         date: string, // ISO date string ('YYYY-MM-DD')
 *         nav: number   // NAV value (USD)
 *       },
 *       ...
 *     ]
 * 
 *     Empty array returned if no data available for date range
 * 
 * DATA STRUCTURE DETAILS:
 * - Output array is sorted in chronological order (oldest first)
 * - Missing NAV values will be `null` in the nav property
 * - Weekend/holiday dates excluded (only trading days returned)
 * 
 * ERROR HANDLING:
 * - Throws errors for:
 *   - Invalid tickers
 *   - Network failures
 *   - Invalid date formats
 *   - Empty API responses
 * - Always wrap calls in try/catch or .catch()
 * 
 * CORS PROXIES:
 * - Automatically cycles through multiple proxies:
 *   1. api.allorigins.win
 *   2. corsproxy.io
 *   3. thingproxy.freeboard.io
 *   4. cors-anywhere.herokuapp.com
 * - First working proxy is used for request
 * 
 * EXAMPLE USAGE:
 * 
 * // Get data for ANCFX from Jan 1 2024 to now
 * fetchFundData('ANCFX', '2024-01-01')
 *   .then(data => console.log('ANCFX Data:', data))
 *   .catch(console.error);
 * 
 * // Get data for AGTHX for specific date range
 * const start = new Date('2023-06-01');
 * const end = '2023-12-31';
 * fetchFundData('AGTHX', start, end)
 *   .then(data => {
 *     console.log(`Found ${data.length} data points`);
 *     console.log('First entry:', data[0]);
 *   });
 * 
 * // Using async/await
 * async function getFundData() {
 *   try {
 *     const data = await fetchFundData('ANCFX', '2024-01-01');
 *     // Process data
 *   } catch(error) {
 *     console.error('Fetch failed:', error);
 *   }
 * }
 * 
 * DEBUGGING:
 * - All network requests logged to console
 * - Raw API response structure visible in console
 * - Data processing steps logged (filter with 'fund-data-fetcher' in console)
 * 
 * NOTES:
 * - Data delayed by at least 15 minutes (Yahoo Finance limitation)
 * - NAV values reflect end-of-day pricing
 * - Not all tickers supported (depends on Yahoo Finance availability)
 */

// List of CORS proxies to try (will attempt each in order until success)
const PROXIES = [
    "https://api.allorigins.win/get?url=",
    "https://corsproxy.io/?", 
    "https://thingproxy.freeboard.io/fetch/",
    "https://cors-anywhere.herokuapp.com/"
];

async function fetchFundData(ticker, startDate, endDate = null) {
    // Convert date parameters to Date objects if they're strings
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate ? (endDate instanceof Date ? endDate : new Date(endDate)) : new Date();
    
    // Convert to Unix timestamps (seconds)
    const period1 = Math.floor(start.getTime() / 1000);
    const period2 = Math.floor(end.getTime() / 1000);
    
    // Yahoo Finance API URL
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${period1}&period2=${period2}&interval=1d`;
    
    try {
        console.log(`Starting fetch for ${ticker} from ${start.toISOString()} to ${end.toISOString()}`);
        const data = await fetchWithProxy(url);
        
        // Log raw response structure
        console.log(`RAW YAHOO RESPONSE FOR ${ticker}:`, JSON.parse(JSON.stringify(data)));
        
        if (!data || !data.chart || !data.chart.result || data.chart.result.length === 0) {
            throw new Error('Invalid or empty response from Yahoo Finance');
        }
        
        const result = data.chart.result[0];
        // Log chart result structure
        console.log(`CHART RESULT STRUCTURE FOR ${ticker}:`, {
            meta: result.meta,
            timestamp: result.timestamp?.length,
            indicators: Object.keys(result.indicators?.quote?.[0] || {})
        });
        
        const timestamps = result.timestamp || [];
        const prices = result.indicators?.quote?.[0]?.close || [];
        
        // Create processed data array
        const processedData = timestamps.map((timestamp, index) => {
            const date = new Date(timestamp * 1000);
            return {
                date: formatDate(date),
                nav: prices[index]
            };
        });

        // Log final processed data structure
        console.log(`PROCESSED DATA FOR ${ticker}:`, {
            dataPoints: processedData.length,
            firstEntry: processedData[0],
            lastEntry: processedData[processedData.length - 1]
        });
        
        return processedData;
    } catch (error) {
        console.error(`ERROR STRUCTURE FOR ${ticker}:`, {
            name: error.name,
            message: error.message,
            stack: error.stack?.split('\n')[0]
        });
        throw new Error(`Failed to fetch data for ${ticker}: ${error.message}`);
    }
}

async function fetchWithProxy(url) {
    for (let proxyIndex = 0; proxyIndex < PROXIES.length; proxyIndex++) {
        const proxyUrl = PROXIES[proxyIndex] + encodeURIComponent(url);
        console.log(`Attempting proxy #${proxyIndex + 1}: ${PROXIES[proxyIndex]}`);
        
        try {
            const response = await fetch(proxyUrl, { cache: 'no-cache' });
            console.log(`Proxy #${proxyIndex + 1} response status: ${response.status}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }
            
            const text = await response.text();
            console.log(`Proxy #${proxyIndex + 1} response length: ${text.length} chars`);
            
            if (proxyUrl.includes('allorigins.win')) {
                const jsonResponse = JSON.parse(text);
                if (jsonResponse.contents) {
                    return JSON.parse(jsonResponse.contents);
                }
            }
            
            return JSON.parse(text);
        } catch (error) {
            console.warn(`Proxy #${proxyIndex + 1} failed: ${error.message}`);
            continue;
        }
    }
    
    throw new Error('All proxies failed to fetch data');
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// Export the main function
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { fetchFundData };
}
