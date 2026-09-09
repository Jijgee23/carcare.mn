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
  INTAKE:
    "bg-violet-500/15 text-violet-300 border border-violet-500/30 light:bg-violet-100 light:border-violet-300 light:text-violet-700",
  POST_SERVICE:
    "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 light:bg-emerald-100 light:border-emerald-300 light:text-emerald-700",
  ROUTINE:
    "bg-blue-500/15 text-blue-300 border border-blue-500/30 light:bg-blue-100 light:border-blue-300 light:text-blue-700",
  DAMAGE_REPORT:
    "bg-amber-500/15 text-amber-300 border border-amber-500/30 light:bg-amber-100 light:border-amber-300 light:text-amber-700",
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

// --- Байрлалын багц (зүүн/баруун, урд/хойд, 4 булан) ----------------------
// Нэг эд ангийг (ж: "Дугуй") байрлал бүрээр давтаж шалгахад зориулсан. Item-д
// `positionSet` тохируулбал бөглөх UI байрлал тус бүрд талбар гаргаж, тайланд
// утга нь `<itemId>@<code>` нийлмэл түлхүүрээр хадгалагдана — report.data-ийн
// хавтгай бүтэц хэвээр, DB-д өөрчлөлт шаардахгүй.

export type PositionDef = { code: string; label: string };

export const POSITION_SETS = {
  LR: {
    label: "Зүүн / Баруун",
    positions: [
      { code: "L", label: "Зүүн" },
      { code: "R", label: "Баруун" },
    ],
  },
  FB: {
    label: "Урд / Хойд",
    positions: [
      { code: "F", label: "Урд" },
      { code: "B", label: "Хойд" },
    ],
  },
  CORNERS: {
    label: "4 булан",
    positions: [
      { code: "FL", label: "Урд зүүн" },
      { code: "FR", label: "Урд баруун" },
      { code: "RL", label: "Хойд зүүн" },
      { code: "RR", label: "Хойд баруун" },
    ],
  },
} satisfies Record<string, { label: string; positions: PositionDef[] }>;

export type PositionSetKey = keyof typeof POSITION_SETS;

export const POSITION_SET_KEYS = Object.keys(POSITION_SETS) as PositionSetKey[];

export function isPositionSetKey(v: unknown): v is PositionSetKey {
  return typeof v === "string" && v in POSITION_SETS;
}

export type TemplateItem = {
  id: string;
  label: string;
  type: ItemType;
  required: boolean;
  options?: string[]; // зөвхөн check төрөлд
  showWhen?: ShowWhen; // дээд талын check item-ийн хариунаас хамаарч харагдана
  positionSet?: PositionSetKey; // байрлал бүрээр давтаж шалгах (зүүн/баруун г.м.)
};

/** Item-ийн байрлалын жагсаалт. positionSet байхгүй бол null. */
export function itemPositions(item: TemplateItem): PositionDef[] | null {
  return item.positionSet ? POSITION_SETS[item.positionSet].positions : null;
}

/** Байрлалтай item-ийн тайлан дахь нийлмэл түлхүүр (`<itemId>@<code>`). */
export function positionedKey(itemId: string, code: string): string {
  return `${itemId}@${code}`;
}

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

export const DEFAULT_CHECK_OPTIONS = ["Хэвийн", "Анхаарах", "Солих"];

// --- Check хариултын өнгө --------------------------------------------------
// Сонгосон чипийг хариултын утгаар нь өнгөжүүлнэ: эерэг → ногоон,
// анхааруулга → шар, засвар шаардсан → улаан. Танигдахгүй үг ногоон.

export type CheckTone = "good" | "warn" | "bad";

export function checkOptionTone(option: string): CheckTone {
  const v = option.toLowerCase();
  if (/анхаар|дунд|элэгд|сэжиг|шалгуулах|бага/.test(v)) return "warn";
  if (/зас|соли|муу|гэмт|яаралт|аюул|болохгүй|доголд|дутуу/.test(v))
    return "bad";
  return "good";
}

/** Radio агуулсан чип — сонгогдоход (`:has(:checked)`) өнгө авна. */
export const CHECK_TONE_CHIP: Record<CheckTone, string> = {
  good: "has-checked:bg-emerald-500/15 has-checked:border-emerald-500/40 has-checked:text-emerald-300 light:has-checked:bg-emerald-100 light:has-checked:border-emerald-300 light:has-checked:text-emerald-700",
  warn: "has-checked:bg-amber-500/15 has-checked:border-amber-500/40 has-checked:text-amber-300 light:has-checked:bg-amber-100 light:has-checked:border-amber-300 light:has-checked:text-amber-700",
  bad: "has-checked:bg-red-500/15 has-checked:border-red-500/40 has-checked:text-red-300 light:has-checked:bg-red-100 light:has-checked:border-red-300 light:has-checked:text-red-600",
};

export const CHECK_TONE_ACCENT: Record<CheckTone, string> = {
  good: "accent-emerald-500",
  warn: "accent-amber-500",
  bad: "accent-red-500",
};

/** State-ээр удирддаг чипийн идэвхтэй үеийн өнгө (preview г.м.). */
export const CHECK_TONE_ACTIVE: Record<CheckTone, string> = {
  good: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 light:bg-emerald-100 light:border-emerald-300 light:text-emerald-700",
  warn: "bg-amber-500/15 border-amber-500/40 text-amber-300 light:bg-amber-100 light:border-amber-300 light:text-amber-700",
  bad: "bg-red-500/15 border-red-500/40 text-red-300 light:bg-red-100 light:border-red-300 light:text-red-600",
};

// --- Тайлангийн нэгдсэн ноцтой байдал (severity) ---------------------------
// DB-д хадгалагдах `DiagnosticReport.maxSeverity`-тай ижил утгууд (prisma enum
// ReportSeverity). Тайлан доторх бүх check хариултаас хамгийн муу өнгийг олно.

export type ReportSeverity = "GOOD" | "WARN" | "BAD";

const TONE_TO_SEVERITY: Record<CheckTone, ReportSeverity> = {
  good: "GOOD",
  warn: "WARN",
  bad: "BAD",
};

const SEVERITY_RANK: Record<ReportSeverity, number> = {
  GOOD: 0,
  WARN: 1,
  BAD: 2,
};

export const SEVERITY_LABEL: Record<ReportSeverity, string> = {
  GOOD: "Хэвийн",
  WARN: "Анхаарах",
  BAD: "Солих шаардлагатай",
};

export const SEVERITY_BADGE: Record<ReportSeverity, string> = {
  GOOD: CHECK_TONE_ACTIVE.good,
  WARN: CHECK_TONE_ACTIVE.warn,
  BAD: CHECK_TONE_ACTIVE.bad,
};

/**
 * Загвар (schema) болон бөглөсөн өгөгдлөөс (data) хамаарч тайлангийн
 * хамгийн муу check-хариултын түвшинг тооцно. Check бус item-үүдийг
 * (текст, тоо, зураг, гарын үсэг) орлуулахгүй. Check хариулт огт байхгүй
 * бол `null` (жишээ нь бүгд текст/зурагтай загвар).
 */
export function computeReportSeverity(
  schema: TemplateSchema,
  data: ReportData,
): ReportSeverity | null {
  let worst: ReportSeverity | null = null;
  for (const section of schema.sections) {
    for (const item of section.items) {
      if (item.type !== "check") continue;
      const positions = itemPositions(item);
      const keys = positions
        ? positions.map((p) => positionedKey(item.id, p.code))
        : [item.id];
      for (const key of keys) {
        const value = data[key]?.value;
        if (typeof value !== "string" || value === "") continue;
        const severity = TONE_TO_SEVERITY[checkOptionTone(value)];
        if (worst === null || SEVERITY_RANK[severity] > SEVERITY_RANK[worst]) {
          worst = severity;
        }
      }
    }
  }
  return worst;
}

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
 * Системийн үндсэн (default) оношилгооны загвар — бодит засварын газрын
 * цаасан "Оношилгооны хуудас"-аас дижитал болгосон бүрэн үзлэгийн жагсаалт.
 * Шинэ тенант бүрт signup дээр автоматаар үүсгэгдэнэ (харах: app/_actions/
 * auth.ts signUpAction), мөн одоо байгаа тенантуудад migration-оор
 * (prisma/migrations/*_default_intake_diagnostic_template) нэг удаа
 * нэмэгдсэн. Энэ тогтмолыг өөрчлөх нь ЗӨВХӨН шинэ тенантад нөлөөлнэ — аль
 * хэдийн үүссэн загваруудыг дахин бичихгүй.
 */
export const DEFAULT_INTAKE_TEMPLATE_NAME = "Ерөнхий үзлэг (хүлээж авах)";

// "check" төрлийн мөр бүрт options дутуу байвал (доорх литералд зориудаар
// орхигдсон — давтагдал багасгах үүднээс) энд нэг мөчид тавьж өгнө. Формыг
// бөглөх/харах хуудсууд schema-г validateSchema()-гүйгээр шууд ашигладаг тул
// (харах: DiagnosticForm, report хуудсууд) options эндээс аль хэдийн бэлэн
// байх ёстой — эс бөгөөс сонголтын товчнууд гарахгүй.
function withDefaultCheckOptions(schema: TemplateSchema): TemplateSchema {
  return {
    sections: schema.sections.map((section) => ({
      ...section,
      items: section.items.map((item) =>
        item.type === "check" && !item.options
          ? { ...item, options: DEFAULT_CHECK_OPTIONS.slice() }
          : item,
      ),
    })),
  };
}

const RAW_INTAKE_TEMPLATE_SCHEMA: TemplateSchema = {
  sections: [
    {
      id: "sec_fluids",
      title: "Шингэн, тослох материал",
      items: [
        { id: "item_engine_oil", label: "Хөдөлгүүрийн тос", type: "check", required: false },
        { id: "item_transmission_fluid", label: "Хурдны хайрцагны шингэн", type: "check", required: false },
        { id: "item_coolant", label: "Хөргөлтийн шингэн", type: "check", required: false },
        { id: "item_brake_fluid", label: "Тоормозны шингэн", type: "check", required: false },
        { id: "item_hydraulic_fluid", label: "Гидрийн шингэн", type: "check", required: false },
        { id: "item_diff_oil", label: "ХДА-н тос (дифференциал)", type: "check", required: false, positionSet: "FB" },
        { id: "item_transfer_case_oil", label: "Туслах кропны тос", type: "check", required: false },
        { id: "item_grease", label: "Цэвэр тослого", type: "check", required: false },
      ],
    },
    {
      id: "sec_general",
      title: "Ерөнхий үзлэг",
      items: [
        { id: "item_lights", label: "Гэрэл дохио", type: "check", required: false },
        { id: "item_air_filter", label: "Моторын агаар шүүлтүүр", type: "check", required: false },
        { id: "item_cabin_filter", label: "Салон шүүр", type: "check", required: false },
        { id: "item_radiator", label: "Радиатор", type: "check", required: false },
        { id: "item_water_pump", label: "Усны помп", type: "check", required: false },
        { id: "item_front_seal", label: "Духны сальник", type: "check", required: false },
        { id: "item_fan_belt", label: "Сэнсний ремен", type: "check", required: false },
        { id: "item_tensioner_bearing", label: "Чангалагч шарикнууд", type: "check", required: false },
        { id: "item_valve_gasket", label: "Тагны жийрэг", type: "check", required: false, positionSet: "LR" },
        { id: "item_steering_rack", label: "Рулийн аппарат", type: "check", required: false },
      ],
    },
    {
      id: "sec_front_suspension",
      title: "Урд өнхрөх систем",
      items: [
        { id: "item_tie_rod", label: "Рулийн тяга", type: "check", required: false, positionSet: "LR" },
        { id: "item_steering_joint", label: "Рулийн шарнер", type: "check", required: false, positionSet: "LR" },
        { id: "item_ball_joint_front", label: "Цапны шарик (урд)", type: "check", required: false, positionSet: "LR" },
        { id: "item_lower_arm", label: "Доод гар", type: "check", required: false, positionSet: "LR" },
        { id: "item_lower_ball_mount", label: "Доод өндгөн тулгуур", type: "check", required: false, positionSet: "LR" },
        { id: "item_stabilizer_link", label: "Босоо тэнцүүлэгч", type: "check", required: false, positionSet: "LR" },
        { id: "item_shock_front", label: "Амортизатор (урд)", type: "check", required: false, positionSet: "LR" },
        { id: "item_brake_pad_front", label: "Наклад (урд)", type: "check", required: false, positionSet: "LR" },
        { id: "item_caliper_front", label: "Тоормосны аппарат (урд)", type: "check", required: false, positionSet: "LR" },
        { id: "item_disc_front", label: "Пиланз (урд)", type: "check", required: false, positionSet: "LR" },
        { id: "item_boot_rubber", label: "Булны гармушик резин", type: "check", required: false },
        { id: "item_upper_arm", label: "Дээд гар", type: "check", required: false, positionSet: "LR" },
        { id: "item_upper_ball_mount", label: "Дээд өндгөн тулгуур", type: "check", required: false, positionSet: "LR" },
        { id: "item_front_bushing", label: "Урд хэвтээгийн даравч резин", type: "check", required: false, positionSet: "LR" },
        { id: "item_body_seal", label: "Их биений сальник", type: "check", required: false },
        { id: "item_support_seal_front", label: "Урд туслахын сальник", type: "check", required: false },
      ],
    },
    {
      id: "sec_driveshaft",
      title: "Карданы голын систем",
      items: [
        { id: "item_driveshaft_joint", label: "Карданы чагтан гол", type: "check", required: false, positionSet: "FB" },
        { id: "item_center_gear_seal", label: "Зүрх араaны сальник", type: "check", required: false },
      ],
    },
    {
      id: "sec_rear_suspension",
      title: "Хойд өнхрөх систем",
      items: [
        { id: "item_short_link_rear", label: "Хойд богино татуурга", type: "check", required: false, positionSet: "LR" },
        { id: "item_long_link_rear", label: "Урт татуурга", type: "check", required: false, positionSet: "LR" },
        { id: "item_stabilizer_bushing_rear", label: "Хэвтээ тэнцүүлэгчийн дамар резин", type: "check", required: false, positionSet: "LR" },
        { id: "item_rear_bushing", label: "Хойд хэвтээгийн даравч резин", type: "check", required: false, positionSet: "LR" },
        { id: "item_lateral_link", label: "Хөндлөн татуурга", type: "check", required: false },
        { id: "item_shock_rear", label: "Амортизатор (хойд)", type: "check", required: false, positionSet: "LR" },
        { id: "item_brake_pad_rear", label: "Наклад (хойд)", type: "check", required: false, positionSet: "LR" },
        { id: "item_caliper_rear", label: "Тоормосны аппарат (хойд)", type: "check", required: false, positionSet: "LR" },
        { id: "item_disc_rear", label: "Пиланз (хойд)", type: "check", required: false, positionSet: "LR" },
        { id: "item_handbrake_pad", label: "Гар карданы наклад", type: "check", required: false },
        { id: "item_ball_joint_rear", label: "Цапны шарик (хойд)", type: "check", required: false, positionSet: "LR" },
        { id: "item_half_shaft_seal", label: "Хагас голны сальник", type: "check", required: false, positionSet: "LR" },
        { id: "item_frame_bushing", label: "Рам, кузовны ком втулка", type: "check", required: false },
      ],
    },
    {
      id: "sec_notes",
      title: "Нэмэлт тэмдэглэл",
      items: [
        { id: "item_notes", label: "Нэмэлт тайлбар", type: "text", required: false },
        { id: "item_signature", label: "Гарын үсэг", type: "signature", required: false },
      ],
    },
  ],
};

export const DEFAULT_INTAKE_TEMPLATE_SCHEMA: TemplateSchema =
  withDefaultCheckOptions(RAW_INTAKE_TEMPLATE_SCHEMA);

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
        positionSet?: unknown;
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
      const positionSet = isPositionSetKey(it.positionSet)
        ? it.positionSet
        : undefined;
      let options: string[] | undefined;
      if (type === "check") {
        const opts = Array.isArray(it.options)
          ? it.options.filter(
              (o): o is string => typeof o === "string" && o.trim() !== "",
            )
          : [];
        options = opts.length > 0 ? opts : DEFAULT_CHECK_OPTIONS.slice();
        // Байрлалтай check item нь олон утгатай тул showWhen-ийн эх сурвалж
        // болгохгүй (хамаарал нь нэг утгатай check-ээс хамаарна).
        if (!positionSet) checkItemOptions.set(itemId, options);
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
        positionSet,
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
// Нэг талбарын (item эсвэл байрлал-түлхүүрийн) хариуг цэвэрлэж шалгана.
function validateEntry(
  obj: Record<string, unknown>,
  fieldId: string,
  required: boolean,
  label: string,
): ReportEntry {
  const raw = obj[fieldId];
  const entry: ReportEntry = {};
  if (raw && typeof raw === "object") {
    const r = raw as ReportEntry;
    if (r.value !== undefined) entry.value = r.value;
    if (Array.isArray(r.photos))
      entry.photos = r.photos.filter((p): p is string => typeof p === "string");
    if (typeof r.note === "string" && r.note.trim()) entry.note = r.note.trim();
  }
  if (required) {
    const hasValue =
      (entry.value !== undefined &&
        entry.value !== "" &&
        entry.value !== null) ||
      (entry.photos && entry.photos.length > 0);
    if (!hasValue) throw new Error(`"${label}" заавал бөглөх ёстой.`);
  }
  return entry;
}

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
      const positions = itemPositions(item);
      if (positions) {
        // Байрлал тус бүрийг нийлмэл түлхүүрээр шалгаж хадгална.
        for (const pos of positions) {
          const key = positionedKey(item.id, pos.code);
          out[key] = validateEntry(
            obj,
            key,
            item.required,
            `${item.label} — ${pos.label}`,
          );
        }
      } else {
        out[item.id] = validateEntry(obj, item.id, item.required, item.label);
      }
    }
  }
  return out;
}
