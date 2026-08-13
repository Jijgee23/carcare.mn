import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";

/**
 * Монголын засаг захиргааны нэгжийг (City → District → Khoroo) scripts/
 * mongolian.sql (MySQL dump)-аас уншиж DB-д ачаална. Идемпотент —
 * skipDuplicates тул дахин ажиллуулахад давхардахгүй.
 */

type Cell = string | number | null;

// MySQL INSERT-ийн VALUES хэсгээс tuple-уудыг задлана ('...' escape, NULL зэрэг).
function parseTuples(values: string): Cell[][] {
  const rows: Cell[][] = [];
  let i = 0;
  const n = values.length;
  const coerce = (s: string): Cell => {
    const t = s.trim();
    if (t === "" || t.toUpperCase() === "NULL") return null;
    return Number(t);
  };
  while (i < n) {
    while (i < n && values[i] !== "(") i++;
    if (i >= n) break;
    i++; // "("
    const row: Cell[] = [];
    let field = "";
    let inStr = false;
    let started = false;
    while (i < n) {
      const c = values[i];
      if (inStr) {
        if (c === "\\") {
          field += values[i + 1] ?? "";
          i += 2;
          continue;
        }
        if (c === "'") {
          if (values[i + 1] === "'") {
            field += "'";
            i += 2;
            continue;
          }
          inStr = false;
          row.push(field);
          field = "";
          started = false;
          i++;
          continue;
        }
        field += c;
        i++;
        continue;
      }
      if (c === "'") {
        inStr = true;
        started = true;
        i++;
        continue;
      }
      if (c === ",") {
        if (started) {
          row.push(coerce(field));
          field = "";
          started = false;
        }
        i++;
        continue;
      }
      if (c === ")") {
        if (started) row.push(coerce(field));
        i++;
        break;
      }
      field += c;
      started = true;
      i++;
    }
    rows.push(row);
  }
  return rows;
}

function extract(sql: string, table: string): { cols: string[]; rows: Cell[][] } {
  const re = new RegExp(
    "INSERT INTO `" + table + "` \\(([^)]*)\\)\\s*VALUES([\\s\\S]*?);",
    "g",
  );
  let cols: string[] = [];
  const rows: Cell[][] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const c = m[1].split(",").map((s) => s.replace(/[`\s]/g, ""));
    if (cols.length === 0) cols = c;
    rows.push(...parseTuples(m[2]));
  }
  return { cols, rows };
}

function objects(
  block: { cols: string[]; rows: Cell[][] },
  map: Record<string, string>,
): Record<string, Cell>[] {
  return block.rows.map((row) => {
    const o: Record<string, Cell> = {};
    block.cols.forEach((col, idx) => {
      const key = map[col] ?? col;
      o[key] = row[idx] ?? null;
    });
    return o;
  });
}

async function main() {
  // Зөвхөн global reference хүснэгт (City/District/Khoroo, RLS-гүй) хөндөх
  // ч prisma extension context шаарддаг тул bypass тавина.
  setBypassContext();
  const file = path.join(process.cwd(), "scripts", "mongolian.sql");
  const sql = readFileSync(file, "utf8");

  const cities = objects(extract(sql, "city"), {}) as {
    id: number;
    code: string | null;
    name: string;
  }[];
  const districts = objects(extract(sql, "district"), { city_id: "cityId" }) as {
    id: number;
    code: string | null;
    name: string;
    cityId: number;
  }[];
  const khoroos = objects(extract(sql, "khoroo"), {
    city_id: "cityId",
    district_id: "districtId",
  }) as {
    id: number;
    name: string;
    cityId: number;
    districtId: number | null;
  }[];

  // FK дараалал: эхлээд аймаг, дараа сум/дүүрэг, эцэст нь хороо.
  const c = await prisma.city.createMany({ data: cities, skipDuplicates: true });
  const d = await prisma.district.createMany({
    data: districts,
    skipDuplicates: true,
  });
  const k = await prisma.khoroo.createMany({
    data: khoroos,
    skipDuplicates: true,
  });

  console.log(
    `Хаягийн seed: City +${c.count}/${cities.length}, District +${d.count}/${districts.length}, Khoroo +${k.count}/${khoroos.length}`,
  );
}

main()
  .catch((e) => {
    console.error("Seed алдаа:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
