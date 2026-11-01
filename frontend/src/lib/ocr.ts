/**
 * On-device receipt reading with Tesseract.js. The engine and English model are served from our own site
 * (public/ocr, copied at install), loaded only when someone scans, and nothing is uploaded anywhere.
 */
export async function shrinkForOcr(file: Blob, maxSide = 1600): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.filter = 'grayscale(1) contrast(1.4)'; // receipts are black text on a pale background; this helps faded thermal paper
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas;
}

export interface OcrHandle {
  result: Promise<string>;
  cancel: () => void;
}

export function readReceipt(file: Blob, onProgress?: (fraction: number) => void): OcrHandle {
  let cancelled = false;
  let terminate: (() => Promise<unknown>) | null = null;

  const result = (async () => {
    const canvas = await shrinkForOcr(file);
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng', 1, {
      workerPath: '/ocr/worker.min.js',
      corePath: '/ocr',
      langPath: '/ocr/lang',
      gzip: true,
      logger: (m: { status?: string; progress?: number }) => {
        if (m.status === 'recognizing text' && typeof m.progress === 'number') onProgress?.(m.progress);
      },
    });
    terminate = () => worker.terminate();
    if (cancelled) {
      await worker.terminate();
      throw new Error('cancelled');
    }
    try {
      const { data } = await worker.recognize(canvas);
      return data.text;
    } finally {
      await worker.terminate().catch(() => undefined);
      terminate = null;
    }
  })();

  return {
    result,
    cancel: () => {
      cancelled = true;
      void terminate?.();
    },
  };
}
