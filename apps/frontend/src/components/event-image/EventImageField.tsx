"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";
import type { EventImageType } from "@packages/shared-schemas";
import { useTranslations } from "next-intl";
import { orpc } from "@/lib/orpc/query";
import { useToast } from "@/lib/toast/toast-context";
import { Button } from "@/components/ui/button";
import { EVENT_IMAGE_ACCEPT, EVENT_IMAGE_ASPECT } from "@/lib/event-image/constants";
import { postToS3, S3UploadError, validateSourceFile } from "@/lib/event-image/upload";
import { ImageCropDialog } from "./ImageCropDialog";

interface Props {
    /** Called with the upload key once the image is in S3, or `undefined` when it is removed. */
    onChange: (uploadKey: string | undefined) => void;
}

/**
 * Pick -> crop/zoom -> upload straight to S3. The API only signs the upload; the bytes never pass
 * through it. The form submits the returned key, and the API attaches the file when the event is saved.
 */
export function EventImageField({ onChange }: Props) {
    const t = useTranslations("CreateEvent");
    const { addToast } = useToast();
    const inputRef = useRef<HTMLInputElement>(null);
    const [source, setSource] = useState<string | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const createUpload = useMutation(orpc.events.createImageUpload.mutationOptions());

    // Object URLs hold the file in memory until revoked.
    useEffect(() => () => void (source && URL.revokeObjectURL(source)), [source]);
    useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

    const onPick = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            e.target.value = ""; // picking the same file again must still fire onChange
            if (!file) return;

            const problem = validateSourceFile(file);
            if (problem) {
                addToast({ message: t(problem === "type" ? "imageInvalidType" : "imageTooLarge"), type: "error" });
                return;
            }
            setSource(URL.createObjectURL(file));
        },
        [addToast, t],
    );

    const upload = useCallback(
        async (blob: Blob) => {
            try {
                const { data } = await createUpload.mutateAsync({
                    contentType: blob.type as EventImageType,
                    size: blob.size,
                });
                await postToS3(data, blob);
                setPreview(URL.createObjectURL(blob));
                onChange(data.key);
                setSource(null);
            } catch (err) {
                // Dialog stays open so the user can retry without re-cropping.
                const detail = err instanceof S3UploadError ? err.message : (err as Error)?.message;
                addToast({ message: t("imageUploadFailed", { error: detail || t("unknownError") }), type: "error" });
            }
        },
        [createUpload, onChange, addToast, t],
    );

    const remove = () => {
        setPreview(null);
        onChange(undefined);
    };

    return (
        <div className="space-y-3">
            <div
                className="relative flex w-full items-center justify-center overflow-hidden rounded-md border bg-muted/40"
                style={{ aspectRatio: EVENT_IMAGE_ASPECT }}
            >
                {preview ? (
                    <img src={preview} alt={t("imagePreviewAlt")} className="size-full object-cover" />
                ) : (
                    <ImageIcon className="size-8 text-muted-foreground" aria-hidden />
                )}
            </div>

            <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                    {preview ? t("imageReplace") : t("imageChoose")}
                </Button>
                {preview && (
                    <Button type="button" variant="ghost" size="sm" onClick={remove}>
                        {t("imageRemove")}
                    </Button>
                )}
                <input
                    ref={inputRef}
                    type="file"
                    accept={EVENT_IMAGE_ACCEPT}
                    onChange={onPick}
                    className="sr-only"
                    aria-label={t("image")}
                    data-testid="event-image-input"
                />
            </div>

            <ImageCropDialog key={source ?? "closed"} src={source} onApply={upload} onCancel={() => setSource(null)} />
        </div>
    );
}
