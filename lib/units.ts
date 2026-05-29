export const DEFAULT_UNITS: { name: string; code: string | null }[] = [
  { name: "хүн/цаг", code: "х/ц" },
  { name: "ширхэг", code: "ш" },
  { name: "цаг", code: "ц" },
  { name: "мин", code: "мин" },
  { name: "литр", code: "л" },
  { name: "кг", code: "кг" },
  { name: "м", code: "м" },
  { name: "удаа", code: null },
  { name: "багц", code: null },
];

// Системийн default нэгжүүд — устгаж болохгүй (`хүн/цаг` гэх мэт).
export const SYSTEM_UNIT_NAMES = new Set<string>(["хүн/цаг"]);

export const DURATION_UNIT_NAMES = new Set(["мин", "цаг", "өдөр"]);
