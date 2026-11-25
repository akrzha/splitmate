const currencyMinorDigits: Record<string, number> = {
  JPY: 0,
};

export function getCurrencyMinorDigits(currency: string): number {
  return currencyMinorDigits[currency] ?? 2;
}

export function parseDecimalToInteger(
  value: string,
  decimalPlaces: number
): number | null {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) return null;

  const whole = match[1];
  const fraction = match[2] ?? "";
  if (fraction.length > decimalPlaces) return null;

  const scale = 10n ** BigInt(decimalPlaces);
  const minorUnits =
    BigInt(whole) * scale +
    BigInt(fraction.padEnd(decimalPlaces, "0") || "0");

  if (minorUnits > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(minorUnits);
}

export function parseAmountToMinor(
  value: string,
  currency: string
): number | null {
  return parseDecimalToInteger(
    value,
    getCurrencyMinorDigits(currency)
  );
}

export function formatMinorUnitsForInput(
  amountMinor: number,
  currency: string
): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new Error("Amount must be a non-negative safe integer.");
  }

  const digits = getCurrencyMinorDigits(currency);
  const amount = BigInt(amountMinor);
  const scale = 10n ** BigInt(digits);
  const whole = amount / scale;
  const fraction = amount % scale;

  return digits === 0
    ? whole.toString()
    : `${whole.toString()}.${fraction.toString().padStart(digits, "0")}`;
}

export function formatMinorUnits(
  amountMinor: number,
  currency: string
): string {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new Error("Amount must be a safe integer in minor units.");
  }

  const digits = getCurrencyMinorDigits(currency);
  const amount = BigInt(amountMinor);
  const sign = amount < 0n ? "-" : "";
  const absoluteAmount = amount < 0n ? -amount : amount;
  const scale = 10n ** BigInt(digits);
  const whole = absoluteAmount / scale;
  const fraction = absoluteAmount % scale;
  const decimal =
    digits === 0
      ? ""
      : `.${fraction.toString().padStart(digits, "0")}`;

  return `${sign}${currency} ${whole.toString()}${decimal}`;
}
