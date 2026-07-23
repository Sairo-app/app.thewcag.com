import type { CaptureEntry } from "../shared/desktop";
import { parseDoc } from "../lib/annotate/model";
import { renderDoc } from "../lib/annotate/render";
import { canvasPngDataUrl, requireCanvas2d } from "../lib/annotate/canvas";
import { desktop } from "./api";

function loadCaptureImage(entry: CaptureEntry): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("The selected capture could not be loaded"));
    image.src = entry.assetUrl;
  });
}

export async function renderCaptureDataUrl(
  entry: CaptureEntry,
  maxWidth?: number,
): Promise<string> {
  const [raw, image] = await Promise.all([
    desktop.invoke<string | null>("capture:read-document", { id: entry.id }),
    loadCaptureImage(entry),
  ]);
  const doc = parseDoc(raw || "");
  const source = document.createElement("canvas");
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  renderDoc(requireCanvas2d(source), image, doc?.shapes ?? [], {
    selectedId: null,
    forExport: true,
  });

  if (!maxWidth || source.width <= maxWidth) {
    return canvasPngDataUrl(source);
  }

  const output = document.createElement("canvas");
  const scale = maxWidth / source.width;
  output.width = maxWidth;
  output.height = Math.max(1, Math.round(source.height * scale));
  requireCanvas2d(output).drawImage(source, 0, 0, output.width, output.height);
  return canvasPngDataUrl(output);
}

export async function renderCaptureBase64(
  entry: CaptureEntry,
  maxWidth = 1600,
): Promise<string> {
  return (await renderCaptureDataUrl(entry, maxWidth)).split(",")[1] || "";
}
