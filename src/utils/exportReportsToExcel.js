import { utils, writeFile } from "xlsx";

const formatCellValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (value?.toDate) {
    return value.toDate().toLocaleString("en-SG");
  }

  if (value instanceof Date) {
    return value.toLocaleString("en-SG");
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatCellValue(item)).join(" | ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
};

const formatResponseHistory = (responseHistory) => {
  if (!Array.isArray(responseHistory) || responseHistory.length === 0) {
    return "";
  }

  return responseHistory
    .map((entry) => {
      const parts = [entry?.status, entry?.message, entry?.phone, entry?.name]
        .filter(Boolean)
        .join(" | ");
      return parts || JSON.stringify(entry);
    })
    .join(" || ");
};

const formatDuplicateDetection = (duplicateDetection) => {
  if (!duplicateDetection) {
    return "";
  }

  const matches = Array.isArray(duplicateDetection.matches)
    ? duplicateDetection.matches.map((match) => match.reportId || match.id || JSON.stringify(match)).join(", ")
    : "";

  return [
    duplicateDetection.status,
    duplicateDetection.provider,
    duplicateDetection.model,
    `Compared: ${duplicateDetection.comparedCount || 0}`,
    `Matches: ${matches}`,
  ]
    .filter(Boolean)
    .join(" | ");
};

export function exportReportsToExcel(reports, getReportTypeLabel, getDisplayStatus) {
  const rows = reports.map((report) => ({
    "Report ID": report.id || "",
    "Type": getReportTypeLabel(report),
    "Status": getDisplayStatus(report.status),
    "Block": report.blockNumber || "",
    "Location": report.location || "",
    "Description": report.description || "",
    "Reporter Name": report.reporterName || "",
    "Reporter Email": report.reporterEmail || "",
    "Reporter Phone": report.reporterPhone || "",
    "Condition": report.condition || "",
    "Has Lock": report.hasLock || "",
    "License Plate": report.licensePlate || "",
    "Warning Level": report.warningLevel || "",
    "Enforcement Review Required": report.enforcementReviewRequired ? "Yes" : "No",
    "Claim Name": report.claimName || "",
    "Claim Phone": report.claimPhone || "",
    "Claim Proof": report.claimProof || "",
    "Not Abandoned Reason": report.notAbandonedReason || "",
    "Acknowledgement Name": report.acknowledgementName || "",
    "Acknowledgement Phone": report.acknowledgementPhone || "",
    "Response History": formatResponseHistory(report.responseHistory),
    "Image URL": report.imageUrl || "",
    "QR URL": report.qrUrl || "",
    "Tag Date": formatCellValue(report.tagDate),
    "Expiry Date": formatCellValue(report.expiryDate),
    "Duplicate Detection": formatDuplicateDetection(report.duplicateDetection),
    "Created At": formatCellValue(report.createdAt),
    "Updated At": formatCellValue(report.updatedAt),
    "Points Earned": report.pointsEarned || 0,
    "Points Balance": Math.max(0, (report.pointsEarned || 0) - (report.luckyDrawDeductedPoints || 0)),
    "Read": report.read ? "Yes" : "No",
  }));

  const worksheet = utils.json_to_sheet(rows);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Reports");

  const fileName = `reports-${new Date().toISOString().slice(0, 10)}.xlsx`;
  writeFile(workbook, fileName);
}
