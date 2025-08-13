export function formatNaira(amount) {
  if (amount == null || isNaN(amount)) return '₦0';
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(Number(amount));
}
