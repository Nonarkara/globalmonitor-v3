/**
 * Middle East oil import reliance by country (% of domestic oil consumption).
 * Source: IEA World Energy Statistics 2024, via Visual Capitalist (Jun 2026).
 * @see https://www.visualcapitalist.com/countries-depend-on-middle-east-oil/
 * @see https://www.iea.org/data-and-statistics/data-tools/reliance-on-middle-east-oil-and-gas-supplies-by-country
 */
export const MIDDLE_EAST_OIL_DEPENDENCY = {
    metric: 'Middle East oil imports as share of domestic oil consumption',
    year: 2024,
    source: 'IEA World Energy Statistics',
    visualizedBy: 'Visual Capitalist',
    articleUrl: 'https://www.visualcapitalist.com/countries-depend-on-middle-east-oil/',
    ieaUrl: 'https://www.iea.org/data-and-statistics/data-tools/reliance-on-middle-east-oil-and-gas-supplies-by-country',
    updatedAt: '2026-06-17',
    countries: [
        { code: 'ER', name: 'Eritrea', pct: 91 },
        { code: 'MG', name: 'Madagascar', pct: 89 },
        { code: 'PK', name: 'Pakistan', pct: 78 },
        { code: 'JP', name: 'Japan', pct: 77, major: true },
        { code: 'KE', name: 'Kenya', pct: 77 },
        { code: 'TW', name: 'Taiwan', pct: 63, major: true },
        { code: 'KR', name: 'South Korea', pct: 57, major: true },
        { code: 'ZA', name: 'South Africa', pct: 54 },
        { code: 'TZ', name: 'Tanzania', pct: 53 },
        { code: 'NA', name: 'Namibia', pct: 50 },
        { code: 'LK', name: 'Sri Lanka', pct: 50 },
        { code: 'TH', name: 'Thailand', pct: 50, major: true },
        { code: 'IN', name: 'India', pct: 45, major: true },
        { code: 'LT', name: 'Lithuania', pct: 40 },
        { code: 'CN', name: 'China', pct: 38, major: true },
        { code: 'IS', name: 'Iceland', pct: 34 },
        { code: 'PL', name: 'Poland', pct: 34 },
        { code: 'DE', name: 'Germany', pct: 6, major: true },
        { code: 'US', name: 'United States', pct: 3, major: true },
        { code: 'CA', name: 'Canada', pct: 1, major: true }
    ]
};

/** Major economies most relevant to Middle East oil-crisis intel narrative. */
export const KEY_OIL_DEPENDENT_ECONOMIES = MIDDLE_EAST_OIL_DEPENDENCY.countries
    .filter((c) => c.major)
    .sort((a, b) => b.pct - a.pct);

export function dependencyColor(pct) {
    if (pct >= 70) return '#ef4444';
    if (pct >= 50) return '#f59e0b';
    if (pct >= 30) return '#f97316';
    return '#22c55e';
}
