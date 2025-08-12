export const normalizeClient = (s: string) => s.trim().toLowerCase();

export const hashString = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return Math.abs(h);
};

export const hslToHex = (h: number, s: number, l: number) => {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
};

export const getDefaultColorForClient = (name: string) => {
  const base = normalizeClient(name || 'client');
  const h = hashString(base) % 360;
  return hslToHex(h, 70, 90); // fond pâle
};

export const hexToRgb = (hex: string) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return { r: 255, g: 255, b: 255 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
};

// YIQ contrast
export const pickTextColor = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? '#000' : '#fff';
};

export const darkenHex = (hex: string, amount = 0.15) => {
  const { r, g, b } = hexToRgb(hex);
  const d = (x: number) => Math.max(0, Math.min(255, Math.round(x * (1 - amount))));
  const toHex = (x: number) => x.toString(16).padStart(2, '0');
  return `#${toHex(d(r))}${toHex(d(g))}${toHex(d(b))}`;
};

export const deriveColors = (hex: string) => {
  const safe = /^#([0-9a-f]{6})$/i.test(hex) ? hex : '#e6f7ef';
  return {
    bg: safe,
    border: darkenHex(safe, 0.25),
    text: pickTextColor(safe),
  };
};

export const ensureClientColor = (
  map: Record<string, { hex: string }>,
  clientName: string
) => {
  const key = normalizeClient(clientName || '');
  if (!key) return { updatedMap: map, colorHex: undefined as string | undefined };
  if (map[key]?.hex) return { updatedMap: map, colorHex: map[key].hex };
  const hex = getDefaultColorForClient(clientName);
  return { updatedMap: { ...map, [key]: { hex } }, colorHex: hex };
};
