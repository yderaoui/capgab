// JSON canonicalization v1: lexicographic object keys, preserved array order,
// JSON primitive encoding. Receipt monetary values are decimal strings.
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const s = JSON.stringify(value);
    if (s === undefined) throw new Error("Non-JSON receipt value.");
    return s;
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`)
    .join(",")}}`;
}
