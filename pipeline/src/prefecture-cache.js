import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

// 都道府県単位でOverpassの生elementsをディスクにキャッシュし、失敗後の再実行で
// 既に成功した都道府県への再リクエストを避けられるようにする(レート制限下での再試行を減らす)。
// キャッシュはPMTiles等と同じ`out/`配下に置き、`rm -rf out`で他の生成物と一緒に破棄できるようにする。
export function createPrefectureCache(cacheDir) {
  function pathFor(prefectureCode) {
    return path.join(cacheDir, `${prefectureCode}.json`);
  }

  // 壊れた/不正なキャッシュ(書き込み中断等)はキャッシュミス扱いにして再取得する。
  async function read(prefectureCode) {
    try {
      const raw = await readFile(pathFor(prefectureCode), "utf8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // 一時ファイルへ書いてからrenameすることで、プロセスが書き込み途中に
  // 中断されても破損したキャッシュファイルを残さないようにする。
  async function write(prefectureCode, elements) {
    await mkdir(cacheDir, { recursive: true });
    const finalPath = pathFor(prefectureCode);
    const tmpPath = `${finalPath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(elements));
    await rename(tmpPath, finalPath);
  }

  return { read, write };
}
