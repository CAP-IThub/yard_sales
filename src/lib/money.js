// Money utilities
// Rounds to 2 decimals using the custom rule:
// - Look at the 3rd decimal; if >= 4, round the 2nd decimal up; else truncate.
// - Returns null for invalid/negative inputs.
// Accepts numbers or strings (commas/spaces allowed in strings)
export function roundPriceTwoDp(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const s = typeof raw === 'string' ? raw.replace(/[\,\s]/g, '') : String(raw);
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  const triple = n.toFixed(3); // ensure at least 3 decimals for decision
  const parts = triple.split('.');
  if (parts.length === 1) return Number(triple);
  let intPart = parts[0];
  const frac = parts[1]; // length 3
  let cents = parseInt(frac.slice(0, 2), 10);
  const third = frac[2];
  if (third >= '4') {
    cents += 1;
    if (cents === 100) { // carry into integer part
      intPart = String(Number(intPart) + 1);
      cents = 0;
    }
  }
  return Number(`${intPart}.${String(cents).padStart(2, '0')}`);
}
