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
    
    // Check if we have the correct path to the fund data
    const distributionData = allFundData[fundSymbol];
    if (!distributionData || !distributionData.rates || !distributionData.rates.length) {
        return {
            initialValue: initialUnits * NAV,
            currentValue: initialUnits * NAV,
            totalReturn: 0,
            percentageReturn: 0,
            error: "No distribution data available"
        };
    }

    const startDate = new Date('2024-12-30');
    const recentRates = distributionData.rates.filter(rate => {
        const rateDate = new Date(formatDate(rate.date));
        return rateDate >= startDate;
    });

    recentRates.sort((a, b) => new Date(formatDate(a.date)) - new Date(formatDate(b.date)));

    let currentUnits = initialUnits;
    const accumulationDetails = [];
    
    for (const rate of recentRates) {
        let rateValue = parseFloat(rate.rate) / 100;
        const dailyRate = rateValue / 365;
        const distributionAmount = currentUnits * dailyRate;
        currentUnits += distributionAmount;
        
        accumulationDetails.push({
            date: formatDate(rate.date),
            rate: rate.rate,
            dailyRate: (dailyRate * 100).toFixed(6) + '%',
            distributionAmount: distributionAmount.toFixed(6),
            runningUnits: currentUnits.toFixed(6)
        });
    }

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
    
    for (const [fundSymbol, initialShares] of Object.entries(initialHoldings)) {
        if (!allFundData[fundSymbol]) {
            results[fundSymbol] = { error: `No data available for ${fundSymbol}` };
            continue;
        }
        
        // Assuming NAV data structure - may need adjustment based on actual data structure
        const navData = allFundData[fundSymbol];
        
        // Check if NAV data is available in the expected format
        if (!navData || !navData.timestamp || !navData.indicators?.quote?.[0]?.close) {
            results[fundSymbol] = { error: `Invalid NAV data for ${fundSymbol}` };
            continue;
        }
        
        const timestamps = navData.timestamp;
        const prices = navData.indicators.quote[0].close;
        
        let initialNAV = null;
        let initialNAVDate = null;
        
        // Find initial NAV on or after the start date
        for (let i = 0; i < timestamps.length; i++) {
            const navDate = new Date(timestamps[i] * 1000);
            if (navDate >= startDate) {
                initialNAV = prices[i];
                initialNAVDate = navDate;
                break;
            }
        }
        
        // If we couldn't find a NAV on or after the start date, 
        // find the latest NAV prior to the start date
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
        
        const currentNAV = prices[prices.length - 1];
        const currentNAVDate = new Date(timestamps[timestamps.length - 1] * 1000);
        
        const initialValue = initialShares * initialNAV;
        let currentShares = initialShares;
        const distributionDetails = [];
        
        // Get distribution data from the correct path - allFundData not allFundData.distributions
        const distributionData = allFundData[fundSymbol];
        
        if (distributionData && distributionData.distributions && distributionData.distributions.length > 0) {
            const distributions = distributionData.distributions.filter(dist => {
                const dateField = distributionData.headers.find(h => 
                    h.toLowerCase().includes('date') || h.toLowerCase().includes('ex-div')
                );
                if (!dateField || !dist[dateField]) return false;
                
                // Format date properly before conversion
                const distDate = new Date(formatDate(dist[dateField]));
                return distDate >= startDate;
            });
            
            // Sort distributions by date to process them in chronological order
            distributions.sort((a, b) => {
                const dateField = distributionData.headers.find(h => 
                    h.toLowerCase().includes('date') || h.toLowerCase().includes('ex-div')
                );
                return new Date(formatDate(a[dateField])) - new Date(formatDate(b[dateField]));
            });
            
            const amountField = distributionData.headers.find(h => 
                h.toLowerCase().includes('distribution') || 
                h.toLowerCase().includes('amount') || 
                h.toLowerCase().includes('dividend')
            );
            
            if (amountField) {
                for (const dist of distributions) {
                    const distributionAmount = parseFloat(dist[amountField]) || 0;
                    const dateField = distributionData.headers.find(h => 
                        h.toLowerCase().includes('date') || h.toLowerCase().includes('ex-div')
                    );
                    const distDate = dateField ? new Date(formatDate(dist[dateField])) : null;
                    
                    // Find the NAV on distribution date for accurate reinvestment calculation
                    let reinvestmentNAV = null;
                    if (distDate) {
                        for (let i = 0; i < timestamps.length; i++) {
                            const navDate = new Date(timestamps[i] * 1000);
                            if (navDate >= distDate) {
                                reinvestmentNAV = prices[i];
                                break;
                            }
                        }
                        
                        // If no NAV found after distribution date, use the closest previous NAV
                        if (reinvestmentNAV === null) {
                            for (let i = timestamps.length - 1; i >= 0; i--) {
                                const navDate = new Date(timestamps[i] * 1000);
                                if (navDate <= distDate) {
                                    reinvestmentNAV = prices[i];
                                    break;
                                }
                            }
                        }
                    }
                    
                    // If still no reinvestment NAV found, use current NAV as fallback
                    if (reinvestmentNAV === null) {
                        reinvestmentNAV = currentNAV;
                    }
                    
                    const distributionPerShare = distributionAmount;
                    // Calculate distribution based on shares owned at the time of the distribution
                    const totalDistribution = distributionPerShare * currentShares;
                    // Calculate new shares acquired from reinvestment
                    const additionalShares = totalDistribution / reinvestmentNAV;
                    // Update share count after reinvestment
                    currentShares += additionalShares;
                    
                    distributionDetails.push({
                        date: distDate ? distDate.toLocaleDateString() : 'Unknown',
                        distributionPerShare: distributionPerShare.toFixed(4),
                        totalDistribution: totalDistribution.toFixed(2),
                        reinvestmentNAV: reinvestmentNAV.toFixed(2),
                        additionalShares: additionalShares.toFixed(6),
                        runningShares: currentShares.toFixed(6)
                    });
                }
            }
        }
        
        // Calculate current value based on final share count
        const currentValue = currentShares * currentNAV;
        // The value if shares were not reinvested (using initial shares)
        const currentValueFromNAV = initialShares * currentNAV;
        // Initial value calculation remains the same
        const initialValueFromNAV = initialShares * initialNAV;
        
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
    
    results.portfolio = {
        totalInitialValue,
        totalCurrentValue,
        totalReturn: totalCurrentValue - totalInitialValue,
        percentageReturn: ((totalCurrentValue - totalInitialValue) / totalInitialValue) * 100
    };
    
    return results;
}
