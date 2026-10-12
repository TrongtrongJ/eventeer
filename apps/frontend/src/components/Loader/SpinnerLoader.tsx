import React from "react";
import { Spinner } from "@/components/ui/spinner";

interface SpinnerLoaderProps {
    message?: string;
}

const SpinnerLoader: React.FC<SpinnerLoaderProps> = ({ message }) => (
    <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
        <Spinner className="size-5" />
        {message && <p className="text-sm">{message}</p>}
    </div>
);

export default SpinnerLoader;
