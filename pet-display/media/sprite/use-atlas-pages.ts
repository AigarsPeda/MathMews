import { Skia, type SkImage } from "@shopify/react-native-skia";
import { useEffect, useRef, useState } from "react";
import { Image } from "react-native";

type DecodedPage = { page: number; source: number; image: SkImage };

async function decodePage(source: number): Promise<SkImage> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const data = await Skia.Data.fromURI(Image.resolveAssetSource(source).uri);
        const image = Skia.Image.MakeImageFromEncoded(data);
        if (!image) throw new Error("Could not decode cat texture");
        return image;
      })(),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Cat texture timed out")), 5000); }),
    ]);
  } finally { clearTimeout(timeout); }
}

/** Current texture is usable even if speculative prefetch fails. Cache at most two pages. */
export function useAtlasPages(sources: readonly number[], page: number, reverse: boolean, loop: boolean, onFailure?: () => void) {
  const [decoded, setDecoded] = useState<DecodedPage[]>([]);
  const cache = useRef<DecodedPage[]>([]);
  const failure = useRef(onFailure);
  useEffect(() => { failure.current = onFailure; }, [onFailure]);
  useEffect(() => {
    if (sources.length === 0) return;
    let cancelled = false;
    const next = page + (reverse ? -1 : 1);
    const nextPage = loop ? (next + sources.length) % sources.length : next;
    const wanted = [page];
    if (nextPage >= 0 && nextPage < sources.length && nextPage !== page) wanted.push(nextPage);
    const load = async (index: number) => {
      const source = sources[index];
      const cached = cache.current.find(entry => entry.source === source && entry.page === index);
      let image = cached?.image;
      for (let attempt = 0; !image && attempt < 2; attempt++) {
        try { image = await decodePage(source); } catch { /* One retry, then semantic recovery. */ }
        if (cancelled) return;
      }
      if (!image) { if (index === page && !cancelled) failure.current?.(); return; }
      if (cancelled) return;
      const entries = cache.current.filter(entry => entry.page !== index && wanted.includes(entry.page) && entry.source === sources[entry.page]);
      cache.current = [...entries, { page: index, source, image }];
      setDecoded(cache.current);
    };
    wanted.forEach(index => { void load(index); });
    return () => { cancelled = true; };
  }, [loop, page, reverse, sources]);
  return decoded.filter(entry => entry.source === sources[entry.page]);
}
