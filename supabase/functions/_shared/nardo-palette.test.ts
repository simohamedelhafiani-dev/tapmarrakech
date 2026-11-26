import {
  normalizeNardoBackgroundColor,
  normalizeNardoCardColor,
} from '../../../src/components/loyalty/walletTemplates.ts';

Deno.test('legacy loyalty card colors normalize to Nardo grey', () => {
  for (const color of ['#173D32', '#D3A84C', '#D4AF37', '#C5A059', '#B8860B', '#00DFA5']) {
    if (normalizeNardoCardColor(color) !== '#686D76') {
      throw new Error(`Expected ${color} to normalize to Nardo grey`);
    }
  }
});

Deno.test('custom neutral card colors remain unchanged', () => {
  if (normalizeNardoCardColor('#A1A1A1') !== '#A1A1A1') {
    throw new Error('A custom neutral color should be preserved');
  }
});

Deno.test('legacy light card background normalizes to absolute black', () => {
  if (normalizeNardoBackgroundColor('#F7F7F3', '#050505') !== '#050505') {
    throw new Error('Legacy light background should normalize to Nardo black');
  }
});

Deno.test('electric blue is not accepted as a card background', () => {
  if (normalizeNardoBackgroundColor('#3B82F6', '#050505') !== '#686D76') {
    throw new Error('Blue background should normalize to Nardo grey');
  }
});
