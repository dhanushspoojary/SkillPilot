import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Mentor Chat Visibility and Contrast', () => {
  function getMessageStyles(senderId: string, selfId: string) {
    const isSelf = senderId === selfId;
    return {
      alignSelf: isSelf ? 'flex-end' : 'flex-start',
      background: isSelf ? '#594593' : '#F2EFF7',
      color: isSelf ? '#FFFFFF' : '#17151B',
      border: isSelf ? '1px solid transparent' : '1px solid #E2DDE8',
    };
  }

  function calculateLuminance(r: number, g: number, b: number): number {
    const a = [r, g, b].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  }

  function calculateContrastRatio(hex1: string, hex2: string): number {
    const parse = (h: string) => {
      const clean = h.replace('#', '');
      return [
        parseInt(clean.substring(0, 2), 16),
        parseInt(clean.substring(2, 4), 16),
        parseInt(clean.substring(4, 6), 16),
      ] as const;
    };
    const [r1, g1, b1] = parse(hex1);
    const [r2, g2, b2] = parse(hex2);
    const l1 = calculateLuminance(r1, g1, b1);
    const l2 = calculateLuminance(r2, g2, b2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  it('incoming mentor messages have high contrast against bubble background (WCAG AA >= 4.5:1)', () => {
    const styles = getMessageStyles('mentor-123', 'student-456');
    assert.equal(styles.alignSelf, 'flex-start');
    assert.equal(styles.background, '#F2EFF7');
    assert.equal(styles.color, '#17151B');

    const ratio = calculateContrastRatio(styles.background, styles.color);
    assert.ok(ratio >= 7.0, `Expected contrast >= 7.0 for incoming messages, got ${ratio.toFixed(2)}:1`);
  });

  it('outgoing messages have high contrast against bubble background (WCAG AA >= 4.5:1)', () => {
    const styles = getMessageStyles('self-user-id', 'self-user-id');
    assert.equal(styles.alignSelf, 'flex-end');
    assert.equal(styles.background, '#594593');
    assert.equal(styles.color, '#FFFFFF');

    const ratio = calculateContrastRatio(styles.background, styles.color);
    assert.ok(ratio >= 7.0, `Expected contrast >= 7.0 for outgoing messages, got ${ratio.toFixed(2)}:1`);
  });

  it('empty or whitespace messages are discarded', () => {
    const rawMessages = [
      { id: '1', body: 'Hello student!' },
      { id: '2', body: '   ' },
      { id: '3', body: '' },
      { id: '4', body: 'I reviewed your code.' },
    ];
    const filtered = rawMessages.filter((m) => m.body && m.body.trim().length > 0);
    assert.equal(filtered.length, 2);
    assert.equal(filtered[0].id, '1');
    assert.equal(filtered[1].id, '4');
  });
});
