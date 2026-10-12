// Average colour of an image, weighted towards saturated pixels so the
// now-playing backdrop picks up the artwork's hue rather than its greys.
const cache = new Map();

export function dominantColor(src) {
  if (!src) return Promise.resolve(null);
  if (cache.has(src)) return Promise.resolve(cache.get(src));
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 24;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let r = 0, g = 0, b = 0, weight = 0;
        for (let i = 0; i < data.length; i += 4) {
          const max = Math.max(data[i], data[i + 1], data[i + 2]);
          const min = Math.min(data[i], data[i + 1], data[i + 2]);
          const saturation = max === 0 ? 0 : (max - min) / max;
          const w = 0.15 + saturation;
          r += data[i] * w; g += data[i + 1] * w; b += data[i + 2] * w; weight += w;
        }
        const color = weight ? [r / weight, g / weight, b / weight].map(Math.round) : null;
        cache.set(src, color);
        resolve(color);
      } catch {
        resolve(null); // tainted canvas or unsupported: fall back to the default backdrop
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
