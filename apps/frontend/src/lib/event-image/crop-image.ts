import { EVENT_IMAGE_OUTPUT_MAX_WIDTH } from "./constants";

export interface PixelCrop {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Output dimensions: the crop's own size, scaled down (never up) to `maxWidth`. */
export function outputSize(crop: PixelCrop, maxWidth = EVENT_IMAGE_OUTPUT_MAX_WIDTH) {
    const scale = Math.min(1, maxWidth / crop.width);
    return {
        width: Math.max(1, Math.round(crop.width * scale)),
        height: Math.max(1, Math.round(crop.height * scale)),
    };
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Could not read the image"));
        img.src = src;
    });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
    return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

/**
 * Renders the selected area to a Blob the API accepts. WebP where the browser can encode it
 * (Safari cannot and silently hands back a PNG), JPEG otherwise. The result is flattened onto
 * white, so a transparent PNG does not turn black when it falls back to JPEG.
 */
export async function cropImageToBlob(
    src: string,
    crop: PixelCrop,
    maxWidth = EVENT_IMAGE_OUTPUT_MAX_WIDTH,
): Promise<Blob> {
    const image = await loadImage(src);
    const { width, height } = outputSize(crop, maxWidth);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available in this browser");

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);

    let blob = await toBlob(canvas, "image/webp", 0.85);
    if (blob?.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", 0.88);
    if (!blob) throw new Error("Could not encode the image");
    return blob;
}
