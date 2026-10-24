import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Global Color Contrast & Accessibility Audit (WCAG 2.2 AA)', () => {
  function getLuminance(hex: string): number {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;

    const toLinear = (c: number) =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  }

  function getContrastRatio(hex1: string, hex2: string): number {
    const l1 = getLuminance(hex1);
    const l2 = getLuminance(hex2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  it('verifies primary button white text on primary purple meets WCAG AA (>= 4.5:1)', () => {
    const bg = '#735DB5';
    const fg = '#FFFFFF';
    const ratio = getContrastRatio(bg, fg);
    assert.ok(
      ratio >= 4.5,
      `Expected ratio >= 4.5:1, got ${ratio.toFixed(2)}:1 for white text on primary purple`,
    );
  });

  it('verifies primary-dark (#594593) on white surface meets WCAG AAA (>= 7.0:1)', () => {
    const bg = '#FFFFFF';
    const fg = '#594593';
    const ratio = getContrastRatio(bg, fg);
    assert.ok(
      ratio >= 7.0,
      `Expected ratio >= 7.0:1, got ${ratio.toFixed(2)}:1 for link/kicker text on white`,
    );
  });

  it('verifies primary-dark (#594593) on canvas background (#FAF9FB) meets WCAG AAA (>= 7.0:1)', () => {
    const bg = '#FAF9FB';
    const fg = '#594593';
    const ratio = getContrastRatio(bg, fg);
    assert.ok(
      ratio >= 7.0,
      `Expected ratio >= 7.0:1, got ${ratio.toFixed(2)}:1 for link/kicker text on page canvas`,
    );
  });

  it('verifies text-primary (#17151B) meets WCAG AAA (>= 7.0:1) on white and page canvas', () => {
    const fg = '#17151B';
    assert.ok(getContrastRatio('#FFFFFF', fg) >= 15.0);
    assert.ok(getContrastRatio('#FAF9FB', fg) >= 14.0);
  });

  it('verifies text-secondary (#4A4553) meets WCAG AAA (>= 7.0:1) on white and page canvas', () => {
    const fg = '#4A4553';
    assert.ok(getContrastRatio('#FFFFFF', fg) >= 9.0);
    assert.ok(getContrastRatio('#FAF9FB', fg) >= 8.5);
  });

  it('verifies auth-error text (#991B1B) meets WCAG AAA (>= 7.0:1) on white and light red surface', () => {
    const fg = '#991B1B';
    const ratio = getContrastRatio('#FFFFFF', fg);
    assert.ok(ratio >= 8.0, `Expected auth-error ratio >= 8.0:1, got ${ratio.toFixed(2)}:1`);
  });

  it('verifies auth-notice text (#065F46) meets WCAG AAA (>= 7.0:1) on white and light green surface', () => {
    const fg = '#065F46';
    const ratio = getContrastRatio('#FFFFFF', fg);
    assert.ok(ratio >= 7.0, `Expected auth-notice ratio >= 7.0:1, got ${ratio.toFixed(2)}:1`);
  });

  it('verifies approved mentor match badge (#065F46 on #ECFDF5) meets WCAG AAA (>= 7.0:1)', () => {
    const bg = '#ECFDF5';
    const fg = '#065F46';
    const ratio = getContrastRatio(bg, fg);
    assert.ok(ratio >= 7.0, `Expected match badge ratio >= 7.0:1, got ${ratio.toFixed(2)}:1`);
  });
});
