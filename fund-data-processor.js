/**
 * Fund Data Processor
 * 
 * This module processes fund NAV and distribution data from various sources.
 * - Fetches NAV data from Yahoo Finance for mutual funds via proxy
 * - Processes distribution data from local text files
 * - Handles different formats for mutual funds and money market funds
 * 
 * MAIN FUNCTIONS:
 * 
 * get_fund_data(ticker)
 *   Main function to retrieve all data for a specific fund
 *   - ticker (string): The fund ticker symbol
 *   Returns: {Promise<Object>} - Promise resolving to an object with the following structure:
 *     {
 *       [date]: {
 *         nav: Number,          // NAV price for the date
 *         total_distributions: Number  // Total distributions for the date (or 0 if none)
 *       },
 *       ...
 *     }
 * 
 * loadDistributionData(ticker)
 *   Loads distribution data from a text file for a specific fund
 *   - ticker (string): The fund ticker symbol
 *   Returns: {Promise<Object>} - Promise resolving to processed distribution data
 * 
 * fetchNAVData(ticker)
 *   Fetches NAV data from Yahoo Finance via proxy
 *   - ticker (string): The fund ticker symbol
 *   Returns: {Promise<Object>} - Promise resolving to NAV data by date
 * 
 * isMoneyMarketFund(ticker)
 *   Determines if a ticker represents a money market fund
 *   - ticker (string): The fund ticker symbol
 *   Returns: {Boolean} - True if the ticker is a money market fund
 */

// Known MMF tickers (expand as needed)
const MMF_TICKERS = new Set(['AFAXX', 'CFIXX', 'SPAXX', 'SPRXX', 'SWVXX']);

/**
 * Determines if a ticker represents a money market fund
 * @param {string} ticker - Fund ticker symbol
 * @returns {boolean} - True if money market fund
 */
function isMoneyMarketFund(ticker) {
  return MMF_TICKERS.has(ticker);
}

/**
 * Gets the appropriate filename for a ticker's distribution data
 * @param {string} ticker - Fund ticker symbol
 * @returns {string} - Filename for distribution data
 */
function getDistributionFileName(ticker) {
  const typePrefix = isMoneyMarketFund(ticker) ? 'mmf' : 'mutual';
  return `${typePrefix}_${ticker}_distributions.txt`;
}

/**
 * Loads and processes distribution data from text file
 * @param {string} ticker - Fund ticker symbol
 * @returns {Promise<Object>} - Promise resolving to processed distribution data
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
    return processDistributionData(fileContent, ticker);
  } catch (error) {
    console.error(`Failed to load distribution data for ${ticker}:`, error);
    return {};
  }
}

/**
 * Process raw distribution file content based on fund type
 * @param {string} fileContent - Raw text content of distribution file
 * @param {string} ticker - Fund ticker symbol
 * @returns {Object} - Processed distribution data
 */
function processDistributionData(fileContent, ticker) {
  const isMmf = isMoneyMarketFund(ticker);
  const distributionData = {};
  const lines = fileContent.split('\n').filter(line => line.trim());
  
  if (!lines.length) return distributionData;
  
  // Skip header line
  const dataLines = lines.slice(1);

  dataLines.forEach(line => {
    const parts = line.trim().split('\t');
    
    if (isMmf) {
      // Process Money Market Fund (daily rates)
      if (parts.length >= 2) {
        const [rateStr, dateStr] = parts;
        
        // Format date to MM/DD/YYYY
        const date = formatDate(dateStr);
        
        distributionData[date] = {
          total_distributions: parseFloat(rateStr) || 0
        };
      }
    } else {
      // Process Mutual Fund (distribution records)
      if (parts.length >= 8) {
        const recordDateStr = parts[0];
        
        // Format date to MM/DD/YYYY
        const date = formatDate(recordDateStr);
        
        // Parse distribution components
        const regularDividend = parseFloat(parts[3].replace('$', '')) || 0;
        const specialDividend = parseFloat(parts[4].replace('$', '')) || 0;
        const longTermGains = parseFloat(parts[5].replace('$', '')) || 0;
        const shortTermGains = parseFloat(parts[6].replace('$', '')) || 0;
        const reinvestNAV = parseFloat(parts[7].replace('$', '')) || 0;
        
        // Calculate total distributions
        const totalDistributions = regularDividend + specialDividend + longTermGains + shortTermGains;
        
        distributionData[date] = {
          nav: reinvestNAV,
          total_distributions: totalDistributions
        };
      }
    }
  });

  return distributionData;
}

/**
 * Format date string to MM/DD/YYYY
 * @param {string} dateStr - Input date string (various formats)
 * @returns {string} - Formatted date string MM/DD/YYYY
 */
function formatDate(dateStr) {
  // Handle various date formats
  let date;
  
  if (dateStr.includes('/')) {
    // Already in MM/DD/YYYY format
    date = dateStr;
  } else if (dateStr.length === 8) {
    // Format MM/DD/YY to MM/DD/YYYY
    const month = dateStr.substring(0, 2);
    const day = dateStr.substring(3, 5);
    const year = dateStr.substring(6, 8);
    date = `${month}/${day}/20${year}`;
  } else if (dateStr.length === 10 && dateStr.includes('-')) {
    // Format YYYY-MM-DD to MM/DD/YYYY
    const parts = dateStr.split('-');
    date = `${parts[1]}/${parts[2]}/${parts[0]}`;
  } else {
    // Try to parse as YYYY-MM-DD
    try {
      const dateObj = new Date(dateStr);
      const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
      const day = dateObj.getDate().toString().padStart(2, '0');
      const year = dateObj.getFullYear();
      date = `${month}/${day}/${year}`;
    } catch (e) {
      // Default to original if parsing fails
      date = dateStr;
    }
  }
  
  return date;
}

/**
 * Fetches NAV data from Yahoo Finance via proxy
 * @param {string} ticker - Fund ticker symbol
 * @returns {Promise<Object>} - Promise resolving to NAV data by date
 */
async function fetchNAVData(ticker) {
  if (isMoneyMarketFund(ticker)) {
    // Money market funds always have NAV of $1.00
    return {};  // We'll add the $1.00 NAV when merging data
  }
  
  try {
    // Use a proxy service to fetch data from Yahoo Finance
    // Note: In a production environment, you might need a real proxy or API
    const proxyUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5y`;
    
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch NAV data for ${ticker}`);
    }
    
    const data = await response.json();
    
    // Process Yahoo Finance data
    const navData = {};
    
    if (data.chart && data.chart.result && data.chart.result.length > 0) {
      const result = data.chart.result[0];
      const timestamps = result.timestamp || [];
      const quotes = result.indicators.quote[0] || {};
      const adjClose = result.indicators.adjclose?.[0]?.adjclose || [];
      
      // Use adjusted close as the NAV
      for (let i = 0; i < timestamps.length; i++) {
        if (adjClose[i] !== null && adjClose[i] !== undefined) {
          const date = new Date(timestamps[i] * 1000);
          const formattedDate = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
          
          navData[formattedDate] = {
            nav: adjClose[i],
            total_distributions: 0  // Default to 0, will be updated if distribution data exists
          };
        }
      }
    }
    
    return navData;
  } catch (error) {
    console.error(`Error fetching NAV data for ${ticker}:`, error);
    return {};
  }
}

/**
 * Main function to get all fund data
 * @param {string} ticker - Fund ticker symbol
 * @returns {Promise<Object>} - Promise resolving to combined NAV and distribution data
 */
async function get_fund_data(ticker) {
  // Fetch both NAV and distribution data in parallel
  const [navData, distributionData] = await Promise.all([
    fetchNAVData(ticker),
    loadDistributionData(ticker)
  ]);
  
  // Combine the data
  const combinedData = { ...navData };
  
  // Add distribution data
  for (const date in distributionData) {
    if (!combinedData[date]) {
      // If date doesn't exist in NAV data, create it
      combinedData[date] = {
        nav: distributionData[date].nav || (isMoneyMarketFund(ticker) ? 1.00 : 0),
        total_distributions: distributionData[date].total_distributions || 0
      };
    } else {
      // If date exists, update with distribution data
      combinedData[date].total_distributions = distributionData[date].total_distributions || 0;
      
      // Use reinvest NAV from distribution data if available
      if (distributionData[date].nav) {
        combinedData[date].nav = distributionData[date].nav;
      }
    }
  }
  
  // For MMFs, ensure all dates have NAV = 1.00
  if (isMoneyMarketFund(ticker)) {
    for (const date in combinedData) {
      combinedData[date].nav = 1.00;
    }
  }
  
  return combinedData;
}

/**
 * Example function to display fund data in console
 * @param {string} ticker - Fund ticker symbol
 */
async function displayFundData(ticker) {
  console.log(`Fetching data for ${ticker}...`);
  const data = await get_fund_data(ticker);
  console.log(`Fund data for ${ticker}:`, data);
  return data;
}

// Export functions for browser environment
if (typeof window !== 'undefined') {
  window.fundDataProcessor = {
    get_fund_data,
    loadDistributionData,
    fetchNAVData,
    isMoneyMarketFund,
    displayFundData
  };
}

// Export for Node.js environment
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = {
    get_fund_data,
    loadDistributionData,
    fetchNAVData,
    isMoneyMarketFund,
    displayFundData
  };
}
