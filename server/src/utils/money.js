/**
 * Re-scales milestone amounts to a new total (the accepted quote) while keeping
 * their proportions. All amounts are whole rupees; the rounding remainder goes to
 * the last milestone so the parts always add up to exactly `total`.
 */
export function scaleAmounts(amounts, total) {
  if (total < amounts.length) throw new Error('Total too small to give every milestone at least 1 credit');
  const original = amounts.reduce((a, b) => a + b, 0);
  const scaled = amounts.map((a) => Math.max(1, Math.floor((a * total) / original)));
  let diff = total - scaled.reduce((a, b) => a + b, 0);
  // Fix rounding from the end; never let a milestone drop below 1.
  for (let i = scaled.length - 1; diff !== 0 && i >= 0; i -= 1) {
    const step = diff > 0 ? diff : Math.max(diff, 1 - scaled[i]);
    scaled[i] += step;
    diff -= step;
  }
  return scaled;
}

export const sum = (nums) => nums.reduce((a, b) => a + b, 0);
