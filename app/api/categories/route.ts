import { NextResponse } from "next/server";
import { loadExcel } from "@/lib/loadExcel";

export async function GET() {
  const data = await loadExcel();

  const categories = [
    ...new Set(data.map((item) => item.category_en)),
  ];

  return NextResponse.json({ categories });
}
