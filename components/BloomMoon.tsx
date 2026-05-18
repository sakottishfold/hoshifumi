// ADR-019 worldview: 今日の体感(MoonPhase)を bloom + glow で「灯る」感覚にする。
// milestone 初到達時のみ周囲に generic 小光が staggered fade-in(burst)。
// motion は α 厳格(no slide/bounce)、CSS keyframes は app/globals.css 定義。
// a11y: prefers-reduced-motion で全 animation 無効、static 表示にフォールバック。

import { MoonPhase } from "@/components/MoonPhase";

export interface BloomBurst {
  /** small light の個数(3 / 5 / 7) */
  count: number;
  /** tier 名、glow ハロー強度に影響 */
  tier: "small" | "medium" | "large";
  /** ランダム配置の seed(total entries を渡す、再現性確保) */
  seed: number;
}

interface Props {
  /** 1-5: 今日の Q1 body sensation phase */
  phase: 1 | 2 | 3 | 4 | 5;
  /** milestone 初到達時のみ指定、undefined なら常時演出のみ */
  burst?: BloomBurst;
  /** hero サイズの Tailwind class(default "w-20 h-20"=80px) */
  className?: string;
}

// 決定的な擬似乱数(seed から index ごとに角度・距離を返す)
// 同じ seed で同じ配置になる ─ レンダー再現性確保
function placeSmallLight(seed: number, index: number, total: number) {
  // 360 度を total 等分、seed で開始角度を回転、小さい乱数で揺らぎ
  const baseAngle = (360 / total) * index;
  const seedShift = (seed * 47 + index * 13) % 360;
  const jitter = ((seed * 31 + index * 17) % 21) - 10; // ±10度
  const angle = (baseAngle + seedShift + jitter) % 360;

  // 距離(中心からの半径、80-130px の範囲)
  const radius = 80 + ((seed * 23 + index * 7) % 50);

  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) * radius;
  const y = Math.sin(rad) * radius;
  return { x, y };
}

const BURST_STAGGER_MS = 100; // small light を 100ms 間隔で stagger
const BURST_START_DELAY_MS = 1700; // bloom 1500ms + 200ms 待機

export function BloomMoon({
  phase,
  burst,
  className = "w-20 h-20",
}: Props) {
  return (
    <div className="relative inline-flex items-center justify-center">
      {burst &&
        Array.from({ length: burst.count }).map((_, i) => {
          const { x, y } = placeSmallLight(burst.seed, i, burst.count);
          const size =
            burst.tier === "large" ? 10 : burst.tier === "medium" ? 8 : 6;
          const delay = BURST_START_DELAY_MS + i * BURST_STAGGER_MS;
          return (
            <span
              key={`burst-${burst.seed}-${i}`}
              className="absolute rounded-full bg-primary-500 fade-in-soft-animate pointer-events-none"
              style={{
                top: "50%",
                left: "50%",
                width: `${size}px`,
                height: `${size}px`,
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                animationDelay: `${delay}ms`,
                boxShadow: `0 0 ${size * 1.5}px rgba(245, 212, 154, 0.6)`,
              }}
              aria-hidden="true"
            />
          );
        })}

      <div className={`bloom-animate ${className}`}>
        <div className="glow-animate w-full h-full">
          <MoonPhase phase={phase} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
}
