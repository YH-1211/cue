// 東京の主要エリアの代表点 (近似)
// events.area の値と対応させる
export type AreaName =
  | "千代田"
  | "中央"
  | "港"
  | "新宿"
  | "文京"
  | "台東"
  | "墨田"
  | "江東"
  | "品川"
  | "目黒"
  | "大田"
  | "世田谷"
  | "渋谷"
  | "中野"
  | "杉並"
  | "豊島"
  | "北"
  | "荒川"
  | "板橋"
  | "練馬"
  | "足立"
  | "葛飾"
  | "江戸川";

export const AREA_COORDS: Record<AreaName, { lat: number; lng: number }> = {
  千代田: { lat: 35.6940, lng: 139.7536 },
  中央: { lat: 35.6706, lng: 139.7720 },
  港: { lat: 35.6580, lng: 139.7515 },
  新宿: { lat: 35.6938, lng: 139.7036 },
  文京: { lat: 35.7081, lng: 139.7524 },
  台東: { lat: 35.7126, lng: 139.7800 },
  墨田: { lat: 35.7106, lng: 139.8016 },
  江東: { lat: 35.6731, lng: 139.8170 },
  品川: { lat: 35.6092, lng: 139.7301 },
  目黒: { lat: 35.6415, lng: 139.6982 },
  大田: { lat: 35.5614, lng: 139.7161 },
  世田谷: { lat: 35.6464, lng: 139.6533 },
  渋谷: { lat: 35.6640, lng: 139.6982 },
  中野: { lat: 35.7074, lng: 139.6638 },
  杉並: { lat: 35.6996, lng: 139.6363 },
  豊島: { lat: 35.7263, lng: 139.7155 },
  北: { lat: 35.7528, lng: 139.7336 },
  荒川: { lat: 35.7361, lng: 139.7833 },
  板橋: { lat: 35.7515, lng: 139.7093 },
  練馬: { lat: 35.7357, lng: 139.6517 },
  足立: { lat: 35.7750, lng: 139.8044 },
  葛飾: { lat: 35.7434, lng: 139.8474 },
  江戸川: { lat: 35.7066, lng: 139.8683 },
};

// ハバーシン距離 (km)
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// エリア名 → 距離 (km) のマップを返す
export function nearbyAreas(
  origin: { lat: number; lng: number },
  maxKm: number
): { area: AreaName; km: number }[] {
  const result: { area: AreaName; km: number }[] = [];
  for (const [area, coords] of Object.entries(AREA_COORDS) as [
    AreaName,
    { lat: number; lng: number }
  ][]) {
    const km = distanceKm(origin, coords);
    if (km <= maxKm) result.push({ area, km });
  }
  result.sort((a, b) => a.km - b.km);
  return result;
}
