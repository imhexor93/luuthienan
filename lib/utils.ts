/**
 * Format a VND amount compactly for table/card display.
 * e.g. 45_000_000 → "45 tr ₫"  |  1_200_000_000 → "1.2 tỷ ₫"
 */
export function formatMoney(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(1).replace('.0', '')} tỷ ₫`
  }
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1).replace('.0', '')} tr ₫`
  }
  return `${amount.toLocaleString('vi-VN')} ₫`
}

/**
 * Format a VND amount in full, e.g. for tooltips.
 * e.g. 45_000_000 → "45.000.000 ₫"
 */
export function formatMoneyFull(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount)
}
