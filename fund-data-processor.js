/**
 * Fund Data Service
 * 
 * This module provides a unified interface for retrieving fund data including:
 * - NAV values from Yahoo Finance (for mutual funds)
 * - Distribution data from local text files
 * 
 * MAIN FUNCTION:
 * getFundDataByDate(ticker, startDate)
 *   - ticker: Fund ticker symbol (e.g., "ANCFX")
 *   - startDate: Date string in format "MM/DD/YYYY"
 *   
 *   Returns: Promise resolving to an object with daily fund data:
 *   {
 *     [date]: {
 *       date: "MM/DD/YYYY",         // Date string
 *       NAV: Number,                // NAV value (1.00 for MMF funds)
 *       distributions: Number,      // Total distributions for the date
 *       distributionDetails: {...}  // Additional distribution details if available
 *     },
 *     ...
 *   }
 */

/**
 * Configuration
 */
// Known MMF tickers (expand as needed)
const MMF_TICKERS = new Set(['AFAXX']);

// File paths configuration
const BASE_PATH = '.'; // Update this if files are in a subfolder

/**
 * Determines if a ticker represents a money market fund
 * @param {string} ticker - Fund ticker symbol
 * @returns {boolean} - True if ticker is for a money market fund
 */
function isMoneyMarketFund(ticker) {
  return MMF_TICKERS.has(ticker.toUpperCase());
}

/**
 * Gets the appropriate filename for a fund's distribution data
 * @param {string} ticker - Fund ticker symbol
 * @returns {string} - Path to the distribution file
 */
function getDistributionFileName(ticker) {
  const typePrefix = isMoneyMarketFund(ticker) ? 'mmf' : 'mutual';
  return `${BASE_PATH}/${typePrefix}_${ticker.toUpperCase()}_distributions.txt`;
}

/**
 * Parse a date string to ensure consistent format
 * @param {string} dateStr - Date string in various formats
 * @returns {string} - Date in MM/DD/YYYY format
 */
function parseDate(dateStr) {
  // Handle formats like MM/DD/YYYY, MM/DD/YY, or MM/DD/20YY
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts[2].length === 2) {
      parts[2] = '20' + parts[2]; // Assume 20xx for two-digit years
    }
    return parts.join('/');
  }
  
  // Handle format like MM-DD-YYYY
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    return `${parts[0]}/${parts[1]}/${parts[2]}`;
  }
  
  // For any other formats, return as is
  return dateStr;
}

/**
 * Converts date string to JavaScript Date object
 * @param {string} dateStr - Date string in MM/DD/YYYY format
 * @returns {Date} - JavaScript Date object
 */
function toDateObject(dateStr) {
  const parts = dateStr.split('/');
  return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
}

/**
 * Compares two date strings
 * @param {string} dateA - First date in MM/DD/YYYY format
 * @param {string} dateB - Second date in MM/DD/YYYY format
 * @returns {number} - Negative if dateA < dateB, 0 if equal, positive if dateA > dateB
 */
function compareDates(dateA, dateB) {
  return toDateObject(dateA) - toDateObject(dateB);
}

/**
 * Formats a JavaScript Date object to MM/DD/YYYY string
 * @param {Date} date - JavaScript Date object
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Converts Yahoo Finance date format (YYYY-MM-DD) to MM/DD/YYYY
 * @param {string} yahooDate - Date in YYYY-MM-DD format
 * @returns {string} - Date in MM/DD/YYYY format
 */
function convertYahooDateFormat(yahooDate) {
  const parts = yahooDate.split('-');
  return `${parts[1]}/${parts[2]}/${parts[0]}`;
}

/**
 * Converts MM/DD/YYYY to Yahoo Finance date format (YYYY-MM-DD)
 * @param {string} dateStr - Date in MM/DD/YYYY format
 * @returns {string} - Date in YYYY-MM-DD format
 */
function toYahooDateFormat(dateStr) {
  const parts = dateStr.split('/');
  return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
}

/**
 * Processes mutual fund distribution data from text content
 * @param {string} fileContent - Content of the mutual fund distribution file
 * @returns {Object} - Processed distribution data
 */
function processMutualFundDistributions(fileContent) {
  const distributions = {};
  const lines = fileContent.split('\n').filter(line => line.trim());
  
  // Skip header
  if (lines.length > 1) {
    const dataLines = lines.slice(1);
    
    dataLines.forEach(line => {
      const parts = line.trim().split('\t');
      if (parts.length >= 8) {
        const recordDate = parseDate(parts[0]);
        
        // Parse all distribution values
        const regularDividend = parseFloat(parts[3].replace('$', '') || 0);
        const specialDividend = parseFloat(parts[4].replace('$', '') || 0);
        const longTermGains = parseFloat(parts[5].replace('$', '') || 0);
        const shortTermGains = parseFloat(parts[6].replace('$', '') || 0);
        const reinvestNAV = parseFloat(parts[7].replace('$', '') || 0);
        
        // Calculate total distributions
        const totalDistributions = regularDividend + specialDividend + 
                                  longTermGains + shortTermGains;
        
        // Store distribution data
        distributions[recordDate] = {
          date: recordDate,
          NAV: reinvestNAV,
          distributions: totalDistributions,
          distributionDetails: {
            regularDividend,
            specialDividend,
            longTermGains,
            shortTermGains
          }
        };
      }
    });
  }
  
  return distributions;
}

/**
 * Processes money market fund (MMF) distribution data from text content
 * @param {string} fileContent - Content of the MMF distribution file
 * @returns {Object} - Processed distribution data
 */
function processMMFDistributions(fileContent) {
  const distributions = {};
  const lines = fileContent.split('\n').filter(line => line.trim());
  
  // Skip header
  if (lines.length > 1) {
    const dataLines = lines.slice(1);
    
    dataLines.forEach(line => {
      const parts = line.trim().split('\t');
      if (parts.length >= 2) {
        const rate = parseFloat(parts[0]) || 0;
        const date = parseDate(parts[1]);
        
        // For MMF funds, NAV is fixed at 1.00 and distribution is the daily rate
        distributions[date] = {
          date,
          NAV: 1.00,
          distributions: rate,
          distributionDetails: {
            dailyRate: rate
          }
        };
      }
    });
  }
  
  return distributions;
}

/**
 * Loads and processes distribution data for a specific fund
 * @param {string} ticker - Fund ticker symbol
 * @returns {Promise<Object>} - Promise resolving to fund distribution data
 */
async function loadDistributionData(ticker) {
  ticker = ticker.toUpperCase();
  
  try {
    const fileName = getDistributionFileName(ticker);
    const response = await fetch(fileName);
    
    if (!response.ok) {
      console.warn(`No distribution file found for ${ticker}`);
      return {};
    }
    
    const fileContent = await response.text();
    
    // Process based on fund type
    if (isMoneyMarketFund(ticker)) {
      return processMMFDistributions(fileContent);
    } else {
      return processMutualFundDistributions(fileContent);
    }
  } catch (error) {
    console.error(`Error loading distribution data for ${ticker}:`, error);
    return {};
  }
}

/**
 * Fetches NAV data from Yahoo Finance via proxy
 * @param {string} ticker - Fund ticker symbol
 * @param {string} startDate - Start date in MM/DD/YYYY format
 * @param {string} endDate - End date in MM/DD/YYYY format (optional, defaults to current date)
 * @returns {Promise<Object>} - Promise resolving to NAV history data
 */
async function fetchYahooFinanceData(ticker, startDate, endDate = formatDate(new Date())) {
  ticker = ticker.toUpperCase();
  
  // Convert dates to Yahoo Finance format (YYYY-MM-DD)
  const yahooStartDate = toYahooDateFormat(startDate);
  const yahooEndDate = toYahooDateFormat(endDate);
  
  try {
    // This uses the proxy setup from the provided code
    const proxyUrl = `/api/proxy?ticker=${ticker}&startDate=${yahooStartDate}&endDate=${yahooEndDate}`;
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Yahoo Finance data: ${response.statusText}`);
    }
    
    const yahooData = await response.json();
    const navData = {};
    
    // Process Yahoo Finance data into our format
    if (yahooData && yahooData.chart && yahooData.chart.result && yahooData.chart.result.length > 0) {
      const result = yahooData.chart.result[0];
      const timestamps = result.timestamp;
      const quotes = result.indicators.quote[0];
      const adjClose = result.indicators.adjclose[0].adjclose;
      
      for (let i = 0; i < timestamps.length; i++) {
        const date = new Date(timestamps[i] * 1000);
        const dateStr = formatDate(date);
        
        navData[dateStr] = {
          date: dateStr,
          NAV: adjClose[i],
          distributions: 0, // Default to 0, will be updated if distribution data exists
          distributionDetails: {}
        };
      }
    }
    
    return navData;
  } catch (error) {
    console.error(`Error fetching Yahoo Finance data for ${ticker}:`, error);
    return {};
  }
}

/**
 * Merges NAV and distribution data into a unified structure
 * @param {Object} navData - NAV history data
 * @param {Object} distributionData - Distribution data
 * @returns {Object} - Merged data with consistent structure
 */
function mergeData(navData, distributionData) {
  const mergedData = { ...navData };
  
  // Add distribution data where available
  for (const date in distributionData) {
    if (mergedData[date]) {
      // Update existing entry with distribution data
      mergedData[date].distributions = distributionData[date].distributions;
      mergedData[date].distributionDetails = distributionData[date].distributionDetails;
    } else {
      // Add distribution entry if no NAV data for that date
      mergedData[date] = distributionData[date];
    }
  }
  
  return mergedData;
}

/**
 * Main function to retrieve fund data starting from a specific date
 * @param {string} ticker - Fund ticker symbol
 * @param {string} startDate - Start date in MM/DD/YYYY format
 * @returns {Promise<Object>} - Promise resolving to fund data from the start date
 */
async function getFundDataByDate(ticker, startDate) {
  ticker = ticker.toUpperCase();
  
  try {
    // Step 1: Load distribution data
    const distributionData = await loadDistributionData(ticker);
    
    // Step 2: For mutual funds, get NAV data from Yahoo Finance
    let navData = {};
    if (!isMoneyMarketFund(ticker)) {
      navData = await fetchYahooFinanceData(ticker, startDate);
    }
    
    // Step 3: Merge NAV and distribution data
    let mergedData = isMoneyMarketFund(ticker) ? distributionData : mergeData(navData, distributionData);
    
    // Step 4: Filter results to only include dates on or after the start date
    const filteredData = {};
    for (const date in mergedData) {
      if (compareDates(date, startDate) >= 0) {
        filteredData[date] = mergedData[date];
      }
    }
    
    return {
      ticker,
      type: isMoneyMarketFund(ticker) ? 'MMF' : 'Mutual Fund',
      data: filteredData
    };
  } catch (error) {
    console.error(`Error retrieving fund data for ${ticker}:`, error);
    return {
      ticker,
      type: isMoneyMarketFund(ticker) ? 'MMF' : 'Mutual Fund',
      data: {},
      error: error.message
    };
  }
}

/**
 * Get list of all available fund tickers
 * @returns {Promise<Array>} - Promise resolving to array of available tickers
 */
async function getAllFundTickers() {
  // In a real implementation, this might scan the directory or use a config file
  // For now, we'll return the known funds
  return ['ANCFX', 'AGTHX', 'AFAXX'];
}

// Export functions for browser environment
if (typeof window !== 'undefined') {
  window.fundDataService = {
    getFundDataByDate,
    getAllFundTickers,
    isMoneyMarketFund
  };
}

// Export for module environments
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = {
    getFundDataByDate,
    getAllFundTickers,
    isMoneyMarketFund
  };
}
