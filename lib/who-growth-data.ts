/**
 * WHO Child Growth Standards (0–24 months)
 * Source: WHO Multicentre Growth Reference Study (2006)
 * https://www.who.int/tools/child-growth-standards/standards
 *
 * Data represents weight (kg) and length (cm) at key percentiles (3rd, 15th, 50th, 85th, 97th)
 * by age in months. We include both boys and girls averages for simplicity.
 * In a production app, you'd separate by sex.
 */

export interface PercentileRow {
  month: number;
  p3: number;
  p15: number;
  p50: number;
  p85: number;
  p97: number;
}

// WHO Weight-for-age (kg) — Boys, 0–24 months
export const WHO_WEIGHT_BOYS: PercentileRow[] = [
  { month: 0, p3: 2.5, p15: 2.9, p50: 3.3, p85: 3.9, p97: 4.4 },
  { month: 1, p3: 3.4, p15: 3.9, p50: 4.5, p85: 5.1, p97: 5.8 },
  { month: 2, p3: 4.3, p15: 4.9, p50: 5.6, p85: 6.3, p97: 7.1 },
  { month: 3, p3: 5.0, p15: 5.7, p50: 6.4, p85: 7.2, p97: 8.0 },
  { month: 4, p3: 5.6, p15: 6.2, p50: 7.0, p85: 7.8, p97: 8.7 },
  { month: 5, p3: 6.0, p15: 6.7, p50: 7.5, p85: 8.4, p97: 9.3 },
  { month: 6, p3: 6.4, p15: 7.1, p50: 7.9, p85: 8.8, p97: 9.8 },
  { month: 7, p3: 6.7, p15: 7.4, p50: 8.3, p85: 9.2, p97: 10.3 },
  { month: 8, p3: 6.9, p15: 7.7, p50: 8.6, p85: 9.6, p97: 10.7 },
  { month: 9, p3: 7.1, p15: 7.9, p50: 8.9, p85: 9.9, p97: 11.0 },
  { month: 10, p3: 7.4, p15: 8.1, p50: 9.2, p85: 10.2, p97: 11.4 },
  { month: 11, p3: 7.6, p15: 8.4, p50: 9.4, p85: 10.5, p97: 11.7 },
  { month: 12, p3: 7.7, p15: 8.6, p50: 9.6, p85: 10.8, p97: 12.0 },
  { month: 13, p3: 7.9, p15: 8.8, p50: 9.9, p85: 11.0, p97: 12.3 },
  { month: 14, p3: 8.1, p15: 9.0, p50: 10.1, p85: 11.3, p97: 12.6 },
  { month: 15, p3: 8.3, p15: 9.2, p50: 10.3, p85: 11.5, p97: 12.8 },
  { month: 16, p3: 8.4, p15: 9.4, p50: 10.5, p85: 11.7, p97: 13.1 },
  { month: 17, p3: 8.6, p15: 9.6, p50: 10.7, p85: 12.0, p97: 13.4 },
  { month: 18, p3: 8.8, p15: 9.8, p50: 10.9, p85: 12.2, p97: 13.7 },
  { month: 19, p3: 8.9, p15: 10.0, p50: 11.1, p85: 12.5, p97: 13.9 },
  { month: 20, p3: 9.1, p15: 10.1, p50: 11.3, p85: 12.7, p97: 14.2 },
  { month: 21, p3: 9.2, p15: 10.3, p50: 11.5, p85: 12.9, p97: 14.5 },
  { month: 22, p3: 9.4, p15: 10.5, p50: 11.8, p85: 13.2, p97: 14.7 },
  { month: 23, p3: 9.5, p15: 10.7, p50: 12.0, p85: 13.4, p97: 15.0 },
  { month: 24, p3: 9.7, p15: 10.8, p50: 12.2, p85: 13.6, p97: 15.3 },
];

// WHO Weight-for-age (kg) — Girls, 0–24 months
export const WHO_WEIGHT_GIRLS: PercentileRow[] = [
  { month: 0, p3: 2.4, p15: 2.8, p50: 3.2, p85: 3.7, p97: 4.2 },
  { month: 1, p3: 3.2, p15: 3.6, p50: 4.2, p85: 4.8, p97: 5.5 },
  { month: 2, p3: 3.9, p15: 4.5, p50: 5.1, p85: 5.8, p97: 6.6 },
  { month: 3, p3: 4.5, p15: 5.2, p50: 5.8, p85: 6.6, p97: 7.5 },
  { month: 4, p3: 5.0, p15: 5.7, p50: 6.4, p85: 7.3, p97: 8.2 },
  { month: 5, p3: 5.4, p15: 6.1, p50: 6.9, p85: 7.8, p97: 8.8 },
  { month: 6, p3: 5.7, p15: 6.5, p50: 7.3, p85: 8.2, p97: 9.3 },
  { month: 7, p3: 6.0, p15: 6.8, p50: 7.6, p85: 8.6, p97: 9.8 },
  { month: 8, p3: 6.3, p15: 7.0, p50: 7.9, p85: 9.0, p97: 10.2 },
  { month: 9, p3: 6.5, p15: 7.3, p50: 8.2, p85: 9.3, p97: 10.5 },
  { month: 10, p3: 6.7, p15: 7.5, p50: 8.5, p85: 9.6, p97: 10.9 },
  { month: 11, p3: 6.9, p15: 7.7, p50: 8.7, p85: 9.9, p97: 11.2 },
  { month: 12, p3: 7.0, p15: 7.9, p50: 8.9, p85: 10.1, p97: 11.5 },
  { month: 13, p3: 7.2, p15: 8.1, p50: 9.2, p85: 10.4, p97: 11.8 },
  { month: 14, p3: 7.4, p15: 8.3, p50: 9.4, p85: 10.6, p97: 12.1 },
  { month: 15, p3: 7.6, p15: 8.5, p50: 9.6, p85: 10.9, p97: 12.4 },
  { month: 16, p3: 7.7, p15: 8.7, p50: 9.8, p85: 11.1, p97: 12.6 },
  { month: 17, p3: 7.9, p15: 8.9, p50: 10.0, p85: 11.4, p97: 12.9 },
  { month: 18, p3: 8.1, p15: 9.1, p50: 10.2, p85: 11.6, p97: 13.2 },
  { month: 19, p3: 8.2, p15: 9.2, p50: 10.4, p85: 11.8, p97: 13.5 },
  { month: 20, p3: 8.4, p15: 9.4, p50: 10.6, p85: 12.1, p97: 13.7 },
  { month: 21, p3: 8.6, p15: 9.6, p50: 10.9, p85: 12.3, p97: 14.0 },
  { month: 22, p3: 8.7, p15: 9.8, p50: 11.1, p85: 12.5, p97: 14.3 },
  { month: 23, p3: 8.9, p15: 10.0, p50: 11.3, p85: 12.8, p97: 14.6 },
  { month: 24, p3: 9.0, p15: 10.2, p50: 11.5, p85: 13.0, p97: 14.8 },
];

// WHO Length/Height-for-age (cm) — Boys, 0–24 months
export const WHO_HEIGHT_BOYS: PercentileRow[] = [
  { month: 0, p3: 46.1, p15: 47.9, p50: 49.9, p85: 51.8, p97: 53.7 },
  { month: 1, p3: 50.8, p15: 52.7, p50: 54.7, p85: 56.7, p97: 58.6 },
  { month: 2, p3: 54.4, p15: 56.4, p50: 58.4, p85: 60.4, p97: 62.4 },
  { month: 3, p3: 57.3, p15: 59.4, p50: 61.4, p85: 63.5, p97: 65.5 },
  { month: 4, p3: 59.7, p15: 61.8, p50: 63.9, p85: 66.0, p97: 68.0 },
  { month: 5, p3: 61.7, p15: 63.8, p50: 65.9, p85: 68.0, p97: 70.1 },
  { month: 6, p3: 63.3, p15: 65.5, p50: 67.6, p85: 69.8, p97: 71.9 },
  { month: 7, p3: 64.8, p15: 67.0, p50: 69.2, p85: 71.3, p97: 73.5 },
  { month: 8, p3: 66.2, p15: 68.4, p50: 70.6, p85: 72.8, p97: 75.0 },
  { month: 9, p3: 67.5, p15: 69.7, p50: 72.0, p85: 74.2, p97: 76.5 },
  { month: 10, p3: 68.7, p15: 71.0, p50: 73.3, p85: 75.6, p97: 77.9 },
  { month: 11, p3: 69.9, p15: 72.2, p50: 74.5, p85: 76.9, p97: 79.2 },
  { month: 12, p3: 71.0, p15: 73.4, p50: 75.7, p85: 78.1, p97: 80.5 },
  { month: 13, p3: 72.1, p15: 74.5, p50: 76.9, p85: 79.3, p97: 81.8 },
  { month: 14, p3: 73.1, p15: 75.6, p50: 78.0, p85: 80.5, p97: 83.0 },
  { month: 15, p3: 74.1, p15: 76.6, p50: 79.1, p85: 81.7, p97: 84.2 },
  { month: 16, p3: 75.0, p15: 77.6, p50: 80.2, p85: 82.8, p97: 85.4 },
  { month: 17, p3: 76.0, p15: 78.6, p50: 81.2, p85: 83.9, p97: 86.5 },
  { month: 18, p3: 76.9, p15: 79.6, p50: 82.3, p85: 85.0, p97: 87.7 },
  { month: 19, p3: 77.7, p15: 80.5, p50: 83.2, p85: 86.0, p97: 88.8 },
  { month: 20, p3: 78.6, p15: 81.4, p50: 84.2, p85: 87.0, p97: 89.8 },
  { month: 21, p3: 79.4, p15: 82.3, p50: 85.1, p85: 88.0, p97: 90.9 },
  { month: 22, p3: 80.2, p15: 83.1, p50: 86.0, p85: 89.0, p97: 91.9 },
  { month: 23, p3: 81.0, p15: 83.9, p50: 86.9, p85: 89.9, p97: 92.9 },
  { month: 24, p3: 81.7, p15: 84.8, p50: 87.8, p85: 90.9, p97: 93.9 },
];

// WHO Length/Height-for-age (cm) — Girls, 0–24 months
export const WHO_HEIGHT_GIRLS: PercentileRow[] = [
  { month: 0, p3: 45.4, p15: 47.3, p50: 49.1, p85: 51.0, p97: 52.9 },
  { month: 1, p3: 49.8, p15: 51.7, p50: 53.7, p85: 55.6, p97: 57.6 },
  { month: 2, p3: 53.0, p15: 55.0, p50: 57.1, p85: 59.1, p97: 61.1 },
  { month: 3, p3: 55.6, p15: 57.7, p50: 59.8, p85: 61.9, p97: 64.0 },
  { month: 4, p3: 57.8, p15: 59.9, p50: 62.1, p85: 64.3, p97: 66.4 },
  { month: 5, p3: 59.6, p15: 61.8, p50: 64.0, p85: 66.2, p97: 68.5 },
  { month: 6, p3: 61.2, p15: 63.5, p50: 65.7, p85: 68.0, p97: 70.3 },
  { month: 7, p3: 62.7, p15: 65.0, p50: 67.3, p85: 69.6, p97: 71.9 },
  { month: 8, p3: 64.0, p15: 66.4, p50: 68.7, p85: 71.1, p97: 73.5 },
  { month: 9, p3: 65.3, p15: 67.7, p50: 70.1, p85: 72.6, p97: 75.0 },
  { month: 10, p3: 66.5, p15: 69.0, p50: 71.5, p85: 74.0, p97: 76.4 },
  { month: 11, p3: 67.7, p15: 70.3, p50: 72.8, p85: 75.3, p97: 77.8 },
  { month: 12, p3: 68.9, p15: 71.4, p50: 74.0, p85: 76.6, p97: 79.2 },
  { month: 13, p3: 70.0, p15: 72.6, p50: 75.2, p85: 77.8, p97: 80.5 },
  { month: 14, p3: 71.0, p15: 73.7, p50: 76.4, p85: 79.1, p97: 81.7 },
  { month: 15, p3: 72.0, p15: 74.8, p50: 77.5, p85: 80.2, p97: 83.0 },
  { month: 16, p3: 73.0, p15: 75.8, p50: 78.6, p85: 81.4, p97: 84.2 },
  { month: 17, p3: 74.0, p15: 76.8, p50: 79.7, p85: 82.5, p97: 85.4 },
  { month: 18, p3: 74.9, p15: 77.8, p50: 80.7, p85: 83.6, p97: 86.5 },
  { month: 19, p3: 75.8, p15: 78.8, p50: 81.7, p85: 84.7, p97: 87.6 },
  { month: 20, p3: 76.7, p15: 79.7, p50: 82.7, p85: 85.7, p97: 88.7 },
  { month: 21, p3: 77.5, p15: 80.6, p50: 83.7, p85: 86.7, p97: 89.8 },
  { month: 22, p3: 78.4, p15: 81.5, p50: 84.6, p85: 87.7, p97: 90.8 },
  { month: 23, p3: 79.2, p15: 82.3, p50: 85.5, p85: 88.7, p97: 91.9 },
  { month: 24, p3: 80.0, p15: 83.2, p50: 86.4, p85: 89.6, p97: 92.9 },
];

/**
 * Get the appropriate WHO data for a given sex.
 * Default to average of boys/girls if sex is unknown.
 */
export function getWHOWeightData(sex?: "boy" | "girl"): PercentileRow[] {
  if (sex === "girl") return WHO_WEIGHT_GIRLS;
  if (sex === "boy") return WHO_WEIGHT_BOYS;
  // Average boys and girls
  return WHO_WEIGHT_BOYS.map((b, i) => {
    const g = WHO_WEIGHT_GIRLS[i];
    return {
      month: b.month,
      p3: +((b.p3 + g.p3) / 2).toFixed(1),
      p15: +((b.p15 + g.p15) / 2).toFixed(1),
      p50: +((b.p50 + g.p50) / 2).toFixed(1),
      p85: +((b.p85 + g.p85) / 2).toFixed(1),
      p97: +((b.p97 + g.p97) / 2).toFixed(1),
    };
  });
}

export function getWHOHeightData(sex?: "boy" | "girl"): PercentileRow[] {
  if (sex === "girl") return WHO_HEIGHT_GIRLS;
  if (sex === "boy") return WHO_HEIGHT_BOYS;
  // Average boys and girls
  return WHO_HEIGHT_BOYS.map((b, i) => {
    const g = WHO_HEIGHT_GIRLS[i];
    return {
      month: b.month,
      p3: +((b.p3 + g.p3) / 2).toFixed(1),
      p15: +((b.p15 + g.p15) / 2).toFixed(1),
      p50: +((b.p50 + g.p50) / 2).toFixed(1),
      p85: +((b.p85 + g.p85) / 2).toFixed(1),
      p97: +((b.p97 + g.p97) / 2).toFixed(1),
    };
  });
}

/**
 * Calculate which percentile a baby's measurement falls at relative to WHO data.
 * Uses linear interpolation between known breakpoints (p3, p15, p50, p85, p97).
 * Returns a number 0-100, or null if data is unavailable.
 */
export function calculateBabyPercentile(
  value: number,
  monthAge: number,
  data: PercentileRow[],
  convert?: (v: number) => number
): number | null {
  const row = data.find((r) => r.month === Math.round(monthAge));
  if (!row) return null;

  const breakpoints: [number, number][] = [
    [0, convert ? convert(row.p3) : row.p3],
    [3, convert ? convert(row.p3) : row.p3],
    [15, convert ? convert(row.p15) : row.p15],
    [50, convert ? convert(row.p50) : row.p50],
    [85, convert ? convert(row.p85) : row.p85],
    [97, convert ? convert(row.p97) : row.p97],
    [100, convert ? convert(row.p97) : row.p97],
  ];

  // Below p3
  if (value <= breakpoints[1][1]) return Math.round((value / breakpoints[1][1]) * 3);
  // Above p97
  if (value >= breakpoints[5][1]) return 97 + Math.min(3, Math.round(((value - breakpoints[5][1]) / breakpoints[5][1]) * 10));

  // Interpolate between known breakpoints
  for (let i = 1; i < breakpoints.length - 1; i++) {
    const [pLow, vLow] = breakpoints[i];
    const [pHigh, vHigh] = breakpoints[i + 1];
    if (value >= vLow && value <= vHigh) {
      const ratio = vHigh === vLow ? 0 : (value - vLow) / (vHigh - vLow);
      return Math.round(pLow + ratio * (pHigh - pLow));
    }
  }

  return 50;
}

/** Convert kg to lbs */
export function kgToLbs(kg: number): number {
  return +(kg * 2.20462).toFixed(1);
}

/** Convert cm to inches */
export function cmToIn(cm: number): number {
  return +(cm / 2.54).toFixed(1);
}
