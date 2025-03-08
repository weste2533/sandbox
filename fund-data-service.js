/**
 * Fund Data Service
 * 
 * A comprehensive module for retrieving and processing mutual fund and money market fund (MMF) data.
 * This service combines distribution data from local text files with NAV data from Yahoo Finance.
 * 
 * MAIN FUNCTION:
 * getFundDataByDate(ticker, date) - Retrieves all available fund data from the specified date forward
 * 
 * @author Created on March 7, 2025
 */

/**
 * Configuration Settings
 */
const CONFIG = {
  // Known Money Market Fund tickers - expand as needed
  MMF_TICKERS: new Set(['AFAXX']),
  
  // Base path for distribution files (relative to HTML file)
  BASE_PATH: '.',
  
  // Yahoo Finance proxy endpoint (required for fetching NAV data)
  YAHOO_PROXY_URL: '/api/proxy',
  
  // Default NAV for money market funds (typically fixed at $1.00)
  DEFAULT_MMF_NAV: 1.00
};

/**
 * Determines if a ticker represents a money market fund
 * @param {string} ticker - Fund ticker symbol
 * @returns {boolean} - True if ticker is for a money market fund
 */
function isMoneyMarketFund(ticker) {
  return CONFIG.MMF_TICKERS.has(ticker.toUpperCase());
}

/**
 * Gets the appropriate filename for a fund's distribution data
 * @param {string} ticker - Fund ticker symbol
 * @returns {string} - Path to the distribution file
 */
function getDistributionFileName(ticker) {
  ticker = ticker.toUpperCase();
  const typePrefix = isMoneyMarketFund(ticker) ? 'mmf' : 'mutual';
  return `${CONFIG.BASE_PATH}/${typePrefix}_${ticker}_distributions.txt`;
}

/**
 * Normalize a date string to ensure consistent MM/DD/YYYY format
 * @param {string} dateStr - Date string in various formats
 * @returns {string} - Normalized date in MM/DD/YYYY format
 */
function normalizeDate(dateStr) {
  // Handle formats like MM/DD/YYYY, MM/DD/YY, or MM-DD-YYYY
  if (dateStr.includes('/') || dateStr.includes('-')) {
    const separator = dateStr.includes('/') ? '/' : '-';
    const parts = dateStr.split(separator);
    
    // Handle two-digit years
    if (parts[2] && parts[2].length === 2) {
      parts[2] = '20' + parts[2]; // Assume 20xx for two-digit years
    }
    
    // Return normalized format with / separator
    return `${parts[0]}/${parts[1]}/${parts[2]}`;
  }
  
  // If the format is unrecognized, return as-is
  return dateStr;
}

/**
 * Convert a date string to a JavaScript Date object
 * @param {string} dateStr - Date string in MM/DD/YYYY format
 * @returns {Date} - JavaScript Date object
 */
function parseToDate(dateStr) {
  const normalized = normalizeDate(dateStr);
  const [month, day, year] = normalized.split('/');
  return new Date(year, month - 1, day); // Month is 0-indexed in JS Date
}

/**
 * Check if a date is greater than or equal to another date
 * @param {string} dateA - First date in MM/DD/YYYY format
 * @param {string} dateB - Second date in MM/DD/YYYY format
 * @returns {boolean} - True if dateA >= dateB
 */
function isDateOnOrAfter(dateA, dateB) {
  const dateObjA = parseToDate(dateA);
  const dateObjB = parseToDate(dateB);
  return dateObjA >= dateObjB;
}

/**
 * Convert a Date object to MM/DD/YYYY string format
 * @param {Date} date - JavaScript Date object
 * @returns {string} - Date string in MM/DD/YYYY format
 */
function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Processes mutual fund distribution data from text content
 * @param {string} fileContent - Content of the mutual fund distribution file
 * @returns {Object} - Processed distribution data keyed by date
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
        const recordDate = normalizeDate(parts[0]);
        
        // Parse all distribution values
        const regularDividend = parseFloat(parts[3].replace('$', '')) || 0;
        const specialDividend = parseFloat(parts[4].replace('$', '')) || 0;
        const longTermGains = parseFloat(parts[5].replace('$', '')) || 0;
        const shortTermGains = parseFloat(parts[6].replace('$', '')) || 0;
        const reinvestNAV = parseFloat(parts[7].replace('$', '')) || 0;
        
        // Calculate total distributions
        const totalDistributions = regularDividend + specialDividend + 
                                  longTermGains + shortTermGains;
        
        // Store distribution data
        distributions[recordDate] = {
          date: recordDate,
          NAV: reinvestNAV,
          distributions: totalDistributions,
          // Additional data for reference
          detail: {
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
 * @returns {Object} - Processed distribution data keyed by date
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
        const date = normalizeDate(parts[1]);
        
        // For MMF funds, NAV is fixed at 1.00 and distribution is the daily rate
        distributions[date] = {
          date,
          NAV: CONFIG.DEFAULT_MMF_NAV,
          distributions: rate,
          // Additional data for reference
          detail: {
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
 * Fetches NAV data from Yahoo Finance (requires proxy server)
 * @param {string} ticker - Fund ticker symbol
 * @param {string} startDate - Start date in MM/DD/YYYY format
 * @returns {Promise<Object>} - Promise resolving to NAV history data
 */
async function fetchYahooFinanceData(ticker, startDate) {
  ticker = ticker.toUpperCase();
  
  try {
    // Convert date format for Yahoo API (YYYY-MM-DD)
    const dateObj = parseToDate(startDate);
    const formattedStartDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    
    // Get current date for end date
    const today = new Date();
    const formattedEndDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // Build the proxy URL with params
    const proxyUrl = `${CONFIG.YAHOO_PROXY_URL}?ticker=${ticker}&startDate=${formattedStartDate}&endDate=${formattedEndDate}`;
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Yahoo Finance data: ${response.statusText}`);
    }
    
    const yahooData = await response.json();
    
    // Process Yahoo data into our desired format
    const navData = {};
    
    // Yahoo data typically includes an array of price history
    if (yahooData.prices && Array.isArray(yahooData.prices)) {
      yahooData.prices.forEach(pricePoint => {
        if (pricePoint.close) {
          // Convert timestamp to date
          const priceDate = new Date(pricePoint.date * 1000);
          const dateKey = formatDate(priceDate);
          
          navData[dateKey] = {
            date: dateKey,
            NAV: pricePoint.close,
            distributions: 0, // Default to 0, will be updated if distribution data exists
            detail: {
              open: pricePoint.open,
              high: pricePoint.high,
              low: pricePoint.low,
              volume: pricePoint.volume
            }
          };
        }
      });
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
  // Start with a copy of the NAV data
  const mergedData = { ...navData };
  
  // Add distribution data where available
  for (const date in distributionData) {
    if (mergedData[date]) {
      // Update existing entry with distribution data
      mergedData[date].distributions = distributionData[date].distributions;
      
      if (distributionData[date].detail) {
        mergedData[date].detail = {
          ...mergedData[date].detail,
          ...distributionData[date].detail
        };
      }
    } else {
      // Add distribution entry if no NAV data exists for this date
      mergedData[date] = distributionData[date];
    }
  }
  
  return mergedData;
}

/**
 * Filters the combined data to include only records on or after the specified date
 * @param {Object} allData - Combined NAV and distribution data
 * @param {string} startDate - Start date in MM/DD/YYYY format
 * @returns {Object} - Filtered data
 */
function filterDataByDate(allData, startDate) {
  const filteredData = {};
  
  for (const date in allData) {
    if (isDateOnOrAfter(date, startDate)) {
      filteredData[date] = allData[date];
    }
  }
  
  return filteredData;
}

/**
 * Main function: Retrieves all fund data from a specific date forward
 * @param {string} ticker - Fund ticker symbol
 * @param {string} startDate - Starting date in MM/DD/YYYY format
 * @returns {Promise<Object>} - Promise resolving to complete fund data with NAVs and distributions
 */
async function getFundDataByDate(ticker, startDate) {
  ticker = ticker.toUpperCase();
  startDate = normalizeDate(startDate);
  
  try {
    // Step 1: Load distribution data
    const distributionData = await loadDistributionData(ticker);
    
    let navData = {};
    
    // Step 2: If this is a mutual fund, get NAV data from Yahoo Finance
    if (!isMoneyMarketFund(ticker)) {
      navData = await fetchYahooFinanceData(ticker, startDate);
    }
    
    // Step 3: Merge NAV and distribution data
    const combinedData = mergeData(navData, distributionData);
    
    // Step 4: Filter to include only data on or after the start date
    const filteredData = filterDataByDate(combinedData, startDate);
    
    // Return the structured result
    return {
      ticker,
      type: isMoneyMarketFund(ticker) ? 'MMF' : 'Mutual Fund',
      startDate,
      data: filteredData
    };
  } catch (error) {
    console.error(`Error retrieving fund data for ${ticker}:`, error);
    return {
      ticker,
      type: isMoneyMarketFund(ticker) ? 'MMF' : 'Mutual Fund',
      startDate,
      data: {},
      error: error.message
    };
  }
}

/**
 * Get list of all available fund tickers from the provided distribution files
 * Note: This is a helper function that would need to be implemented based on your actual file system
 * @returns {Promise<Array>} - Promise resolving to array of available tickers
 */
async function getAllFundTickers() {
  // In a real implementation, this might scan the directory or use a config file
  // For now, we'll return the known funds from your example
  return ['ANCFX', 'AGTHX', 'AFAXX'];
}

/**
 * Example usage:
 * 
 * // Get fund data for ANCFX from January 1, 2024
 * getFundDataByDate('ANCFX', '01/01/2024').then(result => {
 *   console.log(result);
 * });
 * 
 * // Get fund data for a money market fund
 * getFundDataByDate('AFAXX', '02/15/2024').then(result => {
 *   console.log(result);
 * });
 */

// Export functions for browser environment
if (typeof window !== 'undefined') {
  window.fundDataService = {
    getFundDataByDate,
    getAllFundTickers,
    isMoneyMarketFund
  };
}

// Export for module environments (Node.js)
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = {
    getFundDataByDate,
    getAllFundTickers,
    isMoneyMarketFund
  };
}
