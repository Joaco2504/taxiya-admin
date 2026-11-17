export interface Coordinates {
  lat: number;
  lng: number;
}

export const DEFAULT_LOCALITY_COORDS: Record<string, Coordinates> = {
  belen: { lat: -27.6514, lng: -67.0286 },
  andalgala: { lat: -27.5819, lng: -66.3161 },
  catamarca: { lat: -27.615, lng: -66.67 },
};

function hexToBytes(hex: string): Uint8Array | null {
  const clean = hex.trim();
  if (clean.length < 42 || clean.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(clean)) {
    return null;
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Decodifica puntos PostGIS devueltos por PostgREST/Realtime en WKB hex, GeoJSON o WKT.
 */
export function parsePostGISPoint(value: unknown): Coordinates | null {
  if (!value) return null;

  if (typeof value === "object" && value !== null) {
    const obj = value as { type?: string; coordinates?: unknown; lat?: unknown; lng?: unknown };
    if (
      obj.type === "Point" &&
      Array.isArray(obj.coordinates) &&
      obj.coordinates.length >= 2 &&
      typeof obj.coordinates[0] === "number" &&
      typeof obj.coordinates[1] === "number"
    ) {
      return { lng: obj.coordinates[0], lat: obj.coordinates[1] };
    }
    if (typeof obj.lat === "number" && typeof obj.lng === "number") {
      return { lat: obj.lat, lng: obj.lng };
    }
  }

  if (typeof value !== "string") return null;

  // WKT: POINT(lng lat) o SRID=4326;POINT(lng lat)
  const wktMatch = value.match(/POINT\s*\(\s*([-+]?\d+(?:\.\d+)?)\s+([-+]?\d+(?:\.\d+)?)\s*\)/i);
  if (wktMatch) {
    const lng = Number(wktMatch[1]);
    const lat = Number(wktMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }

  // WKB / EWKB hex (PostgREST default)
  const bytes = hexToBytes(value);
  if (bytes) {
    const view = new DataView(bytes.buffer);
    const littleEndian = bytes[0] === 1;
    const geomType = view.getUint32(1, littleEndian);
    const hasSrid = (geomType & 0x20000000) !== 0;
    const baseType = geomType & 0x000000ff;
    const offset = hasSrid ? 9 : 5;
    if (baseType === 1 && bytes.byteLength >= offset + 16) {
      const lng = view.getFloat64(offset, littleEndian);
      const lat = view.getFloat64(offset + 8, littleEndian);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }
  }

  return null;
}

export function toPostGISPoint(lat: number, lng: number): string {
  return `SRID=4326;POINT(${lng} ${lat})`;
}

export function getLocalityViewport(localityName?: string | null): {
  latitude: number;
  longitude: number;
  zoom: number;
} {
  if (!localityName) {
    return {
      latitude: DEFAULT_LOCALITY_COORDS.catamarca.lat,
      longitude: DEFAULT_LOCALITY_COORDS.catamarca.lng,
      zoom: 9.2,
    };
  }
  const normalized = localityName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalized.includes("belen")) {
    return {
      latitude: DEFAULT_LOCALITY_COORDS.belen.lat,
      longitude: DEFAULT_LOCALITY_COORDS.belen.lng,
      zoom: 13.5,
    };
  }
  if (normalized.includes("andalgala")) {
    return {
      latitude: DEFAULT_LOCALITY_COORDS.andalgala.lat,
      longitude: DEFAULT_LOCALITY_COORDS.andalgala.lng,
      zoom: 13.5,
    };
  }
  return {
    latitude: DEFAULT_LOCALITY_COORDS.catamarca.lat,
    longitude: DEFAULT_LOCALITY_COORDS.catamarca.lng,
    zoom: 10,
  };
}
