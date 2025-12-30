// Unit tests for stats tracking utilities

import { describe, test, expect } from 'vitest';
import { 
  heightToInches,
  calculatePepegaScore,
  formatStatsResponse,
  formatLeaderboardResponse,
  formatPepegaResponse
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

describe('formatStatsResponse', () => {
  test('handles user with no rolls', () => {
    const result = formatStatsResponse('TestUser', null, {});
    expect(result).toBe('TestUser: No rolls yet! Type !roll to get started.');
  });

  test('handles user with zero rolls', () => {
    const stats = { totalRolls: 0 };
    const result = formatStatsResponse('TestUser', stats, {});
    expect(result).toBe('TestUser: No rolls yet! Type !roll to get started.');
  });

  test('formats single roll correctly', () => {
    const stats = {
      totalRolls: 1,
      currentIQ: 142,
      currentHeight: '6\'3"',
      currentHero: 'Reinhardt',
      highestIQ: 142,
      tallestHeight: '6\'3"'
    };
    const ranks = { iqRank: 5, heightRank: 12, iqLowRank: 47 };
    
    const result = formatStatsResponse('TestUser', stats, ranks);
    
    expect(result).toContain('TestUser');
    expect(result).toContain('1 attempt'); // Singular
    expect(result).toContain('142 IQ');
    expect(result).toContain('6\'3"');
    expect(result).toContain('Reinhardt');
    expect(result).toContain('#5 IQ');
    expect(result).toContain('#12 height');
    expect(result).toContain('#47 pepega');
  });

  test('formats multiple rolls correctly', () => {
    const stats = {
      totalRolls: 23,
      currentIQ: 100,
      currentHeight: '5\'6"',
      currentHero: 'Mercy',
      highestIQ: 198,
      tallestHeight: '9\'2"'
    };
    const ranks = { iqRank: 3, heightRank: 7, iqLowRank: 150 };
    
    const result = formatStatsResponse('TestUser', stats, ranks);
    
    expect(result).toContain('23 attempts'); // Plural
    expect(result).toContain('Latest: 100 IQ, 5\'6", Mercy');
    expect(result).toContain('Peak: 198 IQ');
  });

  test('handles missing ranks gracefully', () => {
    const stats = {
      totalRolls: 5,
      currentIQ: 50,
      currentHeight: '2\'4"',
      currentHero: 'Wrecking Ball',
      highestIQ: 87,
      tallestHeight: '5\'2"'
    };
    const ranks = { iqRank: null, heightRank: null, iqLowRank: null };
    
    const result = formatStatsResponse('TestUser', stats, ranks);
    
    expect(result).toContain('TestUser');
    expect(result).toContain('5 attempts');
    expect(result).not.toContain('Rank:');
  });

  test('handles partial ranks', () => {
    const stats = {
      totalRolls: 10,
      currentIQ: 120,
      currentHeight: '6\'0"',
      currentHero: 'Ana',
      highestIQ: 150,
      tallestHeight: '7\'1"'
    };
    const ranks = { iqRank: 25, heightRank: null, iqLowRank: 100 };
    
    const result = formatStatsResponse('TestUser', stats, ranks);
    
    expect(result).toContain('#25 IQ');
    expect(result).toContain('#100 pepega');
    expect(result).not.toContain('height');
  });

  test('response stays under 450 character limit', () => {
    const stats = {
      totalRolls: 999,
      currentIQ: 200,
      currentHeight: '9\'11"',
      currentHero: 'Soldier: 76', // Longest hero name
      highestIQ: 200,
      tallestHeight: '9\'11"'
    };
    const ranks = { iqRank: 999, heightRank: 999, iqLowRank: 999 };
    
    const result = formatStatsResponse('VeryLongUsername1234567890', stats, ranks);
    
    expect(result.length).toBeLessThan(450);
  });

  test('includes all required components', () => {
    const stats = {
      totalRolls: 42,
      currentIQ: 156,
      currentHeight: '7\'2"',
      currentHero: 'Widowmaker',
      highestIQ: 189,
      tallestHeight: '8\'5"'
    };
    const ranks = { iqRank: 10, heightRank: 15, iqLowRank: 200 };
    
    const result = formatStatsResponse('TestUser', stats, ranks);
    
    // Username
    expect(result).toContain('TestUser');
    // Roll count
    expect(result).toContain('42 attempts');
    // Current roll (latest)
    expect(result).toContain('Latest:');
    expect(result).toContain('156 IQ');
    expect(result).toContain('7\'2"');
    expect(result).toContain('Widowmaker');
    // Peak stats
    expect(result).toContain('Peak:');
    expect(result).toContain('189 IQ');
    expect(result).toContain('8\'5"');
    // Stream-specific ranks
    expect(result).toContain('This Stream:');
    expect(result).toContain('#10 IQ');
    expect(result).toContain('#15 height');
    expect(result).toContain('#200 pepega');
  });
});

describe('formatLeaderboardResponse', () => {
  test('formats IQ leaderboard correctly', () => {
    const entries = [
      { username: 'BrainGod', score: 198, rank: 1 },
      { username: 'SmartGuy', score: 187, rank: 2 },
      { username: 'NotBad', score: 156, rank: 3 }
    ];
    
    const result = formatLeaderboardResponse('iq', entries);
    
    expect(result).toContain('🧠 Brainiac Brigade');
    expect(result).toContain('🥇 BrainGod (198)');
    expect(result).toContain('🥈 SmartGuy (187)');
    expect(result).toContain('🥉 NotBad (156)');
    expect(result).toContain('The sharpest minds in the house');
  });

  test('formats height leaderboard correctly', () => {
    const entries = [
      { username: 'TallBoi', score: 119, rank: 1 }, // 9'11"
      { username: 'MediumBoi', score: 75, rank: 2 }, // 6'3"
      { username: 'SmolBoi', score: 48, rank: 3 }  // 4'0"
    ];
    
    const result = formatLeaderboardResponse('height', entries);
    
    expect(result).toContain('📏 Height Champions');
    expect(result).toContain('🥇 TallBoi (9\'11")');
    expect(result).toContain('🥈 MediumBoi (6\'3")');
    expect(result).toContain('🥉 SmolBoi (4\'0")');
    expect(result).toContain('Standing tall above the rest');
  });

  test('formats rolls leaderboard correctly', () => {
    const entries = [
      { username: 'Addict', score: 500, rank: 1 },
      { username: 'Regular', score: 42, rank: 2 },
      { username: 'Casual', score: 7, rank: 3 }
    ];
    
    const result = formatLeaderboardResponse('rolls', entries);
    
    expect(result).toContain('🎲 Roll Veterans');
    expect(result).toContain('🥇 Addict (500)');
    expect(result).toContain('🥈 Regular (42)');
    expect(result).toContain('🥉 Casual (7)');
    expect(result).toContain('The true gambling addicts');
  });

  test('handles empty leaderboard', () => {
    const result = formatLeaderboardResponse('iq', []);
    
    expect(result).toContain('No leaderboard data yet');
  });

  test('response stays under 450 character limit', () => {
    const entries = [
      { username: 'VeryLongUsername12345', score: 200 },
      { username: 'AnotherLongName67890', score: 199 },
      { username: 'YetAnotherLongName123', score: 198 },
      { username: 'AndOneMoreLongName456', score: 197 },
      { username: 'FinalLongUsername789', score: 196 }
    ];
    
    const result = formatLeaderboardResponse('iq', entries);
    
    expect(result.length).toBeLessThan(450);
  });
});

describe('formatPepegaResponse', () => {
  test('formats pepega leaderboard correctly', () => {
    const entries = [
      { username: 'Unlucky1', score: 15, rank: 1 },
      { username: 'Unlucky2', score: 22, rank: 2 },
      { username: 'Unlucky3', score: 28, rank: 3 }
    ];
    
    const result = formatPepegaResponse(entries);
    
    expect(result).toContain('� Pepega Hall of Shame');
    expect(result).toContain('🥇 Unlucky1 (15)');
    expect(result).toContain('🥈 Unlucky2 (22)');
    expect(result).toContain('🥉 Unlucky3 (28)');
    expect(result).toContain('When RNG says "no"');
  });

  test('handles empty leaderboard', () => {
    const result = formatPepegaResponse([]);
    
    expect(result).toContain('No leaderboard data yet');
  });

  test('formats IQ scores as integers', () => {
    const entries = [
      { username: 'Test1', score: 12.6, rank: 1 },
      { username: 'Test2', score: 99.8, rank: 2 }
    ];
    
    const result = formatPepegaResponse(entries);
    
    expect(result).toContain('Test1 (13)');
    expect(result).toContain('Test2 (100)');
  });

  test('response stays under 450 character limit', () => {
    const entries = [
      { username: 'VeryLongUsername12345', score: 0.10 },
      { username: 'AnotherLongName67890', score: 0.11 },
      { username: 'YetAnotherLongName123', score: 0.12 },
      { username: 'AndOneMoreLongName456', score: 0.13 },
      { username: 'FinalLongUsername789', score: 0.14 }
    ];
    
    const result = formatPepegaResponse(entries);
    
    expect(result.length).toBeLessThan(450);
  });
});
