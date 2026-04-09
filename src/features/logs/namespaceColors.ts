import type { AppLogLevel } from '../../logging/logger';

const LOG_NAMESPACE_BASE_COLORS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#ea580c',
  '#0891b2',
  '#9333ea',
] as const;

const LOG_NAMESPACE_BRIGHTNESS_SHIFT_STEP = 12;
const LOG_NAMESPACE_TILE_TINT_RATIO = 0.24;
const MIN_LIGHTNESS = 24;
const MAX_LIGHTNESS = 76;
const LOG_LEVEL_COLOR_ASSIGNMENTS: Record<
  AppLogLevel,
  LogNamespaceColorAssignment
> = {
  debug: {
    backgroundColor: '#4b5563',
    textColor: '#f8fafc',
  },
  error: {
    backgroundColor: '#7f1d1d',
    textColor: '#fee2e2',
  },
  info: {
    backgroundColor: '#d1d5db',
    textColor: '#111827',
  },
  temp: {
    backgroundColor: '#1d4ed8',
    textColor: '#dbeafe',
  },
  warn: {
    backgroundColor: '#854d0e',
    textColor: '#fef3c7',
  },
};

export type LogNamespaceColorAssignment = {
  backgroundColor: string;
  textColor: string;
};

export function assignMissingLogNamespaceColors(
  currentColors: Record<string, string>,
  namespaces: string[],
) {
  const nextColors = { ...currentColors };
  const seenNamespaces = new Set(Object.keys(currentColors));
  let assignedColorCount = Object.keys(currentColors).length;
  let didChange = false;

  for (const namespace of namespaces) {
    if (!isNonEmptyNamespace(namespace) || seenNamespaces.has(namespace)) {
      continue;
    }

    nextColors[namespace] = buildReservedNamespaceColor(assignedColorCount);
    seenNamespaces.add(namespace);
    assignedColorCount += 1;
    didChange = true;
  }

  return {
    colors: nextColors,
    didChange,
  };
}

export function buildLogNamespaceColorAssignment(backgroundColor: string) {
  return {
    backgroundColor,
    textColor: getReadableTextColor(backgroundColor),
  };
}

export function buildLogLevelColorAssignment(level: AppLogLevel) {
  return LOG_LEVEL_COLOR_ASSIGNMENTS[level];
}

export function buildNamespaceTintedTileBackgroundColor(
  namespaceBackgroundColor: string,
  tileSurfaceColor: string,
) {
  return blendHexColors(
    tileSurfaceColor,
    namespaceBackgroundColor,
    LOG_NAMESPACE_TILE_TINT_RATIO,
  );
}

export function buildReservedNamespaceColor(index: number) {
  const baseColor =
    LOG_NAMESPACE_BASE_COLORS[index % LOG_NAMESPACE_BASE_COLORS.length];
  const brightnessShift = getBrightnessShiftForCycle(
    Math.floor(index / LOG_NAMESPACE_BASE_COLORS.length),
  );

  return adjustHexColorLightness(baseColor, brightnessShift);
}

export function normalizeLogNamespaceColors(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      colors: {},
      hadInvalidEntries: value != null,
    };
  }

  const colors: Record<string, string> = {};
  let hadInvalidEntries = false;

  for (const [namespace, color] of Object.entries(value)) {
    if (!isNonEmptyNamespace(namespace) || !isHexColor(color)) {
      hadInvalidEntries = true;
      continue;
    }

    colors[namespace] = color.toLowerCase();
  }

  return {
    colors: hadInvalidEntries ? {} : colors,
    hadInvalidEntries,
  };
}

function getBrightnessShiftForCycle(cycle: number) {
  if (cycle === 0) {
    return 0;
  }

  const magnitude = Math.ceil(cycle / 2) * LOG_NAMESPACE_BRIGHTNESS_SHIFT_STEP;

  return cycle % 2 === 1 ? -magnitude : magnitude;
}

function adjustHexColorLightness(hexColor: string, deltaLightness: number) {
  const rgb = hexToRgb(hexColor);
  const hsl = rgbToHsl(rgb.red, rgb.green, rgb.blue);
  const nextLightness = clamp(
    hsl.lightness + deltaLightness,
    MIN_LIGHTNESS,
    MAX_LIGHTNESS,
  );

  return hslToHex(hsl.hue, hsl.saturation, nextLightness);
}

function getReadableTextColor(hexColor: string) {
  const { blue, green, red } = hexToRgb(hexColor);
  const relativeLuminance =
    (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;

  return relativeLuminance > 0.6 ? '#0f172a' : '#f8fafc';
}

function blendHexColors(
  baseHexColor: string,
  tintHexColor: string,
  tintRatio: number,
) {
  const baseColor = hexToRgb(baseHexColor);
  const tintColor = hexToRgb(tintHexColor);
  const ratio = clamp(tintRatio, 0, 1);
  const inverseRatio = 1 - ratio;

  return rgbToHex(
    Math.round(baseColor.red * inverseRatio + tintColor.red * ratio),
    Math.round(baseColor.green * inverseRatio + tintColor.green * ratio),
    Math.round(baseColor.blue * inverseRatio + tintColor.blue * ratio),
  );
}

function hexToRgb(hexColor: string) {
  const normalized = hexColor.replace('#', '');
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return { blue, green, red };
}

function rgbToHsl(red: number, green: number, blue: number) {
  const redFraction = red / 255;
  const greenFraction = green / 255;
  const blueFraction = blue / 255;
  const max = Math.max(redFraction, greenFraction, blueFraction);
  const min = Math.min(redFraction, greenFraction, blueFraction);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) {
    return {
      hue: 0,
      lightness: lightness * 100,
      saturation: 0,
    };
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue =
    max === redFraction
      ? ((greenFraction - blueFraction) / delta) % 6
      : max === greenFraction
        ? (blueFraction - redFraction) / delta + 2
        : (redFraction - greenFraction) / delta + 4;

  hue *= 60;

  if (hue < 0) {
    hue += 360;
  }

  return {
    hue,
    lightness: lightness * 100,
    saturation: saturation * 100,
  };
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const saturationFraction = saturation / 100;
  const lightnessFraction = lightness / 100;
  const chroma = (1 - Math.abs(2 * lightnessFraction - 1)) * saturationFraction;
  const huePrime = hue / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const match = lightnessFraction - chroma / 2;

  const [redPrime, greenPrime, bluePrime] =
    huePrime < 1
      ? [chroma, x, 0]
      : huePrime < 2
        ? [x, chroma, 0]
        : huePrime < 3
          ? [0, chroma, x]
          : huePrime < 4
            ? [0, x, chroma]
            : huePrime < 5
              ? [x, 0, chroma]
              : [chroma, 0, x];

  return rgbToHex(
    Math.round((redPrime + match) * 255),
    Math.round((greenPrime + match) * 255),
    Math.round((bluePrime + match) * 255),
  );
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue]
    .map((channel) => clamp(channel, 0, 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/iu.test(value);
}

function isNonEmptyNamespace(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
