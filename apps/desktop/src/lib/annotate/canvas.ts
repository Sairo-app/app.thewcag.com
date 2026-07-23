export const CAPTURE_CANVAS_ERROR =
  "This capture is too large for the annotation canvas. Capture a smaller area and try again.";

export function requireCanvas2d(
  canvas: HTMLCanvasElement,
  options?: CanvasRenderingContext2DSettings,
): CanvasRenderingContext2D {
  const context = canvas.getContext("2d", options);
  if (!context) throw new Error(CAPTURE_CANVAS_ERROR);
  return context;
}

export function canvasPngDataUrl(canvas: HTMLCanvasElement): string {
  let dataUrl: string;
  try {
    dataUrl = canvas.toDataURL("image/png");
  } catch {
    throw new Error(CAPTURE_CANVAS_ERROR);
  }
  if (!/^data:image\/png;base64,[a-zA-Z0-9+/]+={0,2}$/.test(dataUrl)) {
    throw new Error(CAPTURE_CANVAS_ERROR);
  }
  return dataUrl;
}
