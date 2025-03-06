/**
 * Loads and parses fund distribution data from a text file
 * @param {string} fileUrl - URL of the distributions text file to load
 * @returns {Promise<Object>} - Promise resolving to an object containing the parsed fund data
 */
function loadFundDistributionData(fileUrl) {
    return new Promise((resolve, reject) => {
        fetch(fileUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
                }
                return response.text();
            })
            .then(data => {
                const result = parseDistributionData(data);
                resolve(result);
            })
            .catch(error => {
                reject(error);
            });
    });
}

/**
 * Parses the distribution data text content
 * @param {string} data - Raw text content from the distributions file
 * @returns {Object} - Object containing parsed fund data
 */
function parseDistributionData(data) {
    const lines = data.trim().split('\n');
    
    let currentFund = null;
    let isHeader = false;
    let headers = [];
    
    const fundData = {
        ANCFX: {
            distributions: [],
            headers: []
        },
        AGTHX: {
            distributions: [],
            headers: []
        },
        AFAXX: {
            rates: []
        }
    };
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip empty lines
        if (line === '') continue;
        
        // Detect fund
        if (line === 'ANCFX') {
            currentFund = 'ANCFX';
            isHeader = true;
            continue;
        } else if (line === 'AGTHX') {
            currentFund = 'AGTHX';
            isHeader = true;
            continue;
        } else if (line === 'AFAXX') {
            currentFund = 'AFAXX';
            isHeader = true;
            continue;
        }
        
        // Process headers
        if (isHeader) {
            headers = line.split('\t');
            if (currentFund === 'ANCFX' || currentFund === 'AGTHX') {
                fundData[currentFund].headers = headers;
            }
            isHeader = false;
            continue;
        }
        
        // Process data rows
        const values = line.split('\t');
        
        if (currentFund === 'ANCFX' || currentFund === 'AGTHX') {
            if (values.length === headers.length) {
                // Create object with header keys and row values
                const rowObj = {};
                headers.forEach((header, index) => {
                    rowObj[header] = values[index];
                });
                fundData[currentFund].distributions.push(rowObj);
            }
        } else if (currentFund === 'AFAXX') {
            if (values.length === 2) {
                fundData[currentFund].rates.push({
                    rate: values[0],
                    date: values[1]
                });
            }
        }
    }
    
    return fundData;
}

/**
 * Formats a date string from MM/DD/YY to MM/DD/YYYY
 * @param {string} dateString - Date string in MM/DD/YY format
 * @returns {string} - Formatted date string
 */
function formatDate(dateString) {
    // Check if date is in MM/DD/YY format and convert to MM/DD/YYYY if needed
    const parts = dateString.split('/');
    if (parts.length === 3 && parts[2].length === 2) {
        const year = parts[2].startsWith('0') ? '20' + parts[2] : '20' + parts[2];
        return `${parts[0]}/${parts[1]}/${year}`;
    }
    return dateString;
}

// Example usage:
// loadFundDistributionData('distributions.txt')
//     .then(data => {
//         console.log('Parsed fund data:', data);
//         // Now you can use the data object in your application
//     })
//     .catch(error => {
//         console.error('Error loading fund data:', error);
//     });
