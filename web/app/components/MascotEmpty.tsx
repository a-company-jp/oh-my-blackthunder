"use client";

// A mascot + message used on empty states. Defaults to "niko".
import Image from "next/image";

export type Mascot = "niko" | "ike" | "gusu" | "wi";

const MASCOT_SRC: Record<Mascot, string> = {
  niko: "/assets/monster/niko.png",
  ike: "/assets/monster/ike.png",
  gusu: "/assets/monster/gusu.png",
  wi: "/assets/monster/wi.png",
};

interface MascotEmptyProps {
  mascot?: Mascot;
  title: string;
  subtitle?: string;
  size?: number;
  children?: React.ReactNode;
}

export function MascotEmpty({
  mascot = "niko",
  title,
  subtitle,
  size = 128,
  children,
}: MascotEmptyProps) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      <Image
        src={MASCOT_SRC[mascot]}
        alt=""
        width={size}
        height={size}
        className="bt-monster animate-boltDrop drop-shadow-[0_8px_0_rgba(0,0,0,0.6)]"
        priority={false}
      />
      <p className="font-display text-xl font-extrabold text-thunder-white sm:text-2xl">
        {title}
      </p>
      {subtitle ? (
        <p className="max-w-sm text-sm text-white/60">{subtitle}</p>
      ) : null}
      {children}
    </div>
  );
}
