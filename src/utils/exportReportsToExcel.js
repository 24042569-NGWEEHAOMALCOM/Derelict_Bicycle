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

const formatLuckyDrawDateTime = (value) => {
  if (!value) return "";

  const date = value?.toDate ? value.toDate() : new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date
    .toLocaleString("en-SG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(",", " -");
};

const moneyText = (value) => {
  const amount = Number(value) || 0;
  return amount ? `$${amount}` : "";
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

export function exportMonthlyLuckyDrawToExcel(draw) {
  if (!draw) return;

  const winners = Array.isArray(draw.winners) ? draw.winners : [];
  const monthLabel = draw.monthLabel || draw.month || draw.id || "monthly-lucky-draw";
  const totalVoucherUsed = winners.reduce(
    (total, winner) => total + (Number(winner.voucherValue) || Number(draw.voucherValue) || 0),
    0
  );
  const monthlyBudget = Number(draw.monthlyBudget) || 0;
  const budgetLeft = Math.max(0, monthlyBudget - totalVoucherUsed);
  const voucherValue = Number(draw.voucherValue) || Number(winners[0]?.voucherValue) || 0;
  const title = `${monthLabel} Monthly Lucky Draw`.toUpperCase();
  const winnerRows = Array.from({ length: 20 }, (_, index) => {
    const winner = winners[index];

    return [
      winner ? String(index + 1) : "",
      winner?.reporterName || winner?.reporterEmail || "",
      winner?.reporterEmail || "",
    ];
  });
  const rows = [
    [title],
    [],
    ["Created:", formatLuckyDrawDateTime(draw.createdAt), ""],
    ["Last Updated:", formatLuckyDrawDateTime(draw.updatedAt), ""],
    [],
    ["Winners", "Voucher", ""],
    [String(draw.winnerCount || winners.length), moneyText(voucherValue), ""],
    [],
    ["Monthly Budget", moneyText(monthlyBudget), ""],
    ["Budget Left", moneyText(budgetLeft), ""],
    [],
    ["Winner List"],
    [],
    ["#", "Resident Name", "Resident Email"],
    ...winnerRows,
  ];

  const workbook = utils.book_new();
  const worksheet = utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 18 },
    { wch: 36 },
    { wch: 48 },
  ];
  worksheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 2, c: 1 }, e: { r: 2, c: 2 } },
    { s: { r: 3, c: 1 }, e: { r: 3, c: 2 } },
    { s: { r: 11, c: 0 }, e: { r: 11, c: 2 } },
  ];
  Object.keys(worksheet)
    .filter((cellKey) => !cellKey.startsWith("!"))
    .forEach((cellKey) => {
      worksheet[cellKey].s = {
        alignment: {
          horizontal: "center",
          vertical: "center",
        },
      };
    });
  utils.book_append_sheet(workbook, worksheet, "Monthly Lucky Draw");

  const safeMonth = (draw.month || draw.id || new Date().toISOString().slice(0, 7))
    .replace(/[^a-z0-9-]/gi, "-")
    .toLowerCase();
  writeFile(workbook, `monthly-lucky-draw-${safeMonth}.xlsx`);
}
