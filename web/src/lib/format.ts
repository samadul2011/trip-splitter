const EN_TO_BN_DIGITS: Record<string, string> = {
  "0": "০",
  "1": "১",
  "2": "২",
  "3": "৩",
  "4": "৪",
  "5": "৫",
  "6": "৬",
  "7": "৭",
  "8": "৮",
  "9": "৯",
};

/**
 * Converts English numerals in a string to Bengali numerals (০-৯).
 */
export function toBengaliDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (digit) => EN_TO_BN_DIGITS[digit] || digit);
}

/**
 * Formats an amount in Taka (৳), optionally in Bengali digits.
 */
export function formatTaka(
  amount: number,
  options: { bengali?: boolean; showSign?: boolean } = {}
): string {
  const { bengali = false, showSign = false } = options;
  const absAmount = Math.abs(Number(amount) || 0);
  const hasDecimals = Math.round(absAmount * 100) % 100 !== 0;

  const formattedNumber = absAmount.toLocaleString("en-IN", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });

  const sign = showSign ? (amount > 0.005 ? "+" : amount < -0.005 ? "-" : "") : amount < 0 ? "-" : "";

  if (bengali) {
    return `${sign}৳${toBengaliDigits(formattedNumber)}`;
  }

  return `${sign}৳${formattedNumber}`;
}

/**
 * Formats a date string (YYYY-MM-DD or ISO) into a clean readable date.
 */
export function formatDate(dateStr: string, bengali = false): string {
  if (!dateStr) return "";
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return dateStr;

  const formatted = parsed.toLocaleDateString(bengali ? "bn-BD" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return formatted;
}

