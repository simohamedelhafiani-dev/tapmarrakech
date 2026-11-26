export function normalizeNardoBackgroundColor(value: unknown, fallback = "#050505"): string {
  const candidate = typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : fallback;
  const red = Number.parseInt(candidate.slice(1, 3), 16);
  const green = Number.parseInt(candidate.slice(3, 5), 16);
  const blue = Number.parseInt(candidate.slice(5, 7), 16);
  return blue - red >= 35 && blue - green >= 35 ? "#686D76" : candidate;
}
