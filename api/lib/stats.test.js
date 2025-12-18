// Unit tests for stats tracking utilities

import { describe, test, expect } from 'vitest';
import { 
  heightToInches,
  calculatePepegaScore
} from './stats.js';

describe('heightToInches', () => {
  test('converts 0\'0" to 0 inches', () => {
    expect(heightToInches('0\'0"')).toBe(0);
  });

  test('converts 5\'11" to 71 inches', () => {
    expect(heightToInches('5\'11"')).toBe(71);
  });

  test('converts 6\'0" to 72 inches', () => {
    expect(heightToInches('6\'0"')).toBe(72);
  });

  test('converts 9\'11" to 119 inches', () => {
    expect(heightToInches('9\'11"')).toBe(119);
  });
});

describe('calculatePepegaScore', () => {
  test('bottom tier stats produce low pepega score', () => {
    const stats = {
      totalRolls: 10,
      sumIQ: 250, // avg 25 IQ
      sumHeightInches: 250, // avg 25 inches (2'1")
      tier1Count: 9, // 90% hamster tier
      tier2Count: 1,
      tier3Count: 0,
      tier4Count: 0,
      tier5Count: 0
    };
    
    const score = calculatePepegaScore(stats);
    
    // Low IQ (25/200 = 0.125 * 0.4 = 0.05)
    // Low height (25/119 = 0.21 * 0.3 = 0.063)
    // Low non-hamster rate (1/10 = 0.1 * 0.3 = 0.03)
    // Total ≈ 0.14
    expect(score).toBeCloseTo(0.14, 1);
    expect(score).toBeLessThan(0.2);
  });

  test('top tier stats produce high pepega score', () => {
    const stats = {
      totalRolls: 10,
      sumIQ: 1800, // avg 180 IQ
      sumHeightInches: 1100, // avg 110 inches (9'2")
      tier1Count: 0,
      tier2Count: 0,
      tier3Count: 2,
      tier4Count: 3,
      tier5Count: 5 // 100% non-hamster
    };
    
    const score = calculatePepegaScore(stats);
    
    // High IQ (180/200 = 0.9 * 0.4 = 0.36)
    // High height (110/119 = 0.92 * 0.3 = 0.276)
    // High non-hamster rate (10/10 = 1.0 * 0.3 = 0.3)
    // Total ≈ 0.936
    expect(score).toBeCloseTo(0.94, 1);
    expect(score).toBeGreaterThan(0.8);
  });

  test('average stats produce mid-range pepega score', () => {
    const stats = {
      totalRolls: 20,
      sumIQ: 2000, // avg 100 IQ
      sumHeightInches: 1200, // avg 60 inches (5'0")
      tier1Count: 3,
      tier2Count: 4,
      tier3Count: 7,
      tier4Count: 4,
      tier5Count: 2 // 85% non-hamster
    };
    
    const score = calculatePepegaScore(stats);
    
    // Mid IQ (100/200 = 0.5 * 0.4 = 0.2)
    // Mid height (60/119 = 0.504 * 0.3 = 0.151)
    // High non-hamster (17/20 = 0.85 * 0.3 = 0.255)
    // Total ≈ 0.606
    expect(score).toBeCloseTo(0.6, 1);
    expect(score).toBeGreaterThan(0.4);
    expect(score).toBeLessThan(0.8);
  });

  test('no rolls returns score of 0', () => {
    const stats = {
      totalRolls: 0,
      sumIQ: 0,
      sumHeightInches: 0,
      tier1Count: 0,
      tier2Count: 0,
      tier3Count: 0,
      tier4Count: 0,
      tier5Count: 0
    };
    
    const score = calculatePepegaScore(stats);
    expect(score).toBe(0);
  });

  test('100% hamster tier has lowest non-hamster component', () => {
    const allHamster = {
      totalRolls: 10,
      sumIQ: 1000, // avg 100 IQ
      sumHeightInches: 600, // avg 60 inches
      tier1Count: 10, // 100% hamster
      tier2Count: 0,
      tier3Count: 0,
      tier4Count: 0,
      tier5Count: 0
    };
    
    const mixedTiers = {
      ...allHamster,
      tier1Count: 5,
      tier2Count: 5 // 50% hamster
    };
    
    const hamsterScore = calculatePepegaScore(allHamster);
    const mixedScore = calculatePepegaScore(mixedTiers);
    
    // Mixed should have higher score (better luck)
    expect(mixedScore).toBeGreaterThan(hamsterScore);
  });

  test('pepega score is between 0 and 1', () => {
    // Test with various stat combinations
    const testCases = [
      { totalRolls: 5, sumIQ: 0, sumHeightInches: 0, tier1Count: 5, tier2Count: 0, tier3Count: 0, tier4Count: 0, tier5Count: 0 },
      { totalRolls: 5, sumIQ: 1000, sumHeightInches: 595, tier1Count: 0, tier2Count: 0, tier3Count: 0, tier4Count: 0, tier5Count: 5 },
      { totalRolls: 100, sumIQ: 10000, sumHeightInches: 6000, tier1Count: 25, tier2Count: 25, tier3Count: 25, tier4Count: 15, tier5Count: 10 }
    ];
    
    for (const stats of testCases) {
      const score = calculatePepegaScore(stats);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});
