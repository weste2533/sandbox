/**
 * Loads and parses fund distribution data from a text file into simplified format
 * @param {string} fileUrl - URL of the distributions text file to load
 * @returns {Promise<Object>} - Promise resolving to simplified fund data
 */
function loadSimplifiedFundData(fileUrl) {
    return new Promise((resolve, reject) => {
        fetch(fileUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
                }
                return response.text();
            })
            .then(data => {
                const result = parseSimplifiedDistributionData(data);
                resolve(result);
            })
            .catch(error => {
                reject(error);
            });
    });
}

/**
 * Parses the distribution data text content to extract only key information
 * @param {string} data - Raw text content from the distributions file
 * @returns {Object} - Object containing simplified fund distribution data
 */
function parseSimplifiedDistributionData(data) {
    const lines = data.trim().split('\n');
    
    let currentFund = null;
    let isHeader = false;
    let headers = [];
    
    // Initialize result object with the three funds
    const simplifiedFundData = {
        ANCFX: {
            distributions: []
        },
        AGTHX: {
            distributions: []
        },
        AFAXX: {
            distributions: []
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
            isHeader = false;
            continue;
        }
        
        // Process data rows
        const values = line.split('\t');
        
        if (currentFund === 'ANCFX' || currentFund === 'AGTHX') {
            if (values.length === headers.length) {
                // Create a map of header to value
                const rowMap = {};
                headers.forEach((header, index) => {
                    rowMap[header] = values[index];
                });
                
                // Calculate total distributions: all dividends + all capital gains
                const incomeRegular = parseFloat(rowMap['Income Dividend Regular']) || 0;
                const incomeSpecial = parseFloat(rowMap['Income Dividend Special']) || 0;
                const capGainsLong = parseFloat(rowMap['Cap. Gains Long-Term']) || 0;
                const capGainsShort = parseFloat(rowMap['Cap. Gains Short-Term']) || 0;
                const totalDistributions = incomeRegular + incomeSpecial + capGainsLong + capGainsShort;
                
                // Extract the calculated date and reinvest NAV
                const distributionDate = rowMap['Calculated Date'];
                const reinvestNAV = parseFloat(rowMap['Reinvest NAV']) || 0;
                
                // Add to the simplified data structure
                simplifiedFundData[currentFund].distributions.push({
                    'Distribution Date': distributionDate,
                    'Reinvest NAV': reinvestNAV,
                    'Total Distributions': totalDistributions
                });
            }
        } else if (currentFund === 'AFAXX') {
            if (values.length === 2) {
                const rate = parseFloat(values[0]) || 0;
                const asOfDate = values[1];
                
                // For AFAXX, the rate is the total distribution and NAV is always $1.00
                simplifiedFundData[currentFund].distributions.push({
                    'Distribution Date': asOfDate,
                    'Reinvest NAV': 1.00,
                    'Total Distributions': rate
                });
            }
        }
    }
    
    return simplifiedFundData;
}

/**
 * Displays the simplified fund data in the console
 * @param {Object} fundData - The simplified fund data object
 */
function displayFundData(fundData) {
    console.log('=== Simplified Fund Distribution Data ===');
    
    for (const [fundSymbol, fund] of Object.entries(fundData)) {
        console.log(`\n${fundSymbol} (${fund.distributions.length} distributions):`);
        
        // Display the first 3 and last 3 distributions to keep the output manageable
        const displayCount = 3;
        const distributions = fund.distributions;
        
        if (distributions.length <= displayCount * 2) {
            // If there are few distributions, show them all
            distributions.forEach((dist, index) => {
                console.log(`  ${index + 1}. Date: ${dist['Distribution Date']}, NAV: $${dist['Reinvest NAV'].toFixed(2)}, Total Dist: $${dist['Total Distributions'].toFixed(6)}`);
            });
        } else {
            // Show first few
            for (let i = 0; i < displayCount; i++) {
                const dist = distributions[i];
                console.log(`  ${i + 1}. Date: ${dist['Distribution Date']}, NAV: $${dist['Reinvest NAV'].toFixed(2)}, Total Dist: $${dist['Total Distributions'].toFixed(6)}`);
            }
            
            console.log('  ...');
            
            // Show last few
            for (let i = distributions.length - displayCount; i < distributions.length; i++) {
                const dist = distributions[i];
                console.log(`  ${i + 1}. Date: ${dist['Distribution Date']}, NAV: $${dist['Reinvest NAV'].toFixed(2)}, Total Dist: $${dist['Total Distributions'].toFixed(6)}`);
            }
        }
    }
}

/**
 * Example usage of the fund distribution parser
 */
function main() {
    // Replace with the actual path to your distributions file
    const distributionsFileUrl = 'distributions.txt';
    
    console.log('Loading fund distribution data...');
    
    loadSimplifiedFundData(distributionsFileUrl)
        .then(fundData => {
            // Display summary of the data
            displayFundData(fundData);
            
            // Example: Access specific distribution data
            console.log('\n=== Example Data Access ===');
            
            // Get the latest distribution for ANCFX
            if (fundData.ANCFX.distributions.length > 0) {
                const latestANCFX = fundData.ANCFX.distributions[fundData.ANCFX.distributions.length - 1];
                console.log(`Latest ANCFX distribution (${latestANCFX['Distribution Date']}): $${latestANCFX['Total Distributions'].toFixed(4)}`);
            }
            
            // Calculate average distribution for AFAXX in 2025
            const afaxx2025 = fundData.AFAXX.distributions.filter(dist => 
                dist['Distribution Date'].includes('2025')
            );
            
            if (afaxx2025.length > 0) {
                const avgDist = afaxx2025.reduce((sum, dist) => sum + dist['Total Distributions'], 0) / afaxx2025.length;
                console.log(`Average AFAXX distribution in 2025 (${afaxx2025.length} distributions): $${avgDist.toFixed(8)}`);
            }
            
            // Example usage in application
            console.log('\nFund data loaded successfully and ready for use in your application!');
        })
        .catch(error => {
            console.error('Error loading fund data:', error);
        });
}
