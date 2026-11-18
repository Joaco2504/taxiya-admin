"use client";

import React, { useState } from "react";
import {
  AwardIcon,
  ClockIcon,
  MoonIcon,
  ShieldCheckIcon,
  StarIcon,
} from "lucide-react";
import {
  getBadgeCategoryMeta,
  getBadgeImagePath,
  getBadgeLevelMeta,
} from "@/lib/badges";
import type { DriverBadge } from "@/types/taxiya";

function CategoryVectorIcon({ code, size }: { code: string; size: number }) {
  const style = { width: size * 0.48, height: size * 0.48 };
  switch (code) {
    case "punctual":
      return <ClockIcon className="text-white" style={style} />;
    case "local_fav":
      return <StarIcon className="text-white" style={style} />;
    case "impeccable":
      return <ShieldCheckIcon className="text-white" style={style} />;
    case "night_shift":
      return <MoonIcon className="text-white" style={style} />;
    default:
      return <AwardIcon className="text-white" style={style} />;
  }
}

export function BadgeArtwork({
  code,
  level,
  size = 28,
}: {
  code: string;
  level: number | null | undefined;
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);
  const lvl = getBadgeLevelMeta(level);
  const cat = getBadgeCategoryMeta(code);
  const src = getBadgeImagePath(code, lvl.level);

  if (!imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`${cat?.label ?? code} nivel ${lvl.material}`}
        width={size}
        height={size}
        onError={() => setImgError(true)}
        className="shrink-0 object-contain"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      title={`${cat?.label ?? code} · Nivel ${lvl.material}`}
      className="relative inline-flex shrink-0 items-center justify-center rounded-full border border-white/75 shadow-xs"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${lvl.color}cc, ${lvl.color})`,
      }}
    >
      <CategoryVectorIcon code={code} size={size} />
    </span>
  );
}

export function DriverBadgePill({
  badge,
  compact = false,
}: {
  badge: DriverBadge;
  compact?: boolean;
}) {
  const cat = getBadgeCategoryMeta(badge.badge_code);
  const lvl = getBadgeLevelMeta(badge.level);

  return (
    <span
      className={
        compact
          ? "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
          : "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold"
      }
      style={{
        borderColor: `${lvl.color}88`,
        backgroundColor: `${lvl.color}18`,
      }}
    >
      <BadgeArtwork
        code={badge.badge_code}
        level={lvl.level}
        size={compact ? 16 : 20}
      />
      <span>
        {cat?.label ?? badge.badge_code} · {lvl.material}
      </span>
    </span>
  );
}
