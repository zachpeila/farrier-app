/** Distances and map links for the day route. No maps API key needed. */

type Point = { latitude: number; longitude: number };

const EARTH_KM = 6371;

/** Roads wind; straight-line distance times this is a fair rural driving estimate. */
const ROAD_FACTOR = 1.3;

function straightKm(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

type MaybePoint = { latitude: number | null; longitude: number | null } | null | undefined;

/** Estimated driving km between two pinned barns, or null if either isn't pinned. */
export function drivingKm(a: MaybePoint, b: MaybePoint): number | null {
  if (a?.latitude == null || a.longitude == null || b?.latitude == null || b.longitude == null) return null;
  const from: Point = { latitude: a.latitude, longitude: a.longitude };
  const to: Point = { latitude: b.latitude, longitude: b.longitude };
  return Math.round(straightKm(from, to) * ROAD_FACTOR * 10) / 10;
}

export function formatDistance(km: number, unit: string): string {
  if (unit === 'mi') return `${(km * 0.621371).toFixed(1)} mi`;
  return `${km.toFixed(1)} km`;
}

type Stop = { latitude: number | null; longitude: number | null; address: string | null; name: string };

function place(s: Stop): string {
  if (s.latitude != null && s.longitude != null) return `${s.latitude},${s.longitude}`;
  return s.address || s.name;
}

/** Google Maps directions from the current location through every stop, in order. */
export function mapsRouteUrl(stops: Stop[]): string | null {
  if (stops.length === 0) return null;
  const destination = place(stops[stops.length - 1]);
  const waypoints = stops.slice(0, -1).map(place);
  const params = new URLSearchParams({ api: '1', destination, travelmode: 'driving' });
  if (waypoints.length) params.set('waypoints', waypoints.join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
