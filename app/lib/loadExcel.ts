import ExcelJS from "exceljs";
import path from "path";

export async function loadExcel() {
  const filePath = path.join(process.cwd(), "public", "Avatar Project.xlsx");

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheet =
    workbook.getWorksheet(1) ||
    workbook.getWorksheet("Sheet1") ||
    workbook.worksheets[0];

  if (!sheet) throw new Error("No worksheet found");

  const data: any[] = [];

  sheet.eachRow((row, index) => {
    if (index === 1) return; // skip header row

    const v = Array.isArray(row.values) ? row.values : [];
    if (v.length < 5) return; // skip empty rows

    data.push({
      world_he: v[1],
      world_en: v[2],
      category_he: v[3],
      category_en: v[4],
      subcategory_he: v[5],
      subcategory_en: v[6],
      title: v[7],
      description: v[8],
      link: v[9],
      price: v[10],
      brand_he: v[11],
      brand_en: v[12],
      model: v[13],
      width: v[14],
      height: v[15],
      depth: v[16],
      images: [v[17], v[18], v[19], v[20], v[21]].filter(Boolean),
      video: v[22],
    });
  });

  return data;
}
