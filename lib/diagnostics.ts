import { randomBytes } from "node:crypto";

export type DiagnosticType =
  | "INTAKE"
  | "POST_SERVICE"
  | "ROUTINE"
  | "DAMAGE_REPORT";

export const DIAGNOSTIC_TYPES: DiagnosticType[] = [
  "INTAKE",
  "POST_SERVICE",
  "ROUTINE",
  "DAMAGE_REPORT",
];

export const DIAGNOSTIC_TYPE_LABEL: Record<DiagnosticType, string> = {
  INTAKE: "Хүлээж авах",
  POST_SERVICE: "Үйлчилгээний дараа",
  ROUTINE: "Тогтмол үзлэг",
  DAMAGE_REPORT: "Гэмтлийн тайлан",
};

export const DIAGNOSTIC_TYPE_DESCRIPTION: Record<DiagnosticType, string> = {
  INTAKE: "Машин хүлээж авах үед хийгдэх анхны үзлэг",
  POST_SERVICE: "Засвар, үйлчилгээ дууссаны дараах чанарын шалгалт",
  ROUTINE: "Тогтмол хийгддэг үзлэгийн checklist",
  DAMAGE_REPORT: "Үйлчлүүлэгчид өгөх албан ёсны гэмтлийн тайлан",
};

export const DIAGNOSTIC_TYPE_BADGE: Record<DiagnosticType, string> = {
  INTAKE: "bg-violet-500/15 text-violet-300 border border-violet-500/30",
  POST_SERVICE: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  ROUTINE: "bg-blue-500/15 text-blue-300 border border-blue-500/30",
  DAMAGE_REPORT: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
};

export type ItemType =
  | "check"
  | "text"
  | "number"
  | "photo"
  | "signature";

export const ITEM_TYPES: ItemType[] = [
  "check",
  "text",
  "number",
  "photo",
  "signature",
];

export const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  check: "Сонголт",
  text: "Текст",
  number: "Тоо",
  photo: "Зураг",
  signature: "Гарын үсэг",
};

export type ShowWhen = {
  itemId: string; // өмнөх check item-ийн id
  values: string[]; // дор хаяж нэгтэй нь тэнцвэл харагдана
};

export type TemplateItem = {
  id: string;
  label: string;
  type: ItemType;
  required: boolean;
  options?: string[]; // зөвхөн check төрөлд
  showWhen?: ShowWhen; // дээд талын check item-ийн хариунаас хамаарч харагдана
};

export type TemplateSection = {
  id: string;
  title: string;
  items: TemplateItem[];
};

export type TemplateSchema = {
  sections: TemplateSection[];
};

export type ReportEntry = {
  value?: string | number | boolean;
  photos?: string[];
  note?: string;
};

export type ReportData = Record<string, ReportEntry>;

export const DEFAULT_CHECK_OPTIONS = ["OK", "Анхаарах", "Засах"];

export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

export function emptySchema(): TemplateSchema {
  return {
    sections: [
      {
        id: newId("sec"),
        title: "Үндсэн үзлэг",
        items: [],
      },
    ],
  };
}

/**
 * Хэрэглэгчээс ирсэн санамсаргүй JSON-ыг template schema болгож хатуу шалгана.
 * Хүчингүй бол throw.
 */
export function validateSchema(raw: unknown): TemplateSchema {
  if (!raw || typeof raw !== "object")
    throw new Error("Хуудасны бүтэц буруу.");
  const obj = raw as { sections?: unknown };
  if (!Array.isArray(obj.sections))
    throw new Error("Хуудсанд дор хаяж нэг хэсэг байх ёстой.");
  if (obj.sections.length === 0)
    throw new Error("Хуудсанд дор хаяж нэг хэсэг байх ёстой.");

  const seenItemIds = new Set<string>();
  // showWhen-д ашиглах check item-уудын options-ийг хадгалж, шалгаанд хэрэглэнэ
  const checkItemOptions = new Map<string, string[]>();
  const sections: TemplateSection[] = obj.sections.map((rawSec, sIdx) => {
    if (!rawSec || typeof rawSec !== "object")
      throw new Error(`${sIdx + 1} дэх хэсгийн бүтэц буруу.`);
    const sec = rawSec as {
      id?: unknown;
      title?: unknown;
      items?: unknown;
    };
    const id = typeof sec.id === "string" && sec.id ? sec.id : newId("sec");
    const title = typeof sec.title === "string" ? sec.title.trim() : "";
    if (!title) throw new Error(`${sIdx + 1} дэх хэсгийн нэр хоосон байна.`);
    if (!Array.isArray(sec.items))
      throw new Error(`"${title}" хэсэгт асуулт алга.`);
    if (sec.items.length === 0)
      throw new Error(`"${title}" хэсэгт дор хаяж нэг асуулт хэрэгтэй.`);

    const items: TemplateItem[] = sec.items.map((rawIt, iIdx) => {
      if (!rawIt || typeof rawIt !== "object")
        throw new Error(`"${title}" хэсгийн ${iIdx + 1}-р асуулт буруу.`);
      const it = rawIt as {
        id?: unknown;
        label?: unknown;
        type?: unknown;
        required?: unknown;
        options?: unknown;
        showWhen?: unknown;
      };
      const itemId =
        typeof it.id === "string" && it.id ? it.id : newId("item");
      if (seenItemIds.has(itemId))
        throw new Error(`"${title}" хэсэгт давхардсан item ID байна.`);
      seenItemIds.add(itemId);
      const label = typeof it.label === "string" ? it.label.trim() : "";
      if (!label)
        throw new Error(`"${title}" хэсгийн ${iIdx + 1}-р асуулт хоосон.`);
      const type = it.type;
      if (typeof type !== "string" || !ITEM_TYPES.includes(type as ItemType))
        throw new Error(`"${label}" асуултын төрөл буруу.`);
      const required = Boolean(it.required);
      let options: string[] | undefined;
      if (type === "check") {
        const opts = Array.isArray(it.options)
          ? it.options.filter(
              (o): o is string => typeof o === "string" && o.trim() !== "",
            )
          : [];
        options = opts.length > 0 ? opts : DEFAULT_CHECK_OPTIONS.slice();
        checkItemOptions.set(itemId, options);
      }

      // showWhen — өмнөх check item-ийн id, дор хаяж нэг утга
      let showWhen: ShowWhen | undefined;
      if (it.showWhen && typeof it.showWhen === "object") {
        const sw = it.showWhen as { itemId?: unknown; values?: unknown };
        const swItemId = typeof sw.itemId === "string" ? sw.itemId.trim() : "";
        const swValues = Array.isArray(sw.values)
          ? sw.values.filter(
              (v): v is string => typeof v === "string" && v.trim() !== "",
            )
          : [];
        if (swItemId && swValues.length > 0) {
          // Дээд талын check item-ийн ID байх ёстой
          if (!checkItemOptions.has(swItemId)) {
            throw new Error(
              `"${label}" асуултын хамаарал буруу: өмнөх check төрлийн асуултаас сонгоно уу.`,
            );
          }
          const allowed = checkItemOptions.get(swItemId)!;
          const invalid = swValues.find((v) => !allowed.includes(v));
          if (invalid) {
            throw new Error(
              `"${label}" асуултын хамаарлын "${invalid}" утга өмнөх асуултын сонголтод алга.`,
            );
          }
          showWhen = { itemId: swItemId, values: swValues };
        }
      }

      return {
        id: itemId,
        label,
        type: type as ItemType,
        required,
        options,
        showWhen,
      };
    });

    return { id, title, items };
  });

  return { sections };
}

/**
 * Item-ийн `showWhen` нөхцөл одоогийн бөглөгдсөн утгуудын дагуу таарч байгаа эсэх.
 * `showWhen` тогтоогоогүй item үргэлж харагдана.
 */
export function isItemVisible(
  item: TemplateItem,
  answers: Record<string, unknown>,
): boolean {
  if (!item.showWhen) return true;
  const dep = answers[item.showWhen.itemId];
  let value: unknown = dep;
  if (dep && typeof dep === "object" && "value" in (dep as object)) {
    value = (dep as { value?: unknown }).value;
  }
  if (typeof value !== "string" || value === "") return false;
  return item.showWhen.values.includes(value);
}

/**
 * Тайлангийн өгөгдлийг template-тэй харьцуулан шалгана.
 * `showWhen`-р далдлагдсан item-ийг хариунаас хасаж required check-ийг алгасна.
 */
export function validateReportData(
  schema: TemplateSchema,
  data: unknown,
): ReportData {
  if (!data || typeof data !== "object")
    throw new Error("Тайлангийн өгөгдөл буруу.");
  const obj = data as Record<string, unknown>;
  const out: ReportData = {};
  for (const section of schema.sections) {
    for (const item of section.items) {
      const visible = isItemVisible(item, obj);
      if (!visible) {
        // Далдлагдсан item — хариуг хадгалахгүй, required-ыг шалгахгүй
        continue;
      }
      const raw = obj[item.id];
      const entry: ReportEntry = {};
      if (raw && typeof raw === "object") {
        const r = raw as ReportEntry;
        if (r.value !== undefined) entry.value = r.value;
        if (Array.isArray(r.photos))
          entry.photos = r.photos.filter(
            (p): p is string => typeof p === "string",
          );
        if (typeof r.note === "string" && r.note.trim())
          entry.note = r.note.trim();
      }
      if (item.required) {
        const hasValue =
          (entry.value !== undefined &&
            entry.value !== "" &&
            entry.value !== null) ||
          (entry.photos && entry.photos.length > 0);
        if (!hasValue)
          throw new Error(`"${item.label}" заавал бөглөх ёстой.`);
      }
      out[item.id] = entry;
    }
  }
  return out;
}
