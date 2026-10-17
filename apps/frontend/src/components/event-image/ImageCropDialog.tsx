"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { EVENT_IMAGE_ASPECT } from "@/lib/event-image/constants";
import { cropImageToBlob } from "@/lib/event-image/crop-image";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

interface Props {
    /** Object URL of the picked file; the dialog is open while this is set. */
    src: string | null;
    /** Receives the cropped image. The dialog stays open (busy) until this settles, so a failed upload can be retried. */
    onApply: (blob: Blob) => Promise<void>;
    onCancel: () => void;
}

export function ImageCropDialog({ src, onApply, onCancel }: Props) {
    const t = useTranslations("CreateEvent");
    const tc = useTranslations("Common");
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(MIN_ZOOM);
    const [area, setArea] = useState<Area | null>(null);
    const [busy, setBusy] = useState(false);

    const apply = useCallback(async () => {
        if (!src || !area) return;
        setBusy(true);
        try {
            await onApply(await cropImageToBlob(src, area));
        } finally {
            setBusy(false);
        }
    }, [src, area, onApply]);

    return (
        <Dialog open={src !== null} onOpenChange={open => !open && !busy && onCancel()}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t("imageCropTitle")}</DialogTitle>
                    <DialogDescription>{t("imageCropHelp")}</DialogDescription>
                </DialogHeader>

                {/* react-easy-crop positions itself against the nearest positioned ancestor. */}
                <div
                    className="relative h-72 w-full overflow-hidden rounded-md border bg-muted sm:h-96"
                    data-testid="crop-area"
                >
                    {src && (
                        <Cropper
                            image={src}
                            crop={crop}
                            zoom={zoom}
                            minZoom={MIN_ZOOM}
                            maxZoom={MAX_ZOOM}
                            aspect={EVENT_IMAGE_ASPECT}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={(_, pixels) => setArea(pixels)}
                        />
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <label htmlFor="image-zoom" className="text-sm text-muted-foreground">
                        {t("imageZoom")}
                    </label>
                    <input
                        id="image-zoom"
                        type="range"
                        min={MIN_ZOOM}
                        max={MAX_ZOOM}
                        step={0.01}
                        value={zoom}
                        disabled={busy}
                        onChange={e => setZoom(Number(e.target.value))}
                        className="h-1.5 flex-1 cursor-pointer accent-primary"
                    />
                </div>

                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
                        {tc("cancel")}
                    </Button>
                    <Button type="button" onClick={apply} disabled={busy || !area}>
                        {busy && <Spinner />}
                        {busy ? t("imageUploading") : t("imageApply")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
