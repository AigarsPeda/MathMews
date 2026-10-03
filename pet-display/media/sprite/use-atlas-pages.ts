import { Skia, type SkImage } from "@shopify/react-native-skia";
import { useEffect, useState } from "react";
import { Image } from "react-native";

type DecodedPage = { page: number; image: SkImage };

/** Keep current/next pages; old images are released when Skia stops referencing them. */
export function useAtlasPages(sources: readonly number[], page: number, reverse: boolean, loop: boolean) {
  const [decoded, setDecoded] = useState<DecodedPage[]>([]);
  useEffect(() => {
    let cancelled = false;
    const next = page + (reverse ? -1 : 1);
    const nextPage = loop ? (next + sources.length) % sources.length : next;
    const wanted = [page];
    if (nextPage >= 0 && nextPage < sources.length && nextPage !== page) wanted.push(nextPage);
    async function load() {
      const images = await Promise.all(wanted.map(async index => {
        const cached = decoded.find(entry => entry.page === index);
        if (cached) return cached;
        const uri = Image.resolveAssetSource(sources[index]).uri;
        const data = await Skia.Data.fromURI(uri);
        const image = Skia.Image.MakeImageFromEncoded(data);
        if (!image) throw new Error(`Could not decode sprite page ${index}`);
        return { page: index, image };
      }));
      if (!cancelled) setDecoded(images);
    }
    void load().catch(error => console.error("Cat texture page failed", error));
    return () => { cancelled = true; };
    // The decoded list is a bounded cache, not a reason to reload the same pair.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop, page, reverse, sources]);
  return decoded;
}
