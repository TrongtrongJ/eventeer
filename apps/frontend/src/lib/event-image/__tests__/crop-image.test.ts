import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cropImageToBlob, outputSize } from "../crop-image";

describe("outputSize", () => {
    it("keeps the crop's size when it is already small enough", () => {
        expect(outputSize({ x: 0, y: 0, width: 840, height: 360 })).toEqual({ width: 840, height: 360 });
    });

    it("scales a large crop down to the max width, preserving the aspect ratio", () => {
        expect(outputSize({ x: 0, y: 0, width: 3360, height: 1440 })).toEqual({ width: 1680, height: 720 });
    });

    it("never scales up", () => {
        expect(outputSize({ x: 0, y: 0, width: 100, height: 43 }, 1680)).toEqual({ width: 100, height: 43 });
    });

    it("honours a custom max width and never returns a zero dimension", () => {
        expect(outputSize({ x: 0, y: 0, width: 2000, height: 1 }, 100)).toEqual({ width: 100, height: 1 });
    });
});

describe("cropImageToBlob", () => {
    const crop = { x: 100, y: 50, width: 2100, height: 900 }; // scales by 0.8 to 1680x720

    let drawn: unknown[][];
    let calls: string[];
    let encoders: Record<string, Blob | null>;
    let ctx: Record<string, unknown> | null;

    beforeEach(() => {
        drawn = [];
        calls = [];
        encoders = {
            "image/webp": new Blob(["w"], { type: "image/webp" }),
            "image/jpeg": new Blob(["j"], { type: "image/jpeg" }),
        };
        ctx = {
            fillStyle: "",
            fillRect: (...a: unknown[]) => calls.push(`fill:${a.join(",")}`),
            drawImage: (...a: unknown[]) => drawn.push(a),
        };

        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ctx) as never);
        vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(((cb: BlobCallback, type?: string) =>
            cb(encoders[type ?? ""] ?? null)) as never);

        // jsdom never loads images: complete the load as soon as `src` is assigned.
        vi.stubGlobal(
            "Image",
            class {
                onload: (() => void) | null = null;
                onerror: (() => void) | null = null;
                set src(value: string) {
                    queueMicrotask(() => (value.includes("broken") ? this.onerror?.() : this.onload?.()));
                }
            },
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("draws the selected area scaled into the output canvas and encodes WebP", async () => {
        const blob = await cropImageToBlob("blob:ok", crop);

        expect(blob.type).toBe("image/webp");
        expect(drawn).toHaveLength(1);
        expect(drawn[0].slice(1)).toEqual([100, 50, 2100, 900, 0, 0, 1680, 720]);
    });

    it("flattens onto white first, so a transparent PNG does not go black as JPEG", async () => {
        await cropImageToBlob("blob:ok", crop);
        expect(calls).toEqual(["fill:0,0,1680,720"]);
        expect(ctx!.fillStyle).toBe("#fff");
    });

    it("falls back to JPEG when the browser can't encode WebP (it hands back a PNG instead)", async () => {
        encoders["image/webp"] = new Blob(["p"], { type: "image/png" });
        expect((await cropImageToBlob("blob:ok", crop)).type).toBe("image/jpeg");

        encoders["image/webp"] = null;
        expect((await cropImageToBlob("blob:ok", crop)).type).toBe("image/jpeg");
    });

    it("only ever yields a type the API accepts", async () => {
        expect(["image/webp", "image/jpeg"]).toContain((await cropImageToBlob("blob:ok", crop)).type);
    });

    it("fails clearly when nothing can encode, when 2D canvas is missing, or the source won't load", async () => {
        encoders = {};
        await expect(cropImageToBlob("blob:ok", crop)).rejects.toThrow(/encode/);

        ctx = null;
        await expect(cropImageToBlob("blob:ok", crop)).rejects.toThrow(/Canvas/);

        await expect(cropImageToBlob("blob:broken", crop)).rejects.toThrow(/read the image/);
    });
});
