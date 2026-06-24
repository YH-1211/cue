// 関東の主要エリア(市区)の代表点 (近似)
// events.area の値と対応させる。都県 → 市区 の2階層。

export const PREFECTURES = ["東京", "神奈川", "埼玉", "千葉"] as const;
export type Prefecture = (typeof PREFECTURES)[number];

type Coord = { lat: number; lng: number };

// 都県ごとのエリア → 代表点。宣言順がそのままUIの表示順になる。
export const AREAS_BY_PREFECTURE = {
  東京: {
    千代田: { lat: 35.694, lng: 139.7536 },
    中央: { lat: 35.6706, lng: 139.772 },
    港: { lat: 35.658, lng: 139.7515 },
    新宿: { lat: 35.6938, lng: 139.7036 },
    文京: { lat: 35.7081, lng: 139.7524 },
    台東: { lat: 35.7126, lng: 139.78 },
    墨田: { lat: 35.7106, lng: 139.8016 },
    江東: { lat: 35.6731, lng: 139.817 },
    品川: { lat: 35.6092, lng: 139.7301 },
    目黒: { lat: 35.6415, lng: 139.6982 },
    大田: { lat: 35.5614, lng: 139.7161 },
    世田谷: { lat: 35.6464, lng: 139.6533 },
    渋谷: { lat: 35.664, lng: 139.6982 },
    中野: { lat: 35.7074, lng: 139.6638 },
    杉並: { lat: 35.6996, lng: 139.6363 },
    豊島: { lat: 35.7263, lng: 139.7155 },
    北: { lat: 35.7528, lng: 139.7336 },
    荒川: { lat: 35.7361, lng: 139.7833 },
    板橋: { lat: 35.7515, lng: 139.7093 },
    練馬: { lat: 35.7357, lng: 139.6517 },
    足立: { lat: 35.775, lng: 139.8044 },
    葛飾: { lat: 35.7434, lng: 139.8474 },
    江戸川: { lat: 35.7066, lng: 139.8683 },
    八王子: { lat: 35.6664, lng: 139.316 },
    立川: { lat: 35.7138, lng: 139.4079 },
    武蔵野: { lat: 35.7178, lng: 139.5662 },
    府中: { lat: 35.6717, lng: 139.4778 },
    調布: { lat: 35.6516, lng: 139.541 },
    町田: { lat: 35.5468, lng: 139.4386 },
    日野: { lat: 35.6712, lng: 139.395 },
    青梅: { lat: 35.788, lng: 139.2757 },
    武蔵村山: { lat: 35.7549, lng: 139.3873 },
    稲城: { lat: 35.6378, lng: 139.5046 },
  },
  神奈川: {
    横浜: { lat: 35.4437, lng: 139.638 },
    川崎: { lat: 35.5308, lng: 139.7029 },
    鎌倉: { lat: 35.3192, lng: 139.5466 },
    藤沢: { lat: 35.3391, lng: 139.4896 },
    横須賀: { lat: 35.2815, lng: 139.6722 },
    相模原: { lat: 35.5714, lng: 139.3736 },
    箱根: { lat: 35.2324, lng: 139.1069 },
  },
  埼玉: {
    さいたま: { lat: 35.8617, lng: 139.6455 },
    川越: { lat: 35.9251, lng: 139.4858 },
    所沢: { lat: 35.7993, lng: 139.469 },
    秩父: { lat: 35.9916, lng: 139.0857 },
  },
  千葉: {
    千葉: { lat: 35.6073, lng: 140.1063 },
    幕張: { lat: 35.6488, lng: 140.0349 },
    船橋: { lat: 35.6947, lng: 139.9826 },
    浦安: { lat: 35.6536, lng: 139.902 },
    成田: { lat: 35.7766, lng: 140.3185 },
    木更津: { lat: 35.376, lng: 139.9168 },
  },
} satisfies Record<Prefecture, Record<string, Coord>>;

// 全エリア名のユニオン (都県をまたいで重複しない前提)
export type AreaName = {
  [P in Prefecture]: keyof (typeof AREAS_BY_PREFECTURE)[P];
}[Prefecture];

// フラットなエリア名 → 代表点。距離計算など既存ロジック用。
export const AREA_COORDS = {
  ...AREAS_BY_PREFECTURE.東京,
  ...AREAS_BY_PREFECTURE.神奈川,
  ...AREAS_BY_PREFECTURE.埼玉,
  ...AREAS_BY_PREFECTURE.千葉,
} as Record<AreaName, Coord>;

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
