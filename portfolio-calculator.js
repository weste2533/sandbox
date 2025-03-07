// Portfolio Calculator Functions

/**
 * Calculates the current value of an MMF portfolio with reinvested distributions
 * @param {Object} allFundData - The complete fund data object
 * @param {number} initialUnits - Initial number of units owned on 12/30/2024
 * @param {string} fundSymbol - Fund symbol (e.g., 'AFAXX')
 * @returns {Object} Portfolio value information
 */
function calculateMMFPortfolio(allFundData, initialUnits, fundSymbol = 'AFAXX') {
    // For MMF, NAV is always $1.00
    const NAV = 1.00;
    
    // Get distribution data
    const distributionData = allFundData.distributions?.[fundSymbol];
    if (!distributionData || !distributionData.rates || !distributionData.rates.length) {
        return {
            initialValue: initialUnits * NAV,
            currentValue: initialUnits * NAV,
            totalReturn: 0,
            percentageReturn: 0,
            error: "No distribution data available"
        };
    }

    // Filter distributions to only include those after 12/30/2024
    // Note: Date strings should be in format that can be parsed correctly
    const startDate = new Date('2024-12-30');
    const recentRates = distributionData.rates.filter(rate => {
        const rateDate = new Date(rate.date);
        return rateDate >= startDate;
    });

    // Sort rates by date (oldest first)
    recentRates.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate compounding growth with distributions
    let currentUnits = initialUnits;
    
    // Track accumulation details for reporting
    const accumulationDetails = [];
    
    for (const rate of recentRates) {
        // Parse rate (assuming it's in percentage format like "4.21%")
        let rateValue = parseFloat(rate.rate) / 100;
        
        // For daily rate, divide annual rate 
        const dailyRate = rateValue / 365;
        
        // Calculate distribution amount (daily interest)
        const distributionAmount = currentUnits * dailyRate;
        
        // Add distribution to units (reinvestment)
        currentUnits += distributionAmount;
        
        accumulationDetails.push({
            date: rate.date,
            rate: rate.rate,
            dailyRate: (dailyRate * 100).toFixed(6) + '%',
            distributionAmount: distributionAmount.toFixed(6),
            runningUnits: currentUnits.toFixed(6)
        });
    }

    // Calculate return values
    const initialValue = initialUnits * NAV;
    const currentValue = currentUnits * NAV;
    const totalReturn = currentValue - initialValue;
    const percentageReturn = (totalReturn / initialValue) * 100;

    return {
        initialUnits,
        currentUnits,
        initialValue,
        currentValue,
        totalReturn,
        percentageReturn,
        accumulationDetails
    };
}

/**
 * Calculates the current value of a mutual fund portfolio with NAV changes and distributions
 * @param {Object} allFundData - The complete fund data object
 * @param {Object} initialHoldings - Object with fund symbols as keys and initial shares as values
 * @returns {Object} Portfolio value information
 */
function calculateMutualFundPortfolio(allFundData, initialHoldings) {
    const startDate = new Date('2024-12-30');
    const results = {};
    let totalInitialValue = 0;
    let totalCurrentValue = 0;
    
    // Process each fund in the holdings
    for (const [fundSymbol, initialShares] of Object.entries(initialHoldings)) {
        // Skip if we don't have data for this fund
        if (!allFundData[fundSymbol]) {
            results[fundSymbol] = {
                error: `No data available for ${fundSymbol}`
            };
            continue;
        }
        
        // Get NAV data
        const navData = allFundData[fundSymbol];
        if (!navData || !navData.timestamp || !navData.indicators?.quote?.[0]?.close) {
            results[fundSymbol] = {
                error: `Invalid NAV data for ${fundSymbol}`
            };
            continue;
        }
        
        // Find NAV closest to start date (12/30/2024)
        const timestamps = navData.timestamp;
        const prices = navData.indicators.quote[0].close;
        
        let initialNAV = null;
        let initialNAVDate = null;
        
        // Find the NAV closest to our start date
        for (let i = 0; i < timestamps.length; i++) {
            const navDate = new Date(timestamps[i] * 1000);
            if (navDate >= startDate) {
                initialNAV = prices[i];
                initialNAVDate = navDate;
                break;
            }
        }
        
        // If we couldn't find a NAV after start date, use the most recent one before start date
        if (initialNAV === null) {
            for (let i = timestamps.length - 1; i >= 0; i--) {
                const navDate = new Date(timestamps[i] * 1000);
                if (navDate <= startDate) {
                    initialNAV = prices[i];
                    initialNAVDate = navDate;
                    break;
                }
            }
        }
        
        // Current NAV is the most recent one
        const currentNAV = prices[prices.length - 1];
        const currentNAVDate = new Date(timestamps[timestamps.length - 1] * 1000);
        
        // Calculate value changes due to NAV changes
        const initialValueFromNAV = initialShares * initialNAV;
        const currentValueFromNAV = initialShares * currentNAV;
        
        // Get distribution data
        const distributionData = allFundData.distributions?.[fundSymbol];
        let currentShares = initialShares;
        const distributionDetails = [];
        
        // Process distributions if available
        if (distributionData && distributionData.distributions && distributionData.distributions.length > 0) {
            // Get distributions after start date
            const distributions = distributionData.distributions.filter(dist => {
                // Find the ex-dividend date column (might be named differently)
                const dateField = distributionData.headers.find(h => 
                    h.toLowerCase().includes('date') || h.toLowerCase().includes('ex-div')
                );
                
                if (!dateField || !dist[dateField]) return false;
                
                const distDate = new Date(dist[dateField]);
                return distDate >= startDate;
            });
            
            // Find amount column - typically named "Distribution" or "Amount"
            const amountField = distributionData.headers.find(h => 
                h.toLowerCase().includes('distribution') || 
                h.toLowerCase().includes('amount') || 
                h.toLowerCase().includes('dividend')
            );
            
            // Process each distribution for reinvestment
            if (amountField) {
                for (const dist of distributions) {
                    const distributionAmount = parseFloat(dist[amountField]) || 0;
                    
                    // Find NAV on ex-date for reinvestment calculation
                    const dateField = distributionData.headers.find(h => 
                        h.toLowerCase().includes('date') || h.toLowerCase().includes('ex-div')
                    );
                    
                    const distDate = dateField ? new Date(dist[dateField]) : null;
                    
                    // Estimate reinvestment NAV (using NAV on or after distribution date)
                    let reinvestmentNAV = currentNAV; // Default to current NAV if we can't find a better match
                    if (distDate) {
                        for (let i = 0; i < timestamps.length; i++) {
                            const navDate = new Date(timestamps[i] * 1000);
                            if (navDate >= distDate) {
                                reinvestmentNAV = prices[i];
                                break;
                            }
                        }
                    }
                    
                    // Calculate shares purchased with distribution
                    const distributionPerShare = distributionAmount;
                    const additionalShares = (distributionPerShare * currentShares) / reinvestmentNAV;
                    currentShares += additionalShares;
                    
                    distributionDetails.push({
                        date: distDate ? distDate.toLocaleDateString() : 'Unknown',
                        distributionPerShare: distributionPerShare.toFixed(4),
                        totalDistribution: (distributionPerShare * currentShares).toFixed(2),
                        reinvestmentNAV: reinvestmentNAV.toFixed(2),
                        additionalShares: additionalShares.toFixed(6),
                        runningShares: currentShares.toFixed(6)
                    });
                }
            }
        }
        
        // Calculate final current value with reinvested distributions
        const currentValue = currentShares * currentNAV;
        const initialValue = initialShares * initialNAV;
        
        // Store results for this fund
        results[fundSymbol] = {
            initialShares,
            currentShares,
            initialNAV,
            currentNAV,
            initialValue,
            currentValue,
            valueChangeFromNAV: currentValueFromNAV - initialValueFromNAV,
            valueChangeFromDistributions: currentValue - currentValueFromNAV,
            totalReturn: currentValue - initialValue,
            percentageReturn: ((currentValue - initialValue) / initialValue) * 100,
            initialNAVDate: initialNAVDate?.toLocaleDateString(),
            currentNAVDate: currentNAVDate?.toLocaleDateString(),
            distributionDetails
        };
        
        totalInitialValue += initialValue;
        totalCurrentValue += currentValue;
    }
    
    // Add portfolio totals
    results.portfolio = {
        totalInitialValue,
        totalCurrentValue,
        totalReturn: totalCurrentValue - totalInitialValue,
        percentageReturn: ((totalCurrentValue - totalInitialValue) / totalInitialValue) * 100
    };
    
    return results;
}

// Function to generate HTML output for portfolio calculations
function generatePortfolioOutput(allFundData) {
    let outputHTML = '';
    
    // Calculate MMF Portfolio (Money Market Fund - AFAXX)
    const mmfPortfolio = calculateMMFPortfolio(allFundData, 77650.8, 'AFAXX');
    
    // Calculate Mutual Fund Portfolio (AGTHX and ANCFX)
    const mutualFundPortfolio = calculateMutualFundPortfolio(allFundData, {
        'AGTHX': 104.855,
        'ANCFX': 860.672
    });
    
    // Generate MMF Portfolio HTML
    outputHTML += `
    <div class="section">
        <h2>MMF Portfolio (AFAXX)</h2>
        <p>Starting with 77,650.8 units on 12/30/2024</p>
        
        <table>
            <tr>
                <th>Initial Units</th>
                <td>${mmfPortfolio.initialUnits.toFixed(2)}</td>
            </tr>
            <tr>
                <th>Current Units</th>
                <td>${parseFloat(mmfPortfolio.currentUnits).toFixed(2)}</td>
            </tr>
            <tr>
                <th>Initial Value</th>
                <td>$${mmfPortfolio.initialValue.toFixed(2)}</td>
            </tr>
            <tr>
                <th>Current Value</th>
                <td>$${parseFloat(mmfPortfolio.currentValue).toFixed(2)}</td>
            </tr>
            <tr>
                <th>Total Return</th>
                <td>$${mmfPortfolio.totalReturn.toFixed(2)}</td>
            </tr>
            <tr>
                <th>Percentage Return</th>
                <td>${mmfPortfolio.percentageReturn.toFixed(4)}%</td>
            </tr>
        </table>
        
        <h3>Distribution Accumulation Details</h3>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Rate</th>
                    <th>Daily Rate</th>
                    <th>Distribution Amount</th>
                    <th>Running Units</th>
                </tr>
            </thead>
            <tbody>
                ${mmfPortfolio.accumulationDetails.map(detail => `
                    <tr>
                        <td>${detail.date}</td>
                        <td>${detail.rate}</td>
                        <td>${detail.dailyRate}</td>
                        <td>${detail.distributionAmount}</td>
                        <td>${detail.runningUnits}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>`;
    
    // Generate Mutual Fund Portfolio HTML
    outputHTML += `
    <div class="section">
        <h2>Mutual Fund Portfolio</h2>
        <p>Holdings as of 12/30/2024:</p>
        <ul>
            <li>AGTHX: 104.855 shares</li>
            <li>ANCFX: 860.672 shares</li>
        </ul>
        
        <h3>Portfolio Summary</h3>
        <table>
            <tr>
                <th>Initial Portfolio Value</th>
                <td>$${mutualFundPortfolio.portfolio.totalInitialValue.toFixed(2)}</td>
            </tr>
            <tr>
                <th>Current Portfolio Value</th>
                <td>$${mutualFundPortfolio.portfolio.totalCurrentValue.toFixed(2)}</td>
            </tr>
            <tr>
                <th>Total Return</th>
                <td>$${mutualFundPortfolio.portfolio.totalReturn.toFixed(2)}</td>
            </tr>
            <tr>
                <th>Percentage Return</th>
                <td>${mutualFundPortfolio.portfolio.percentageReturn.toFixed(4)}%</td>
            </tr>
        </table>
        
        ${Object.entries(mutualFundPortfolio)
            .filter(([key]) => key !== 'portfolio')
            .map(([fundSymbol, fundData]) => `
                <h3>${fundSymbol} Details</h3>
                ${fundData.error ? `<p class="error">${fundData.error}</p>` : `
                <table>
                    <tr>
                        <th>Initial Shares</th>
                        <td>${fundData.initialShares.toFixed(6)}</td>
                    </tr>
                    <tr>
                        <th>Current Shares</th>
                        <td>${parseFloat(fundData.currentShares).toFixed(6)}</td>
                    </tr>
                    <tr>
                        <th>Initial NAV (${fundData.initialNAVDate})</th>
                        <td>$${fundData.initialNAV.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <th>Current NAV (${fundData.currentNAVDate})</th>
                        <td>$${fundData.currentNAV.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <th>Initial Value</th>
                        <td>$${fundData.initialValue.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <th>Current Value</th>
                        <td>$${fundData.currentValue.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <th>Value Change from NAV</th>
                        <td>$${fundData.valueChangeFromNAV.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <th>Value Change from Distributions</th>
                        <td>$${fundData.valueChangeFromDistributions.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <th>Total Return</th>
                        <td>$${fundData.totalReturn.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <th>Percentage Return</th>
                        <td>${fundData.percentageReturn.toFixed(4)}%</td>
                    </tr>
                </table>
                
                ${fundData.distributionDetails && fundData.distributionDetails.length > 0 ? `
                    <h4>Distribution Reinvestment Details</h4>
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Distribution/Share</th>
                                <th>Total Distribution</th>
                                <th>Reinvestment NAV</th>
                                <th>Additional Shares</th>
                                <th>Running Shares</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${fundData.distributionDetails.map(detail => `
                                <tr>
                                    <td>${detail.date}</td>
                                    <td>$${detail.distributionPerShare}</td>
                                    <td>$${detail.totalDistribution}</td>
                                    <td>$${detail.reinvestmentNAV}</td>
                                    <td>${detail.additionalShares}</td>
                                    <td>${detail.runningShares}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<p>No distributions since 12/30/2024</p>'}
                `}
            `).join('')}
    </div>`;
    
    return outputHTML;
}
