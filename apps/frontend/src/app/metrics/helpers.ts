/** Splits an uptime in seconds into the parts the (translated) "{days}d {hours}h {minutes}m" message needs. */
export function getUptimeParts(seconds: number) {
    return {
        days: Math.floor(seconds / 86400),
        hours: Math.floor((seconds % 86400) / 3600),
        minutes: Math.floor((seconds % 3600) / 60),
    };
}
