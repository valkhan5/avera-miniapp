export const TASHKENT_BBOX = { minLat: 41.17, maxLat: 41.45, minLng: 69.12, maxLng: 69.47 };
export const TASHKENT_CENTER = { lat: 41.3111, lng: 69.2797 };

export function isInTashkent(lat: number, lng: number): boolean {
  const b = TASHKENT_BBOX;
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}
