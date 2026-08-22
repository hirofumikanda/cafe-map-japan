// Web Mercatorのスロッピーマップ座標系(z/x/y)への変換。
// https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
export function lonLatToTile(lon, lat, zoom) {
  const n = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { z: zoom, x, y };
}
