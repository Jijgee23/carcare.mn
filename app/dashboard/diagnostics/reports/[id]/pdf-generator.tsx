"use client";

import { useState } from "react";
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

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
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
        </View>

        {report.signatureUrl && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Үйлчлүүлэгчийн гарын үсэг</Text>
            <Image src={report.signatureUrl} style={{ width: 150, height: 80 }} />
          </View>
        )}
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
