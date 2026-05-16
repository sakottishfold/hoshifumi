// 月相アイコン:身体感覚タップの選択肢として、また calendar / 詳細画面の表示として使う。
// phase: 1=新月(重たい)/ 2=三日月(ざわざわ)/ 3=上弦(ふつう)/ 4=十三夜(軽い)/ 5=満月(軽やか)
//
// 描画方法:
//   - 新月(1):アウトラインのみ、面は描かない(=「ある、けど見えない」の身体感覚)
//   - 満月(5):完全な円(=満ちて軽い)
//   - 中間(2-4):body 円と同サイズの cutout 円をマスクで重ねて、offset で visibility を制御
//
// 色は brand の moon cream(#f5d49a)を固定使用。

interface Props {
  phase: number; // expects 1-5; clamps out-of-range silently
  className?: string;
}

const MOON_COLOR = "#f5d49a";

export function MoonPhase({ phase, className }: Props) {
  const p = Math.max(1, Math.min(5, Math.round(phase))) as 1 | 2 | 3 | 4 | 5;

  // 新月:アウトライン
  if (p === 1) {
    return (
      <svg
        viewBox="0 0 100 100"
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle
          cx="50"
          cy="50"
          r="35"
          fill="none"
          stroke={MOON_COLOR}
          strokeOpacity="0.35"
          strokeWidth="2"
        />
      </svg>
    );
  }

  // 満月:full disc
  if (p === 5) {
    return (
      <svg
        viewBox="0 0 100 100"
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="50" cy="50" r="35" fill={MOON_COLOR} />
      </svg>
    );
  }

  // 上弦(phase 3):terminator が直線なので rect マスクで真半分
  if (p === 3) {
    return (
      <svg
        viewBox="0 0 100 100"
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <mask id="moon-mask-3">
          <rect width="100" height="100" fill="white" />
          <rect width="50" height="100" fill="black" />
        </mask>
        <circle
          cx="50"
          cy="50"
          r="35"
          fill={MOON_COLOR}
          mask="url(#moon-mask-3)"
        />
      </svg>
    );
  }

  // 三日月(2)/ 十三夜(4):cutout circle で削る、offset で visibility 制御
  const offset = p === 2 ? 15 : 50;
  const maskId = `moon-mask-${p}`;

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <mask id={maskId}>
        <rect width="100" height="100" fill="white" />
        <circle cx={50 - offset} cy="50" r="35" fill="black" />
      </mask>
      <circle
        cx="50"
        cy="50"
        r="35"
        fill={MOON_COLOR}
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}
