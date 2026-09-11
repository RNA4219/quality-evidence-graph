/** 明示timezone、実在する暦日、小数秒1〜9桁を検証する。実行環境の時計は参照しない。 */
export function timestampMillis(value: unknown): number {
  if (typeof value !== "string") return NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!m) return NaN;
  const [, y, mo, d, h, mi, s, , tz] = m;
  const year = Number(y);
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][Number(mo) - 1] ?? 0;
  if (+mo! < 1 || +mo! > 12 || +d! < 1 || +d! > days || +h! > 23 || +mi! > 59 || +s! > 59) return NaN;
  if (tz !== "Z" && (Number(tz!.slice(1, 3)) > 23 || Number(tz!.slice(4, 6)) > 59)) return NaN;
  return Date.parse(value);
}

/** 比較時にmicro/nanosecondを丸めない。 */
export function timestampNanos(value: unknown): bigint | undefined {
  const milliseconds = timestampMillis(value);
  if (!Number.isFinite(milliseconds)) return undefined;
  const fraction = /\.(\d{1,9})(?:Z|[+-]\d{2}:\d{2})$/.exec(String(value))?.[1] ?? "";
  return BigInt(milliseconds) * 1000000n + BigInt(fraction.padEnd(9, "0").slice(3));
}
