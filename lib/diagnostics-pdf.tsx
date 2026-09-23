import path from "node:path";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";
import {
  itemPositions,
  positionedKey,
  type ReportData,
  type ReportEntry,
  type TemplateItem,
  type TemplateSection,
} from "@/lib/diagnostics";

// Server-side counterpart of `app/dashboard/diagnostics/reports/[id]/pdf-generator.tsx`.
// That file is client-only (`BlobProvider`, browser font URL) and must not be
// modified or imported here — this module extracts the same
// `Document`/`Page`/`View`/`Text`/`Image` layout into a plain function a
// route handler can call with `renderToBuffer` (Node, not the browser).
// Кирилл (монгол Өө/Үү) дэмждэг ижил DejaVuSans фонтыг ашиглана, гэхдээ
// browser-ийн `/fonts/...` public URL-ийн оронд файлын системийн замаар
// (`public/fonts/...`) шууд ачаална — энд browser fetch байхгүй.

let fontRegistered = false;

function ensureFontRegistered(): void {
  if (fontRegistered) return;
  Font.register({
    family: "DejaVuSans",
    fonts: [
      {
        src: path.join(process.cwd(), "public", "fonts", "DejaVuSans.ttf"),
        fontWeight: "normal",
      },
      {
        src: path.join(process.cwd(), "public", "fonts", "DejaVuSans-Bold.ttf"),
        fontWeight: "bold",
      },
    ],
  });
  fontRegistered = true;
}

const styles = StyleSheet.create({
  page: {
    padding: 26,
    fontFamily: "DejaVuSans",
    fontSize: 10,
    color: "#000",
  },
  header: {
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 7,
  },
  title: {
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 2,
    color: "#111",
  },
  subtitle: {
    fontSize: 9,
    color: "#666",
  },
  section: {
    marginBottom: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 7,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#111",
  },
  // Мэдээлэл — 2 баганаар нягт
  infoWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  infoCell: {
    width: "50%",
    flexDirection: "row",
    marginBottom: 2,
    paddingRight: 10,
  },
  infoCellFull: {
    width: "100%",
    flexDirection: "row",
    marginBottom: 2,
  },
  rowLabel: {
    width: "34%",
    fontSize: 9,
    fontWeight: "bold",
    color: "#555",
  },
  rowValue: {
    width: "66%",
    fontSize: 9,
    color: "#111",
  },
  signatureSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
  },
  signatureImage: {
    width: 140,
    height: 50,
    marginBottom: 4,
    objectFit: "contain",
  },
  signRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  signBlock: {
    width: "45%",
  },
  signLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    height: 1,
    marginBottom: 4,
  },
  signCaption: {
    fontSize: 8,
    color: "#666",
  },
  // Оношилгооны асуултууд — 2 баганаар нягт
  itemsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  itemCol: {
    width: "50%",
    paddingRight: 12,
    marginBottom: 4,
  },
  itemColFull: {
    width: "100%",
    marginBottom: 4,
  },
  qLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#444",
    marginBottom: 1,
  },
  // Байрлалуудыг 2-2-оор (индентгүй, нягт)
  positionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  positionCell: {
    width: "50%",
    paddingRight: 8,
    marginBottom: 2,
  },
  positionLabel: {
    fontSize: 8,
    color: "#888",
    marginBottom: 1,
  },
  entryValue: {
    fontSize: 9,
    color: "#111",
  },
  entryNote: {
    fontSize: 8,
    color: "#666",
    fontStyle: "italic",
    marginTop: 1,
  },
  entrySignature: {
    width: 110,
    height: 50,
    objectFit: "contain",
    marginTop: 2,
  },
  photoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 2,
  },
  photo: {
    width: 60,
    height: 60,
    objectFit: "cover",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginRight: 3,
    marginBottom: 3,
  },
});

export interface DiagnosticReportPdfData {
  reportId: string;
  templateName: string;
  templateVersion: number;
  createdAt: Date;
  customerName: string;
  customerPhone: string;
  vehicleMake: string;
  vehicleModel: string;
  vehiclePlate: string;
  vehicleYear?: number;
  branchName: string;
  filledByName?: string;
  mileageAtReport?: number;
  notes?: string;
  signatureUrl?: string;
  // Оношилгооны хуудасны бүтэц + бөглөсөн утгууд (section/item render-д)
  sections: TemplateSection[];
  data: ReportData;
}

// Item-ийн утгыг текст болгоно (pdf-generator.tsx-ийн renderValue-тэй ижил логик).
function renderValue(
  type: string,
  value: string | number | boolean | undefined,
): string {
  if (value === undefined || value === "" || value === null) return "—";
  if (type === "signature") return "";
  if (typeof value === "boolean") return value ? "Тийм" : "Үгүй";
  return String(value);
}

// Нэг талбарын (item эсвэл байрлалын) утга/зураг/гарын үсэг/тэмдэглэл.
function EntryPdf({ item, entry }: { item: TemplateItem; entry: ReportEntry }) {
  const isSignature = item.type === "signature" && typeof entry.value === "string";
  return (
    <View>
      {!isSignature ? (
        <Text style={styles.entryValue}>
          {renderValue(item.type, entry.value)}
        </Text>
      ) : null}
      {isSignature ? (
        <Image src={entry.value as string} style={styles.entrySignature} />
      ) : null}
      {entry.photos && entry.photos.length > 0 ? (
        <View style={styles.photoRow}>
          {entry.photos.map((p, idx) => (
            <Image key={idx} src={p} style={styles.photo} />
          ))}
        </View>
      ) : null}
      {entry.note ? (
        <Text style={styles.entryNote}>Тэмдэглэл: {entry.note}</Text>
      ) : null}
    </View>
  );
}

function DiagnosticReportPDF({ report }: { report: DiagnosticReportPdfData }) {
  return (
    <Document title={`diagnostic-${report.reportId}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{report.templateName}</Text>
          <Text style={styles.subtitle}>
            v{report.templateVersion} · {report.createdAt.toLocaleDateString("mn-MN")}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Үйлчлүүлэгч ба Машин</Text>
          <View style={styles.infoWrap}>
            <View style={styles.infoCell}>
              <Text style={styles.rowLabel}>Үйлчлүүлэгч:</Text>
              <Text style={styles.rowValue}>{report.customerName}</Text>
            </View>
            <View style={styles.infoCell}>
              <Text style={styles.rowLabel}>Утас:</Text>
              <Text style={styles.rowValue}>{report.customerPhone}</Text>
            </View>
            <View style={styles.infoCell}>
              <Text style={styles.rowLabel}>Машин:</Text>
              <Text style={styles.rowValue}>
                {report.vehicleMake} {report.vehicleModel}
              </Text>
            </View>
            <View style={styles.infoCell}>
              <Text style={styles.rowLabel}>Дугаар:</Text>
              <Text style={styles.rowValue}>{report.vehiclePlate}</Text>
            </View>
            <View style={styles.infoCell}>
              <Text style={styles.rowLabel}>Салбар:</Text>
              <Text style={styles.rowValue}>{report.branchName}</Text>
            </View>
            {report.filledByName ? (
              <View style={styles.infoCell}>
                <Text style={styles.rowLabel}>Бөглөсөн:</Text>
                <Text style={styles.rowValue}>{report.filledByName}</Text>
              </View>
            ) : null}
            {report.mileageAtReport !== undefined ? (
              <View style={styles.infoCell}>
                <Text style={styles.rowLabel}>Гүйлт:</Text>
                <Text style={styles.rowValue}>
                  {report.mileageAtReport.toLocaleString("mn-MN")} км
                </Text>
              </View>
            ) : null}
            {report.notes ? (
              <View style={styles.infoCellFull}>
                <Text style={styles.rowLabel}>Тэмдэглэл:</Text>
                <Text style={styles.rowValue}>{report.notes}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Оношилгооны хэсэг бүр + item-ууд (pdf-generator.tsx-ийн бүтэцтэй ижил) */}
        {report.sections.map((section) => (
          <View key={section.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.itemsWrap}>
              {section.items.map((item) => {
                const positions = itemPositions(item);
                // 2 байрлалтай (Зүүн/Баруун, Урд/Хойд) мөр хагас баганад
                // багтдаг тул нягт 2 баганаар үзүүлнэ; зөвхөн 3+ байрлалтай
                // (ж: 4 булан) мөрийг л бүтэн мөрөнд гаргана.
                const useFullWidth = (positions?.length ?? 0) > 2;
                return (
                  <View
                    key={item.id}
                    style={useFullWidth ? styles.itemColFull : styles.itemCol}
                    wrap={false}
                  >
                    <Text style={styles.qLabel}>{item.label}</Text>
                    {positions ? (
                      <View style={styles.positionsRow}>
                        {positions.map((pos) => (
                          <View key={pos.code} style={styles.positionCell}>
                            <Text style={styles.positionLabel}>{pos.label}</Text>
                            <EntryPdf
                              item={item}
                              entry={
                                report.data[positionedKey(item.id, pos.code)] ?? {}
                              }
                            />
                          </View>
                        ))}
                      </View>
                    ) : (
                      <EntryPdf item={item} entry={report.data[item.id] ?? {}} />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        {/* Үйлчлүүлэгч хүлээн авсан гарын үсэг — хадгалсан зураг байвал
            дээр нь харуулж, доор нь гараар зурах хоосон мөр гаргана. */}
        <View style={styles.signatureSection}>
          <Text style={styles.sectionTitle}>Үйлчлүүлэгчийн гарын үсэг</Text>
          {report.signatureUrl ? (
            <Image src={report.signatureUrl} style={styles.signatureImage} />
          ) : null}
          <View style={styles.signRow}>
            <View style={styles.signBlock}>
              <View style={styles.signLine} />
              <Text style={styles.signCaption}>Гарын үсэг</Text>
            </View>
            <View style={styles.signBlock}>
              <View style={styles.signLine} />
              <Text style={styles.signCaption}>Овог нэр</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

/**
 * Оношилгооны тайланг server-side PDF Buffer болгож render хийнэ
 * (`@react-pdf/renderer`-ийн `renderToBuffer`, Node — browser-ийн
 * `BlobProvider` биш). `app/api/v1/diagnostics/reports/[id]/pdf/route.ts`-ийн
 * цорын ганц хэрэглэгч.
 */
export async function renderReportPdf(
  report: DiagnosticReportPdfData,
): Promise<Buffer> {
  ensureFontRegistered();
  return renderToBuffer(<DiagnosticReportPDF report={report} />);
}
