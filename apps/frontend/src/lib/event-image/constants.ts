import { EVENT_IMAGE_TYPES } from "@packages/shared-schemas";

/** Same ratio as the banner on the event page (aspect-[21/9]), so the crop is exactly what gets shown. */
export const EVENT_IMAGE_ASPECT = 21 / 9;
/** Cropped output is scaled down to this width; larger sources are never kept at full resolution. */
export const EVENT_IMAGE_OUTPUT_MAX_WIDTH = 1680;
/** Source photos are re-encoded in the browser, so the picker can accept far more than the 5 MB upload cap. */
export const EVENT_IMAGE_SOURCE_MAX_BYTES = 20 * 1024 * 1024;
export const EVENT_IMAGE_ACCEPT = EVENT_IMAGE_TYPES.join(",");
