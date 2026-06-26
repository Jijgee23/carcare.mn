"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
  PDFDownloadLink,
} from "@react-pdf/renderer";
import {
  itemPositions,
  positionedKey,
  type ReportData,
  type ReportEntry,
  type TemplateItem,
  type TemplateSection,
} from "@/lib/diagnostics";

// Кирилл (монгол Өө/Үү орсон) дэмждэг DejaVu Sans фонтыг бүртгэнэ.
// public/fonts/-д байрлуулсан тул browser-аас /fonts/... замаар татна.
// Стандарт Helvetica нь кирилл агуулдаггүй тул монгол текст хоосон гардаг байв.
Font.register({
  family: "DejaVuSans",
  fonts: [
    { src: "/fonts/DejaVuSans.ttf", fontWeight: "normal" },
    { src: "/fonts/DejaVuSans-Bold.ttf", fontWeight: "bold" },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "DejaVuSans",
    fontSize: 11,
    color: "#000",
  },
  header: {
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#111",
  },
  subtitle: {
    fontSize: 10,
    color: "#666",
    marginBottom: 15,
  },
  section: {
    marginBottom: 20,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 15,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#111",
  },
  row: {
    display: "flex",
    flexDirection: "row",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f0f0f0",
  },
  rowLabel: {
    width: "35%",
    fontSize: 10,
    fontWeight: "bold",
    color: "#444",
  },
  rowValue: {
    width: "65%",
    fontSize: 10,
    color: "#111",
  },
  itemLabel: {
    fontSize: 10,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 5,
    color: "#111",
  },
  itemValue: {
    fontSize: 10,
    color: "#333",
    marginBottom: 3,
  },
  signatureSection: {
    marginTop: 36,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 16,
  },
  // Хадгалсан гарын үсгийн зургийг хоосон мөрний дээр харуулна
  signatureImage: {
    width: 150,
    height: 60,
    marginBottom: 4,
    objectFit: "contain",
  },
  signRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 28,
  },
  signBlock: {
    width: "45%",
  },
  // Гараар гарын үсэг зурах хоосон мөр (доод хүрээ)
  signLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    height: 1,
    marginBottom: 6,
  },
  signCaption: {
    fontSize: 9,
    color: "#666",
  },
  // Оношилгооны item-ууд
  itemBlock: {
    marginBottom: 8,
  },
  positionWrap: {
    marginLeft: 10,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: "#e5e7eb",
  },
  positionLabel: {
    fontSize: 9,
    color: "#888",
    marginTop: 4,
    marginBottom: 2,
  },
  entryValue: {
    fontSize: 10,
    color: "#111",
  },
  entryNote: {
    fontSize: 9,
    color: "#666",
    fontStyle: "italic",
    marginTop: 2,
  },
  entrySignature: {
    width: 120,
    height: 60,
    objectFit: "contain",
    marginTop: 2,
  },
  photoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 3,
  },
  photo: {
    width: 70,
    height: 70,
    objectFit: "cover",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginRight: 4,
    marginBottom: 4,
  },
});

export interface DiagnosticReportData {
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

// Item-ийн утгыг текст болгоно (page.tsx-ийн renderValue-тэй ижил логик).
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

function DiagnosticReportPDF({ report }: { report: DiagnosticReportData }) {
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
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Үйлчлүүлэгч:</Text>
            <Text style={styles.rowValue}>{report.customerName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Утас:</Text>
            <Text style={styles.rowValue}>{report.customerPhone}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Машин:</Text>
            <Text style={styles.rowValue}>
              {report.vehicleMake} {report.vehicleModel}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Дугаар:</Text>
            <Text style={styles.rowValue}>{report.vehiclePlate}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Салбар:</Text>
            <Text style={styles.rowValue}>{report.branchName}</Text>
          </View>
          {report.filledByName ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Бөглөсөн:</Text>
              <Text style={styles.rowValue}>{report.filledByName}</Text>
            </View>
          ) : null}
          {report.mileageAtReport !== undefined ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Гүйлт:</Text>
              <Text style={styles.rowValue}>
                {report.mileageAtReport.toLocaleString("mn-MN")} км
              </Text>
            </View>
          ) : null}
          {report.notes ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Тэмдэглэл:</Text>
              <Text style={styles.rowValue}>{report.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* Оношилгооны хэсэг бүр + item-ууд (page.tsx-ийн бүтэцтэй ижил) */}
        {report.sections.map((section) => (
          <View key={section.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map((item) => {
              const positions = itemPositions(item);
              return (
                <View key={item.id} style={styles.itemBlock}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  {positions ? (
                    <View style={styles.positionWrap}>
                      {positions.map((pos) => (
                        <View key={pos.code}>
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

export function AdvancedPDFButton({ report }: { report: DiagnosticReportData }) {
  return (
    <PDFDownloadLink
      document={<DiagnosticReportPDF report={report} />}
      fileName={`diagnostic-report-${report.reportId}.pdf`}
      className="no-print text-xs px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 border border-emerald-400/20"
    >
      {({ loading }) => (loading ? "PDF үүсэж байна..." : "PDF хүүдүүлэх")}
    </PDFDownloadLink>
  );
}
