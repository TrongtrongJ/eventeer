type ToastType = "success" | "info" | "error";

const toastColorMap = new Map<ToastType, string>([
    ["success", "bg-green-500"],
    ["error", "bg-red-500"],
    ["info", "bg-blue-500"],
]);

export function getToastColor(toastType: ToastType) {
    return toastColorMap.get(toastType);
}
