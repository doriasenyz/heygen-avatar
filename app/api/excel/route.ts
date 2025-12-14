import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import path from "path";

// Ensure this route is treated as dynamic to avoid static analysis issues with Unicode
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    // searchParams.get() automatically decodes URL parameters
    const category = searchParams.get("category")?.trim() || undefined;
    const subcategory = searchParams.get("subcategory")?.trim() || undefined;

    const filePath = path.join(process.cwd(), "public", "Avatar Project.xlsx");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    // Try to get Sheet1 by index or by name
    const sheet = workbook.getWorksheet(1) ||
      workbook.getWorksheet("Sheet1") ||
      workbook.worksheets[0];

    if (!sheet) {
      return NextResponse.json(
        { error: "Worksheet not found in Excel file" },
        { status: 500 }
      );
    }

    const items: any[] = [];

    sheet.eachRow((row, index) => {
      if (index === 1) return; // skip header row

      const v = Array.isArray(row.values) ? row.values : [];
      if (v.length < 5) return; // skip empty rows

      // v[3] is category_he, v[5] is subcategory_he (based on loadExcel.ts)
      const category_he = String(v[3] || "").trim().toLowerCase();
      const subcategory_he = String(v[5] || "").trim().toLowerCase();
      const image1 = v[17];
      const images = [v[17], v[18], v[19], v[20], v[21]].filter(Boolean);
      const video = v[22];

      // Filter by category and subcategory if provided (case-insensitive comparison)
      if (category && category_he !== category.toLowerCase()) return;
      if (subcategory && subcategory_he !== subcategory.toLowerCase()) return;

      // Only include items that have image1
      if (image1) {
        items.push({
          image1,
          images,
          video,
          title: v[7],
          description: v[8],
        });
      }
    });

    return NextResponse.json({ items }, {
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to read Excel", details: err.message },
      { status: 500 }
    );
  }
}
