"use client";

import { useMemo } from "react";
import type { WeatherKind } from "@/services/weather";

// 地图上层的天气动画覆盖层。纯装饰，pointer-events:none，不挡地图交互。
// 粒子参数（位置/延迟/时长）一次性随机生成，动画交给 CSS keyframes（见 globals.css）。
export function WeatherAnimation({ kind }: { kind: WeatherKind }) {
  const rng = useMemo(() => {
    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    if (kind === "rain" || kind === "storm") {
      const drops = Array.from({ length: 70 }, () => ({
        left: rand(0, 100),
        delay: rand(0, 1.2),
        dur: rand(0.5, 0.95),
        h: rand(10, 18),
        o: rand(0.3, 0.7),
      }));
      return { type: "rain" as const, drops };
    }
    if (kind === "snow") {
      const flakes = Array.from({ length: 45 }, () => ({
        left: rand(0, 100),
        delay: rand(0, 5),
        dur: rand(4, 8),
        size: rand(3, 6),
        o: rand(0.5, 1),
      }));
      return { type: "snow" as const, flakes };
    }
    if (kind === "cloudy" || kind === "fog") {
      const clouds = Array.from({ length: 5 }, (_, i) => ({
        top: rand(8, 70),
        delay: rand(0, 18),
        dur: rand(22, 40),
        w: rand(120, 240),
        h: rand(36, 70),
        o: kind === "fog" ? rand(0.45, 0.7) : rand(0.3, 0.55),
        key: i,
      }));
      return { type: "cloud" as const, clouds };
    }
    return { type: "sun" as const };
  }, [kind]);

  if (rng.type === "rain") {
    return (
      <div className="wx-layer">
        {rng.drops.map((d, i) => (
          <span
            key={i}
            className="wx-drop"
            style={{
              left: `${d.left}%`,
              height: `${d.h}px`,
              opacity: d.o,
              animationDelay: `${d.delay}s`,
              animationDuration: `${d.dur}s`,
            }}
          />
        ))}
        {kind === "storm" && <div className="wx-flash" />}
      </div>
    );
  }

  if (rng.type === "snow") {
    return (
      <div className="wx-layer">
        {rng.flakes.map((f, i) => (
          <span
            key={i}
            className="wx-flake"
            style={{
              left: `${f.left}%`,
              width: `${f.size}px`,
              height: `${f.size}px`,
              opacity: f.o,
              animationDelay: `${f.delay}s`,
              animationDuration: `${f.dur}s`,
            }}
          />
        ))}
      </div>
    );
  }

  if (rng.type === "cloud") {
    return (
      <div className="wx-layer">
        {rng.clouds.map((c) => (
          <span
            key={c.key}
            className="wx-cloud"
            style={{
              top: `${c.top}%`,
              width: `${c.w}px`,
              height: `${c.h}px`,
              opacity: c.o,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.dur}s`,
            }}
          />
        ))}
      </div>
    );
  }

  // sunny
  return (
    <div className="wx-layer">
      <div className="wx-sun" />
    </div>
  );
}
