// Characterization tests for game.js
// These tests document current behavior before refactoring

import { describe, test, expect } from 'vitest';
import { 
  generateIQ, 
  generateHeight, 
  generateHero, 
  getRandomInsult,
  formatRollResponse,
  INSULTS
} from './game.js';

describe('generateIQ', () => {
  test('returns a number between 0 and 200', () => {
    for (let i = 0; i < 100; i++) {
      const iq = generateIQ();
      expect(iq).toBeGreaterThanOrEqual(0);
      expect(iq).toBeLessThanOrEqual(200);
      expect(Number.isInteger(iq)).toBe(true);
    }
  });
});

describe('generateHeight', () => {
  test('returns valid height format', () => {
    const heightRegex = /^\d'\d{1,2}"$/;
    for (let i = 0; i < 100; i++) {
      const height = generateHeight();
      expect(height).toMatch(heightRegex);
    }
  });

  test('feet is between 0 and 9', () => {
    for (let i = 0; i < 100; i++) {
      const height = generateHeight();
      const [feet] = height.split("'").map(Number);
      expect(feet).toBeGreaterThanOrEqual(0);
      expect(feet).toBeLessThanOrEqual(9);
    }
  });

  test('inches is between 0 and 11', () => {
    for (let i = 0; i < 100; i++) {
      const height = generateHeight();
      const [, inches] = height.replace('"', '').split("'").map(Number);
      expect(inches).toBeGreaterThanOrEqual(0);
      expect(inches).toBeLessThanOrEqual(11);
    }
  });
});

describe('generateHero - tier assignment', () => {
  test('bottom tier: 0 IQ, 0\'0" → tier 1 (hamster)', () => {
    const result = generateHero(0, '0\'0"');
    expect(result.tier).toBe(1);
    expect(result.tierName).toBe('hamster');
    expect(['Wrecking Ball', 'Bastion', 'Winston', 'Torbjörn', 'Junkrat', 'Orisa', 'Brigitte', 'Hazard', 'Tracer', 'Sombra']).toContain(result.hero);
  });

  test('top tier: 200 IQ, 9\'11" → tier 5 (overqualified)', () => {
    const result = generateHero(200, '9\'11"');
    expect(result.tier).toBe(5);
    expect(result.tierName).toBe('overqualified');
    expect(['Mercy', 'Kiriko', 'Widowmaker', 'Freja']).toContain(result.hero);
  });

  test('middle tier: 100 IQ, 5\'11" → tier 3 (normal)', () => {
    const result = generateHero(100, '5\'11"');
    expect(result.tier).toBe(3);
    expect(result.tierName).toBe('normal');
  });

  test('low-mid tier: 50 IQ, 2\'6" → tier 2 (unga)', () => {
    const result = generateHero(50, '2\'6"');
    expect(result.tier).toBe(2);
    expect(result.tierName).toBe('unga');
  });

  test('high-mid tier: 150 IQ, 7\'6" → tier 4 (bigbrain)', () => {
    const result = generateHero(150, '7\'6"');
    expect(result.tier).toBe(4);
    expect(result.tierName).toBe('bigbrain');
  });

  test('asymmetric: high IQ, low height → tier 2-3', () => {
    const result = generateHero(200, '0\'0"');
    expect(result.tier).toBeGreaterThanOrEqual(2);
    expect(result.tier).toBeLessThanOrEqual(3);
  });

  test('asymmetric: low IQ, high height → tier 2-3', () => {
    const result = generateHero(0, '9\'11"');
    expect(result.tier).toBeGreaterThanOrEqual(2);
    expect(result.tier).toBeLessThanOrEqual(3);
  });
});

describe('generateHero - returns valid structure', () => {
  test('returns object with hero, tier, and tierName', () => {
    const result = generateHero(100, '5\'6"');
    expect(result).toHaveProperty('hero');
    expect(result).toHaveProperty('tier');
    expect(result).toHaveProperty('tierName');
    expect(typeof result.hero).toBe('string');
    expect(typeof result.tier).toBe('number');
    expect(typeof result.tierName).toBe('string');
  });

  test('tier is between 1 and 5', () => {
    for (let i = 0; i < 50; i++) {
      const iq = Math.floor(Math.random() * 201);
      const feet = Math.floor(Math.random() * 10);
      const inches = Math.floor(Math.random() * 12);
      const height = `${feet}'${inches}"`;
      const result = generateHero(iq, height);
      expect(result.tier).toBeGreaterThanOrEqual(1);
      expect(result.tier).toBeLessThanOrEqual(5);
    }
  });
});

describe('getRandomInsult', () => {
  test('returns a string from INSULTS array', () => {
    const insult = getRandomInsult();
    expect(typeof insult).toBe('string');
    expect(INSULTS).toContain(insult);
  });

  test('returns different insults (over multiple calls)', () => {
    const insults = new Set();
    for (let i = 0; i < 100; i++) {
      insults.add(getRandomInsult());
    }
    // Should get at least a few different insults in 100 tries
    expect(insults.size).toBeGreaterThan(1);
  });
});

describe('formatRollResponse', () => {
  test('returns a string', () => {
    const result = formatRollResponse('TestUser', 100, '5\'6"', {
      hero: 'Soldier: 76',
      tier: 3,
      tierName: 'normal'
    });
    expect(typeof result).toBe('string');
  });

  test('includes username in response', () => {
    const result = formatRollResponse('TestUser', 100, '5\'6"', {
      hero: 'Soldier: 76',
      tier: 3,
      tierName: 'normal'
    });
    expect(result).toContain('TestUser');
  });

  test('includes IQ in response', () => {
    const result = formatRollResponse('TestUser', 142, '5\'6"', {
      hero: 'Soldier: 76',
      tier: 3,
      tierName: 'normal'
    });
    expect(result).toContain('142');
  });

  test('includes height in response', () => {
    const result = formatRollResponse('TestUser', 100, '6\'3"', {
      hero: 'Soldier: 76',
      tier: 3,
      tierName: 'normal'
    });
    expect(result).toContain('6\'3"');
  });

  test('includes hero in response', () => {
    const result = formatRollResponse('TestUser', 100, '5\'6"', {
      hero: 'Widowmaker',
      tier: 5,
      tierName: 'overqualified'
    });
    expect(result).toContain('Widowmaker');
  });

  test('tier 1 response has hamster-themed language', () => {
    // Test multiple times since format is random
    let foundHamsterTheme = false;
    for (let i = 0; i < 10; i++) {
      const result = formatRollResponse('TestUser', 10, '1\'2"', {
        hero: 'Wrecking Ball',
        tier: 1,
        tierName: 'hamster'
      });
      const lowerResult = result.toLowerCase();
      if (lowerResult.includes('hamster') || 
          lowerResult.includes('pet') || 
          lowerResult.includes('instinct')) {
        foundHamsterTheme = true;
        break;
      }
    }
    expect(foundHamsterTheme).toBe(true);
  });

  test('tier 2 response with Reinhardt includes CHUNGUS', () => {
    const result = formatRollResponse('TestUser', 50, '3\'0"', {
      hero: 'Reinhardt',
      tier: 2,
      tierName: 'unga'
    });
    expect(result).toContain('CHUNGUS');
  });

  test('different tiers produce different response styles', () => {
    const tier1 = formatRollResponse('User1', 10, '1\'0"', { hero: 'Winston', tier: 1, tierName: 'hamster' });
    const tier5 = formatRollResponse('User2', 190, '9\'0"', { hero: 'Mercy', tier: 5, tierName: 'overqualified' });
    
    // Responses should be meaningfully different (not just username/stats)
    expect(tier1).not.toBe(tier5);
  });
});
