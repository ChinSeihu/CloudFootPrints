import { NextResponse } from "next/server";
import { getTokyoWeather } from "@/services/weather";

// 薄 handler：天气交给 service。半小时重新验证一次。
export const revalidate = 1800;

export async function GET() {
  const forecast = await getTokyoWeather();
  if (!forecast) {
    return NextResponse.json({ error: "天气获取失败" }, { status: 502 });
  }
  return NextResponse.json(forecast);
}
