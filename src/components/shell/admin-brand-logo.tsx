"use client";

import React, { useState } from "react";
import Image from "next/image";
import { cn } from "cn";

export function AdminBrandLogo({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        style={{ width: size, height: size }}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground",
          size >= 40 ? "text-base" : "text-sm",
          className
        )}
      >
        TY
      </div>
    );
  }

  return (
    <Image
      src="/brand/Logotipo_TaxiYa_Admin.png"
      alt="Logotipo TaxiYa Admin"
      width={size}
      height={size}
      unoptimized
      onError={() => setHasError(true)}
      className={cn("shrink-0 rounded-lg object-contain", className)}
    />
  );
}
