import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const metric = await prisma.eventMetric.upsert({
    where: { eventId: id },
    update: { clickCount: { increment: 1 } },
    create: { eventId: id, clickCount: 1 },
  });

  return NextResponse.json({ clickCount: metric.clickCount });
}
