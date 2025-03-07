/**
 * Fund Data Processor
 * 
 * This module processes both mutual fund and money market fund (MMF) data
 * from text files, providing a unified data structure for NAV values and distributions.
 * 
 * External callable functions:
 * - getFundData(ticker): Main function to retrieve complete fund data by ticker
 * - getDistributionsByDate(date): Get all fund distributions for a specific date
 * - getAllFundTickers(): Get list of all available fund tickers
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
  
  // Handle format like MM/DD/YY
  if (dateStr.length === 8 && dateStr.includes('/')) {
    return dateStr.substring(0, 6) + '20' + dateStr.substring(6);
  }
  
  // Handle format like MM/DD/YYYY with potential leading zeros
  if (dateStr.length === 10 && dateStr.includes('/')) {
    return dateStr;
  }
  
  // Handle format like MM/DD/YYYY with potential dashes
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    return `${parts[0]}/${parts[1]}/${parts[2]}`;
  }
  
  // For MMF format (MM/DD/YYYY)
  return dateStr;
}

/**
 * Processes mutual fund distribution data from text content
 * @param {string} fileContent - Content of the mutual fund distribution file
 * @param {string} ticker - Fund ticker symbol
 * @returns {Object} - Processed distribution data
 */
function processMutualFundDistributions(fileContent, ticker) {
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
          total_distributions: totalDistributions,
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
 * @param {string} ticker - Fund ticker symbol
 * @returns {Object} - Processed distribution data
 */
function processMMFDistributions(fileContent, ticker) {
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
          total_distributions: rate,
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
      return processMMFDistributions(fileContent, ticker);
    } else {
      return processMutualFundDistributions(fileContent, ticker);
    }
  } catch (error) {
    console.error(`Error loading distribution data for ${ticker}:`, error);
    return {};
  }
}

/**
 * Main function to retrieve complete fund data by ticker
 * @param {string} ticker - Fund ticker symbol
 * @returns {Promise<Object>} - Promise resolving to complete fund data with NAVs and distributions
 */
async function getFundData(ticker) {
  ticker = ticker.toUpperCase();
  
  try {
    // Step 1: Load distribution data
    const distributionData = await loadDistributionData(ticker);
    
    // Step 2: For mutual funds, we may need to get additional NAV data from Yahoo Finance
    // This is implemented in the full version with the proxy setup
    
    // Return the consolidated data
    return {
      ticker,
      type: isMoneyMarketFund(ticker) ? 'MMF' : 'Mutual Fund',
      distributions: distributionData
    };
  } catch (error) {
    console.error(`Error retrieving fund data for ${ticker}:`, error);
    return {
      ticker,
      type: isMoneyMarketFund(ticker) ? 'MMF' : 'Mutual Fund',
      distributions: {},
      error: error.message
    };
  }
}

/**
 * Get all fund distributions for a specific date
 * @param {string} date - Date in MM/DD/YYYY format
 * @returns {Promise<Object>} - Promise resolving to all fund distributions for that date
 */
async function getDistributionsByDate(date) {
  // This would require maintaining a list of all available funds
  // For demonstration, we'll use a simple implementation
  const knownFunds = await getAllFundTickers();
  const result = {};
  
  for (const ticker of knownFunds) {
    const fundData = await getFundData(ticker);
    if (fundData.distributions && fundData.distributions[date]) {
      result[ticker] = fundData.distributions[date];
    }
  }
  
  return result;
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

/**
 * Extended version with Yahoo Finance integration
 * This would require a proxy or backend service to avoid CORS issues
 */

/**
 * Fetches NAV data from Yahoo Finance (requires backend proxy)
 * @param {string} ticker - Fund ticker symbol
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Object>} - Promise resolving to NAV history data
 */
async function fetchYahooFinanceData(ticker, startDate, endDate) {
  // This would require a proxy setup to avoid CORS issues
  // Implementation would depend on your server architecture
  try {
    const proxyUrl = `/api/proxy?ticker=${ticker}&startDate=${startDate}&endDate=${endDate}`;
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Yahoo Finance data: ${response.statusText}`);
    }
    
    return await response.json();
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
function mergeNavAndDistributionData(navData, distributionData) {
  const mergedData = { ...navData };
  
  // Add distribution data where available
  for (const date in distributionData) {
    if (mergedData[date]) {
      // Update existing entry with distribution data
      mergedData[date].total_distributions = distributionData[date].total_distributions;
      mergedData[date].detail = distributionData[date].detail;
    } else {
      // Add distribution entry
      mergedData[date] = distributionData[date];
    }
  }
  
  return mergedData;
}

// Export functions for browser environment
if (typeof window !== 'undefined') {
  window.fundDataProcessor = {
    getFundData,
    getDistributionsByDate,
    getAllFundTickers,
    isMoneyMarketFund
  };
}

// Export for module environments
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = {
    getFundData,
    getDistributionsByDate,
    getAllFundTickers,
    isMoneyMarketFund
  };
}
