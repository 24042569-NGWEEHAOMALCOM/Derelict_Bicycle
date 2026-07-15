import { useEffect, useState, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { collection, getDocs, doc, onSnapshot, runTransaction, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import QRCode from "qrcode";
import NotificationSystem from "../components/NotificationSystem";
import MapDisplay from "../components/MapDisplay";
import {
  BICYCLE_VISION_MODEL,
  compareBicycleImages,
} from "../services/bicycleVisionService";
import {
  exportMonthlyLuckyDrawToExcel,
  exportReportsToExcel,
} from "../utils/exportReportsToExcel";
import { sendClaimNotificationEmail } from "../services/emailService";

const statusOptions = [
  "All",
  "Reported",
  "Verified",
  "Verified: Improperly Parked",
  "Tagged",
  "Acknowledged - 1st Warning",
  "Acknowledged - 2nd Warning",
  "Removed",
  "Pending Owner Claim",
  "Closed",
  "Closed - Claimed",
  "Closed - Not Abandoned",
];

const verifiedImproperParkingStatus = "Verified: Improperly Parked";
const firstWarningStatus = "Acknowledged - 1st Warning";
const secondWarningStatus = "Acknowledged - 2nd Warning";
const lockedSecondWarningStatus =
  "Acknowledged - 2nd Warning (Bicycle has been locked)";

const getDisplayStatus = (status) => {
  if (status === firstWarningStatus || status === secondWarningStatus) {
    return status;
  }

  if (status === lockedSecondWarningStatus || status?.startsWith("Acknowledged -")) {
    return secondWarningStatus;
  }

  return status;
};

const statusActions = {
  Verified: [
    {
      label: "Mark Tagged",
      status: "Tagged",
      className: "btn btn-warning btn-sm",
    },
    {
      label: "Close Case",
      status: "Closed",
      className: "btn btn-success btn-sm",
    },
  ],
  [verifiedImproperParkingStatus]: [
    {
      label: "Mark Tagged",
      status: "Tagged",
      className: "btn btn-warning btn-sm",
    },
    {
      label: "Close Case",
      status: "Closed",
      className: "btn btn-success btn-sm",
    },
  ],
  Tagged: [
    {
      label: "Mark Removed",
      status: "Removed",
      className: "btn btn-danger btn-sm",
    },
    {
      label: "Close Case",
      status: "Closed",
      className: "btn btn-success btn-sm",
    },
  ],
  Removed: [
    {
      label: "Pending Owner Claim",
      status: "Pending Owner Claim",
      className: "btn btn-warning btn-sm",
    },
    {
      label: "Close as Claimed",
      status: "Closed - Claimed",
      className: "btn btn-success btn-sm",
    },
    {
      label: "Close Case",
      status: "Closed",
      className: "btn btn-success btn-sm",
    },
  ],
  "Pending Owner Claim": [
    {
      label: "Owner Collected - Close Claim",
      status: "Closed - Claimed",
      className: "btn btn-success btn-sm",
    },
    {
      label: "Close Case",
      status: "Closed",
      className: "btn btn-outline-success btn-sm",
    },
  ],
  Closed: [],
  "Closed - Claimed": [],
  "Closed - Not Abandoned": [],
  [firstWarningStatus]: [
    {
      label: "Close Case",
      status: "Closed",
      className: "btn btn-success btn-sm",
    },
  ],
  [secondWarningStatus]: [
    {
      label: "Close Case",
      status: "Closed",
      className: "btn btn-success btn-sm",
    },
  ],
  [lockedSecondWarningStatus]: [
    {
      label: "Close Case",
      status: "Closed",
      className: "btn btn-success btn-sm",
    },
  ],
};

const isImproperParkingReport = (report) => report?.caseType === "improperParking";

const getReportTypeLabel = (report) =>
  isImproperParkingReport(report)
    ? "Improperly Parked Bicycle"
    : "Abandoned Bicycle";

const getStatusActions = (report) => {
  if (!report) return [];

  const normalizedStatus = getDisplayStatus(report.status);
  const removeAction = {
    label: "Mark Removed",
    status: "Removed",
    className: "btn btn-danger btn-sm",
  };

  if (report.status === "Reported") {
    return [
      {
        label: "Mark Tagged",
        status: "Tagged",
        className: "btn btn-warning btn-sm",
      },
      {
        label: isImproperParkingReport(report)
          ? "Mark Verified: Improperly Parked"
          : "Mark Verified",
        status: isImproperParkingReport(report)
          ? verifiedImproperParkingStatus
          : "Verified",
        className: "btn btn-info btn-sm text-white",
      },
      {
        label: "Close Case",
        status: "Closed",
        className: "btn btn-success btn-sm",
      },
    ];
  }

  if (report.status === "Tagged" && isImproperParkingReport(report)) {
    return [
      removeAction,
      {
        label: "Close Case",
        status: "Closed",
        className: "btn btn-success btn-sm",
      },
    ];
  }

  if (report.status === "Verified" || report.status === verifiedImproperParkingStatus) {
    return [
      removeAction,
      {
        label: "Mark Tagged",
        status: "Tagged",
        className: "btn btn-warning btn-sm",
      },
      {
        label: "Close Case",
        status: "Closed",
        className: "btn btn-success btn-sm",
      },
    ];
  }

  if (normalizedStatus === firstWarningStatus) {
    return [removeAction, ...(statusActions[firstWarningStatus] || [])];
  }

  if (normalizedStatus === secondWarningStatus || report.status === lockedSecondWarningStatus) {
    return [
      removeAction,
      ...(statusActions[secondWarningStatus] || statusActions[lockedSecondWarningStatus] || []),
    ];
  }

  if (
    report.status === "Pending Owner Claim" ||
    report.status === "Closed" ||
    report.status === "Closed - Claimed" ||
    report.status === "Closed - Not Abandoned"
  ) {
    return [
      removeAction,
      ...(statusActions[report.status] || []),
    ];
  }

  return statusActions[report.status] || statusActions[normalizedStatus] || [];
};

const isClosedStatus = (status) =>
  status === "Closed" || status?.startsWith("Closed -");

const normalizePhoneNumber = (phoneNumber = "") =>
  String(phoneNumber).replace(/\D/g, "").replace(/^65(?=\d{8}$)/, "");

const isUnreadReport = (report) => report?.read === false;

const duplicateComparisonLimit = 10;

const getReportCreatedTime = (report) =>
  report?.createdAt?.toMillis?.() ||
  (report?.createdAt?.seconds ? report.createdAt.seconds * 1000 : 0);

const getLatestResponse = (report) => {
  if (!Array.isArray(report?.responseHistory) || report.responseHistory.length === 0) {
    return null;
  }

  return report.responseHistory[report.responseHistory.length - 1];
};

const getReportAcknowledgementPhone = (report) => {
  const latestResponse = getLatestResponse(report);

  return normalizePhoneNumber(
    report?.acknowledgementPhoneNormalized ||
      report?.acknowledgementPhone ||
      latestResponse?.phoneNormalized ||
      latestResponse?.phone
  );
};

const getLinkedFirstWarningReport = (report, allReports) => {
  if (
    !report ||
    !isImproperParkingReport(report) ||
    getDisplayStatus(report.status) !== secondWarningStatus
  ) {
    return null;
  }

  const linkedReportId =
    report.linkedFirstWarningReportId ||
    getLatestResponse(report)?.linkedFirstWarningReportId;
  const linkedReport = allReports.find(
    (candidateReport) => candidateReport.id === linkedReportId
  );

  if (linkedReport) return linkedReport;

  const acknowledgementPhone = getReportAcknowledgementPhone(report);
  if (!acknowledgementPhone) return null;

  return (
    allReports
      .filter(
        (candidateReport) =>
          candidateReport.id !== report.id &&
          isImproperParkingReport(candidateReport) &&
          getDisplayStatus(candidateReport.status) === firstWarningStatus &&
          getReportAcknowledgementPhone(candidateReport) === acknowledgementPhone
      )
      .sort(
        (first, second) =>
          getReportCreatedTime(second) - getReportCreatedTime(first)
      )[0] || null
  );
};

const getDuplicateVerdictLabel = (verdict) =>
  verdict === "likely_same" ? "Likely same" : "Uncertain";

const getDuplicateVerdictClass = (verdict) =>
  verdict === "likely_same" ? "bg-danger" : "bg-warning text-dark";

const getTopCounts = (items, fieldName, limit = 5) => {
  const countMap = items.reduce((currentCounts, item) => {
    const key = item[fieldName]?.trim();

    if (!key) return currentCounts;

    return {
      ...currentCounts,
      [key]: (currentCounts[key] || 0) + 1,
    };
  }, {});

  return Object.entries(countMap)
    .map(([label, count]) => ({
      label,
      count,
    }))
    .sort((firstItem, secondItem) => secondItem.count - firstItem.count)
    .slice(0, limit);
};

const getReportPointBalance = (report) =>
  Math.max(0, (report.pointsEarned || 0) - (report.luckyDrawDeductedPoints || 0));

const getResidentPoints = (items) => {
  const residentMap = items.reduce((current, report) => {
    const email = report.reporterEmail?.trim().toLowerCase();
    const name = report.reporterName?.trim();

    if (!email) return current;

    const existing = current[email] || {
      reporterEmail: email,
      reporterName: name || email,
      points: 0,
      reports: 0,
    };

    return {
      ...current,
      [email]: {
        ...existing,
        reporterName: existing.reporterName || name || email,
        points: existing.points + getReportPointBalance(report),
        reports: existing.reports + 1,
      },
    };
  }, {});

  return Object.values(residentMap).sort((first, second) => second.points - first.points);
};

const monthlyDrawThreshold = 100;
const monthlyDrawWinnerCount = 20;
const monthlyDrawVoucherValue = 5;
const monthlyDrawBudget = monthlyDrawWinnerCount * monthlyDrawVoucherValue;
const duplicateDrawErrorCode = "monthly-draw-already-finalized";

const getDeductionAmountForResident = (residentPoints) =>
  residentPoints >= monthlyDrawThreshold ? monthlyDrawThreshold : 0;

const getCurrentDrawMonth = () => new Date().toISOString().slice(0, 7);

const getDrawableMonths = (count = 12) => {
  const months = [];
  const date = new Date();
  date.setDate(1);

  for (let index = 0; index < count; index += 1) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    months.push(`${year}-${month}`);
    date.setMonth(date.getMonth() - 1);
  }

  return months;
};

const getDrawMonthLabel = (monthValue) => {
  if (!monthValue) return "Current month";

  const [year, month] = monthValue.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);

  if (Number.isNaN(date.getTime())) return monthValue;

  return date.toLocaleDateString("en-SG", {
    month: "long",
    year: "numeric",
  });
};

const pickMonthlyWinners = (eligibleResidents) => {
  const shuffledResidents = eligibleResidents.map((resident) => ({ ...resident }));

  for (let index = shuffledResidents.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffledResidents[index], shuffledResidents[randomIndex]] = [
      shuffledResidents[randomIndex],
      shuffledResidents[index],
    ];
  }

  return shuffledResidents
    .slice(0, monthlyDrawWinnerCount)
    .map((resident, index) => ({
      rank: index + 1,
      reporterEmail: resident.reporterEmail,
      reporterName: resident.reporterName || resident.reporterEmail,
      points: getDeductionAmountForResident(resident.points),
      totalPoints: resident.points,
      reports: resident.reports,
      voucherValue: monthlyDrawVoucherValue,
    }));
};

function Staff() {
  const [reports, setReports] = useState([]);
  const [monthlyLuckyDraws, setMonthlyLuckyDraws] = useState([]);
  const [isRunningDraw, setIsRunningDraw] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [duplicateCheckMessage, setDuplicateCheckMessage] = useState(null);
  const [selectedReportId, setSelectedReportId] = useState("");
  const [selectedDrawMonth, setSelectedDrawMonth] = useState("");
  const [drawRunMonth, setDrawRunMonth] = useState(getCurrentDrawMonth());
  const [exportAllReports, setExportAllReports] = useState(false);
  const location = useLocation();
  const listRefs = useRef({});
  const detailsRef = useRef(null);
  const reportListRef = useRef(null);
  const readUpdateAttemptsRef = useRef(new Set());

  const getReportList = async () => {
    const querySnapshot = await getDocs(collection(db, "reports"));

    return querySnapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data(),
    }));
  };

  const fetchReports = async () => {
    const reportList = await getReportList();

    setReports(reportList);
  };

  const updateStatus = async (reportId, newStatus) => {
    const currentReport = reports.find((report) => report.id === reportId);
    const allowedActions = getStatusActions(currentReport);
    const isAllowedStatus = allowedActions.some(
      (action) => action.status === newStatus
    );

    if (!isAllowedStatus) {
      alert("This status update is not allowed for the current case stage.");
      return;
    }

    const reportRef = doc(db, "reports", reportId);

    let updateData = {
      status: newStatus,
      updatedAt: new Date(),
    };

    if (
      newStatus === "Verified" ||
      newStatus === verifiedImproperParkingStatus
    ) {
      if (!currentReport.pointsEarned) {
        updateData.pointsEarned = 10;
      }
    }

    if (newStatus === "Closed" && currentReport.status === "Reported") {
      updateData.pointsEarned = 0;
    }

    if (newStatus === "Tagged") {

      try {

        console.log("Generating QR...");

        const tagDate = new Date();

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);

        const qrUrl = `${window.location.origin}/qr/${reportId}`;

        console.log("QR URL:", qrUrl);

        const qrCodeImage = await QRCode.toDataURL(qrUrl);

        console.log("QR GENERATED");

        updateData = {
          ...updateData,
          tagDate,
          expiryDate,
          qrUrl,
          qrCodeImage,
        };

      } catch (error) {

        console.error("QR ERROR:", error);

      }
    }

    await updateDoc(reportRef, updateData);

    // Send claim notification email if status changed to "Removed"
    if (newStatus === "Removed" && currentReport.reporterEmail) {
      const updatedReport = { ...currentReport, status: newStatus, ...updateData };
      await sendClaimNotificationEmail(updatedReport);
    }

    alert(`Status updated to ${newStatus}`);

    fetchReports();
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "reports"),
      (querySnapshot) => {
        const reportList = querySnapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }));

        setReports(reportList);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching reports:", error);
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "monthlyLuckyDraws"),
      (querySnapshot) => {
        const drawList = querySnapshot.docs
          .map((docItem) => ({
            id: docItem.id,
            ...docItem.data(),
          }))
          .sort((first, second) => second.id.localeCompare(first.id));

        setMonthlyLuckyDraws(drawList);
        if (!selectedDrawMonth) {
          setSelectedDrawMonth(drawList[0]?.id || "");
        }
      },
      (error) => {
        console.error("Error fetching monthly lucky draws:", error);
      }
    );

    return unsubscribe;
  }, [selectedDrawMonth]);

  // If a `report` query parameter is present, auto-select that report
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const reportId = params.get("report");
      if (reportId) {
        window.setTimeout(() => {
          setSelectedReportId(reportId);
        }, 0);
      }
    } catch {
      // ignore
    }
  }, [location.search]);

  useEffect(() => {
    if (!selectedReportId) return;

    const selectedReport = reports.find((report) => report.id === selectedReportId);
    if (!isUnreadReport(selectedReport)) return;
    if (readUpdateAttemptsRef.current.has(selectedReportId)) return;

    const readAt = new Date();
    readUpdateAttemptsRef.current.add(selectedReportId);

    setReports((currentReports) =>
      currentReports.map((report) =>
        report.id === selectedReportId
          ? { ...report, read: true, readAt }
          : report
      )
    );

    const markReportRead = async () => {
      try {
        await updateDoc(doc(db, "reports", selectedReportId), {
          read: true,
          readAt,
        });
      } catch (error) {
        console.error("Error marking report as read:", error);
        setReports((currentReports) =>
          currentReports.map((report) =>
            report.id === selectedReportId
              ? { ...report, read: false, readAt: selectedReport.readAt }
              : report
          )
        );
      }
    };

    markReportRead();
  }, [reports, selectedReportId]);

  // Scroll the selected report into view when it changes
  useEffect(() => {
    if (!selectedReportId) return;
    const el = listRefs.current[selectedReportId];
    if (el && el.scrollIntoView) {
      try {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus && el.focus();
      } catch {
        // ignore
      }
    }

    // Also scroll the details panel into view (right column) if present
    if (detailsRef.current && detailsRef.current.scrollIntoView) {
      try {
        detailsRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
        // ignore
      }
    }
  }, [selectedReportId]);

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const hasActiveFilters = statusFilter !== "All" || normalizedSearchTerm.length > 0;

  const filteredReports = reports.filter((report) => {
    const displayStatus = getDisplayStatus(report.status);
    const matchesStatus =
      statusFilter === "All" || displayStatus === statusFilter;

    const searchableText = [
      report.id,
      report.blockNumber,
      report.location,
      report.description,
      report.status,
      displayStatus,
      getReportTypeLabel(report),
      report.condition,
      report.hasLock,
      report.licensePlate,
      report.warningLevel,
      report.enforcementReviewRequired ? "enforcement review" : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch =
      !normalizedSearchTerm || searchableText.includes(normalizedSearchTerm);

    return matchesStatus && matchesSearch;
  });

  const selectedReport = reports.find((report) => report.id === selectedReportId);
  const selectedLinkedFirstWarningReport = getLinkedFirstWarningReport(
    selectedReport,
    reports
  );
  const unreadCount = reports.filter(isUnreadReport).length;
  const hasClaimResponse =
    selectedReport?.claimName ||
    selectedReport?.claimPhone ||
    selectedReport?.claimProof;
  const hasNotAbandonedResponse = selectedReport?.notAbandonedReason;
  const hasAcknowledgementResponse =
    selectedReport?.acknowledgementName ||
    selectedReport?.acknowledgementPhone ||
    selectedReport?.responseHistory?.length > 0;
  const hasResidentResponse =
    hasClaimResponse || hasNotAbandonedResponse || hasAcknowledgementResponse;
  const availableStatusActions = getStatusActions(selectedReport);
  const aiDuplicateReports = (selectedReport?.duplicateDetection?.matches || [])
    .map((match) => ({
      ...match,
      report: reports.find((report) => report.id === match.reportId),
    }))
    .filter((match) => match.report && !isClosedStatus(match.report.status));

  const handleCheckImageDuplicates = async () => {
    if (!selectedReport?.imageUrl) {
      setDuplicateCheckMessage({
        type: "warning",
        text: "This report does not have an image to compare.",
      });
      return;
    }

    const reportBeingChecked = selectedReport;
    const eligibleReports = reports
      .filter(
        (report) =>
          report.id !== reportBeingChecked.id &&
          report.caseType === reportBeingChecked.caseType &&
          report.imageUrl &&
          !isClosedStatus(report.status)
      )
      .sort(
        (first, second) =>
          getReportCreatedTime(second) - getReportCreatedTime(first)
      );
    const candidateReports = eligibleReports.slice(0, duplicateComparisonLimit);

    setIsCheckingDuplicates(true);
    setDuplicateCheckMessage(null);

    try {
      const matches = [];
      let failureCount = 0;

      for (const candidateReport of candidateReports) {
        try {
          const comparison = await compareBicycleImages(
            reportBeingChecked.imageUrl,
            candidateReport.imageUrl
          );

          if (comparison.verdict !== "likely_different") {
            matches.push({
              reportId: candidateReport.id,
              ...comparison,
            });
          }
        } catch (error) {
          failureCount += 1;
          console.error(
            `Could not compare report ${candidateReport.id}:`,
            error
          );
        }
      }

      const allComparisonsFailed =
        candidateReports.length > 0 && failureCount === candidateReports.length;
      const duplicateDetection = {
        status: allComparisonsFailed ? "failed" : "checked",
        provider: "firebase-ai-logic",
        model: BICYCLE_VISION_MODEL,
        checkedAt: new Date(),
        eligibleCount: eligibleReports.length,
        comparedCount: candidateReports.length - failureCount,
        skippedCount: Math.max(
          0,
          eligibleReports.length - candidateReports.length
        ),
        failureCount,
        matches,
      };

      await updateDoc(doc(db, "reports", reportBeingChecked.id), {
        duplicateDetection,
        updatedAt: new Date(),
      });

      setDuplicateCheckMessage({
        type: allComparisonsFailed ? "danger" : "success",
        text: allComparisonsFailed
          ? "Image comparison failed. Check Firebase AI Logic setup, App Check, and the free-tier quota before trying again."
          : `Compared ${duplicateDetection.comparedCount} report${duplicateDetection.comparedCount === 1 ? "" : "s"} and flagged ${matches.length} for staff review.`,
      });
    } catch (error) {
      console.error("Error checking duplicate bicycle images:", error);
      setDuplicateCheckMessage({
        type: "danger",
        text: "The duplicate check could not be saved. Please try again.",
      });
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  const statusCounts = statusOptions
    .filter((status) => status !== "All")
    .map((status) => ({
      status,
      count: reports.filter((report) => getDisplayStatus(report.status) === status).length,
    }));
  const dashboardMetrics = [
    {
      label: "Total Reports",
      count: reports.length,
    },
    {
      label: "Active Cases",
      count: reports.filter((report) => !isClosedStatus(report.status)).length,
    },
    {
      label: "Pending Claims",
      count: reports.filter((report) => report.status === "Removed" && !report.claimName).length,
    },
    {
      label: "Submitted Claims",
      count: reports.filter((report) => report.status === "Pending Owner Claim").length,
    },
    {
      label: "Resident Responses",
      count: reports.filter(
        (report) =>
          report.claimName ||
          report.claimPhone ||
          report.claimProof ||
          report.notAbandonedReason ||
          report.acknowledgementName ||
          report.acknowledgementPhone ||
          report.responseHistory?.length > 0
      ).length,
    },
    {
      label: "Closed Cases",
      count: reports.filter((report) => isClosedStatus(report.status)).length,
    },
  ];
  const topBlocks = getTopCounts(reports, "blockNumber");
  const residentPointSummary = getResidentPoints(reports);
  const eligibleDrawResidents = residentPointSummary.filter(
    (resident) => resident.points >= monthlyDrawThreshold
  );
  const currentDrawMonth = getCurrentDrawMonth();
  const drawableMonths = getDrawableMonths();
  const currentLuckyDraw = monthlyLuckyDraws.find(
    (draw) => draw.id === currentDrawMonth
  );
  const selectedRunLuckyDraw = monthlyLuckyDraws.find(
    (draw) => draw.id === drawRunMonth
  );
  const selectedRunMonthLabel = getDrawMonthLabel(drawRunMonth);
  const latestLuckyDraw = currentLuckyDraw || monthlyLuckyDraws[0];
  const displayedLuckyDraw = monthlyLuckyDraws.find(
    (draw) => draw.id === selectedDrawMonth
  ) || latestLuckyDraw;
  const topLocations = getTopCounts(reports, "location");

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("All");
  };

  const filterBySearchTerm = (term) => {
    setSearchTerm(term);
    setStatusFilter("All");
    setSelectedReportId("");
  };

  const filterByStatus = (status) => {
    setSearchTerm("");
    setStatusFilter(status);
    setSelectedReportId("");

    setTimeout(() => {
      reportListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  };

  const getExportButtonLabel = () => {
    if (exportAllReports) return "Export All Reports";
    if (statusFilter !== "All") return `Export ${statusFilter} Reports`;
    if (searchTerm.trim()) return "Export Search Results";
    return "Export Current View";
  };

  const getExportFilePrefix = () => {
    if (exportAllReports) return "all-reports";
    if (statusFilter !== "All") {
      return statusFilter
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }
    if (searchTerm.trim()) return "search-results";
    return "current-view";
  };

  const handleExportReports = () => {
    const exportList = exportAllReports ? reports : filteredReports;
    exportReportsToExcel(
      exportList,
      getReportTypeLabel,
      getDisplayStatus,
      exportAllReports ? "all-reports" : getExportFilePrefix()
    );
  };

  const handleExportMonthlyLuckyDraw = () => {
    exportMonthlyLuckyDrawToExcel(displayedLuckyDraw);
  };

  const runLuckyDrawForMonth = async (monthValue, monthLabel, eligibleResidents) => {
    if (eligibleResidents.length === 0) {
      alert("No residents have reached 100 points yet.");
      return;
    }

    const existingDraw = monthlyLuckyDraws.find((draw) => draw.id === monthValue);

    if (existingDraw) {
      alert(`${monthLabel} lucky draw has already been finalized. The saved winners cannot be replaced from the dashboard.`);
      return;
    }

    const winners = pickMonthlyWinners(eligibleResidents);
    const drawRef = doc(db, "monthlyLuckyDraws", monthValue);
    const now = new Date();
    const totalVoucherUsed = winners.reduce(
      (total, winner) => total + (Number(winner.voucherValue) || monthlyDrawVoucherValue),
      0
    );
    const unusedBudget = Math.max(0, monthlyDrawBudget - totalVoucherUsed);

    setIsRunningDraw(true);

    try {
      await runTransaction(db, async (transaction) => {
        const drawSnap = await transaction.get(drawRef);

        if (drawSnap.exists()) {
          const error = new Error("Monthly lucky draw already finalized.");
          error.code = duplicateDrawErrorCode;
          throw error;
        }

        eligibleResidents.forEach((resident) => {
          const pointsToDeduct = getDeductionAmountForResident(resident.points);

          if (pointsToDeduct <= 0) return;

          let remainingPointsToDeduct = pointsToDeduct;
          const residentReports = reports
            .filter(
              (report) =>
                report.reporterEmail?.trim().toLowerCase() === resident.reporterEmail
            )
            .sort(
              (firstReport, secondReport) =>
                getReportCreatedTime(firstReport) - getReportCreatedTime(secondReport)
            );

          residentReports.forEach((report) => {
            if (remainingPointsToDeduct <= 0) return;

            const availablePoints = getReportPointBalance(report);
            if (availablePoints <= 0) return;

            const deductionForThisReport = Math.min(
              availablePoints,
              remainingPointsToDeduct
            );

            remainingPointsToDeduct -= deductionForThisReport;

            transaction.update(doc(db, "reports", report.id), {
              luckyDrawDeductedPoints:
                (report.luckyDrawDeductedPoints || 0) + deductionForThisReport,
            });
          });
        });

        transaction.set(drawRef, {
          month: monthValue,
          monthLabel,
          createdAt: now,
          finalizedAt: now,
          updatedAt: now,
          status: "Finalized",
          locked: true,
          threshold: monthlyDrawThreshold,
          eligibleCount: eligibleResidents.length,
          winnerCount: winners.length,
          maxWinners: monthlyDrawWinnerCount,
          voucherValue: monthlyDrawVoucherValue,
          monthlyBudget: monthlyDrawBudget,
          totalVoucherUsed,
          unusedBudget,
          budgetCarriedForward: false,
          winners,
        });
      });

      setSelectedDrawMonth(monthValue);
      alert(`${winners.length} winner${winners.length === 1 ? "" : "s"} selected for ${monthLabel}.`);
    } catch (error) {
      if (error.code === duplicateDrawErrorCode) {
        alert(`${monthLabel} lucky draw has already been finalized by another staff member. Refreshing saved winners now.`);
        return;
      }

      console.error("Error running monthly lucky draw:", error);
      alert("Could not save the monthly lucky draw. Please try again.");
    } finally {
      setIsRunningDraw(false);
    }
  };

  const runMonthlyLuckyDraw = async () => {
    await runLuckyDrawForMonth(
      drawRunMonth,
      selectedRunMonthLabel,
      eligibleDrawResidents
    );
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "Not available";

    const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);

    if (Number.isNaN(date.getTime())) return "Not available";

    return date.toLocaleDateString("en-SG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getBadgeClass = (status) => {

    if (status === "Reported")
      return "bg-secondary";

    if (status === "Verified")
      return "bg-info";

    if (status === verifiedImproperParkingStatus)
      return "bg-info text-white";

    if (status === "Tagged")
      return "bg-warning text-dark";

    if (status === firstWarningStatus)
      return "bg-warning text-dark";

    if (getDisplayStatus(status) === secondWarningStatus)
      return "bg-danger";

    if (status === "Removed")
      return "bg-danger";
    if (status === "Pending Owner Claim")
      return "bg-warning text-dark";

    if (status === "Closed")
      return "bg-success";

    if (status === "Closed - Claimed")
      return "bg-success";

    if (status === "Closed - Not Abandoned")
      return "bg-success";

    return "bg-secondary";
  };

  const getBreakdownStatusLabel = (status) => {
    const labelMap = {
      Reported: "New Report",
      Verified: "Verified",
      [verifiedImproperParkingStatus]: "Verified (Improper Parking)",
      Tagged: "Tagged for Removal",
      [firstWarningStatus]: "1st Warning Sent",
      [secondWarningStatus]: "2nd Warning Sent",
      Removed: "Removed",
      "Pending Owner Claim": "Waiting for Owner",
      Closed: "Closed",
      "Closed - Claimed": "Closed (Claimed)",
      "Closed - Not Abandoned": "Closed (Not Abandoned)",
    };

    return labelMap[status] || status;
  };

  const getBreakdownBadgeClass = (status) => {
    if (status === "Reported") return "bg-secondary";

    if (status === "Verified" || status === verifiedImproperParkingStatus) {
      return "bg-info text-white";
    }

    if (
      status === "Tagged" ||
      status === firstWarningStatus ||
      getDisplayStatus(status) === secondWarningStatus
    ) {
      return "bg-warning text-dark";
    }

    if (status === "Removed" || status === "Pending Owner Claim") {
      return "bg-danger text-white";
    }

    if (
      status === "Closed" ||
      status === "Closed - Claimed" ||
      status === "Closed - Not Abandoned"
    ) {
      return "bg-success text-white";
    }

    return "bg-secondary";
  };

  return (
    <div className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-5">
        <div>
          <h1 className="fw-bold display-5">
            Staff Dashboard
          </h1>

          <p className="text-muted fs-4">
            Manage reported bicycles, update statuses, and track case progress.
          </p>
        </div>

        <NotificationSystem />
      </div>

      <div className="row g-4 mb-5">

        {dashboardMetrics.map((metric) => (
          <div className="col-md-3" key={metric.label}>
            <div className="portal-card text-center">
              <h2 className="fw-bold">
                {metric.count}
              </h2>

              <p className="text-muted m-0">
                {metric.label}
              </p>
            </div>
          </div>
        ))}

      </div>

      <div className="portal-card mb-5" style={{ minHeight: "auto" }}>
        <div className="mb-4">
          <h2 className="fw-bold h3">
            Top Resident Contributors
          </h2>

          <p className="text-muted fs-5 mb-0">
            Residents with {monthlyDrawThreshold} points are eligible for the monthly lucky draw. Up to {monthlyDrawWinnerCount} winners receive a ${monthlyDrawVoucherValue} NTUC voucher each month.
          </p>

          <p className="fw-semibold mt-2 mb-0">
            Total resident contributors: {residentPointSummary.length}
          </p>
        </div>

        {residentPointSummary.length === 0 ? (
          <p className="text-muted mb-0">
            No resident contributors yet.
          </p>
        ) : (
          <div className="table-responsive contributor-table-scroll">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Email</th>
                  <th className="text-end">Points</th>
                  <th className="text-end">Monthly Draw</th>
                  <th className="text-end">Reports</th>
                </tr>
              </thead>
              <tbody>
                {residentPointSummary.map((resident) => (
                  <tr key={resident.reporterEmail}>
                    <td>{resident.reporterName || resident.reporterEmail}</td>
                    <td>{resident.reporterEmail}</td>
                    <td className="text-end fw-bold">{resident.points}</td>
                    <td className="text-end fw-bold">
                      {resident.points >= monthlyDrawThreshold ? "Eligible" : "Not yet"}
                    </td>
                    <td className="text-end fw-bold">{resident.reports}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-top mt-4 pt-4">
          <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-4">
            <div>
              <h3 className="h5 fw-bold mb-2">
                Monthly Lucky Draw
              </h3>

              <p className="text-muted mb-0">
                {eligibleDrawResidents.length} resident{eligibleDrawResidents.length === 1 ? "" : "s"} currently eligible. Select the month to finalize before running the draw.
              </p>
            </div>

            <div className="text-lg-end">
              {selectedRunLuckyDraw && (
                <div className="alert alert-success py-2 px-3 mb-2 text-start">
                  {selectedRunMonthLabel} draw finalized. Saved winners are locked.
                </div>
              )}

              <div className="mb-2 text-start text-lg-end">
                <label className="form-label small mb-1" htmlFor="drawRunMonth">
                  Draw month
                </label>
                <select
                  id="drawRunMonth"
                  className="form-select form-select-sm"
                  value={drawRunMonth}
                  onChange={(event) => setDrawRunMonth(event.target.value)}
                  disabled={isRunningDraw}
                >
                  {drawableMonths.map((monthValue) => (
                    <option key={monthValue} value={monthValue}>
                      {getDrawMonthLabel(monthValue)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="btn btn-primary"
                type="button"
                onClick={runMonthlyLuckyDraw}
                disabled={isRunningDraw || eligibleDrawResidents.length === 0 || Boolean(selectedRunLuckyDraw)}
              >
                {isRunningDraw ? "Running Draw..." : selectedRunLuckyDraw ? "Draw Already Finalized" : `Run ${selectedRunMonthLabel} Draw`}
              </button>

              <p className="text-muted small mt-2 mb-0">
                Monthly budget: ${monthlyDrawBudget}. Unused budget is not carried forward.
              </p>
            </div>
          </div>

          {!monthlyLuckyDraws.length ? (
            <div className="alert alert-secondary mb-0">
              No monthly lucky draw has been saved yet.
            </div>
          ) : (
            <div>
              <div className="d-flex flex-column flex-md-row justify-content-between gap-2 mb-3">
                <div>
                  <p className="text-uppercase text-muted small mb-1">
                    {displayedLuckyDraw?.id === currentDrawMonth ? "Current Month Winners" : "Saved Winners"}
                  </p>

                  <h4 className="h6 fw-bold mb-0">
                    {displayedLuckyDraw?.monthLabel || getDrawMonthLabel(displayedLuckyDraw?.month || displayedLuckyDraw?.id)}
                  </h4>
                </div>

                <div className="text-md-end">
                  <div className="d-flex flex-column align-items-start align-items-md-end gap-2">
                    <div className="text-start text-md-end">
                      <label className="form-label small mb-1" htmlFor="drawMonthSelect">
                        View month
                      </label>
                      <select
                        id="drawMonthSelect"
                        className="form-select form-select-sm"
                        value={selectedDrawMonth || displayedLuckyDraw?.id || ""}
                        onChange={(event) => setSelectedDrawMonth(event.target.value)}
                      >
                        {monthlyLuckyDraws.map((draw) => (
                          <option key={draw.id} value={draw.id}>
                            {draw.monthLabel || getDrawMonthLabel(draw.month || draw.id)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      className="btn btn-success btn-sm"
                      type="button"
                      onClick={handleExportMonthlyLuckyDraw}
                      disabled={!displayedLuckyDraw}
                    >
                      Export selected month to Excel
                    </button>
                  </div>
                </div>
              </div>

              {!displayedLuckyDraw ? (
                <div className="alert alert-secondary mb-0">
                  No monthly lucky draw is available for this selection.
                </div>
              ) : displayedLuckyDraw.winners?.length > 0 ? (
                <div>
                  <div className="d-flex flex-column flex-md-row justify-content-between gap-2 mb-3">
                    <div>
                      <p className="fw-bold mb-1">
                        {displayedLuckyDraw.winnerCount || displayedLuckyDraw.winners?.length || 0} winner{(displayedLuckyDraw.winnerCount || displayedLuckyDraw.winners?.length || 0) === 1 ? "" : "s"}
                      </p>
                    </div>

                    <div className="text-md-end">
                      <p className="text-muted small mb-0">
                        {displayedLuckyDraw.eligibleCount || 0} eligible resident{(displayedLuckyDraw.eligibleCount || 0) === 1 ? "" : "s"} at draw time
                      </p>
                      <p className="text-muted small mb-0">
                        Budget used: ${displayedLuckyDraw.totalVoucherUsed ?? ((displayedLuckyDraw.winnerCount || displayedLuckyDraw.winners?.length || 0) * (displayedLuckyDraw.voucherValue || monthlyDrawVoucherValue))} / ${displayedLuckyDraw.monthlyBudget || monthlyDrawBudget}
                      </p>
                      <p className="text-muted small mb-0">
                        Unused budget: ${displayedLuckyDraw.unusedBudget ?? Math.max(0, (displayedLuckyDraw.monthlyBudget || monthlyDrawBudget) - ((displayedLuckyDraw.winnerCount || displayedLuckyDraw.winners?.length || 0) * (displayedLuckyDraw.voucherValue || monthlyDrawVoucherValue)))}. Not carried forward.
                      </p>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Winner</th>
                          <th>Email</th>
                          <th className="text-end">Points</th>
                          <th className="text-end">Voucher</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedLuckyDraw.winners.map((winner) => (
                          <tr key={`${displayedLuckyDraw.id}-${winner.reporterEmail}`}>
                            <td>{winner.rank}</td>
                            <td>{winner.reporterName || winner.reporterEmail}</td>
                            <td>{winner.reporterEmail}</td>
                            <td className="text-end fw-bold">{winner.points}</td>
                            <td className="text-end fw-bold">${winner.voucherValue || monthlyDrawVoucherValue}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="alert alert-secondary mb-0">
                  This saved draw has no winners.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="portal-card mb-5" style={{ minHeight: "auto" }}>
        <div className="mb-4">
          <h2 className="fw-bold h3">
            Hotspot Analytics
          </h2>

          <p className="text-muted fs-5 mb-0">
            Identify repeated report areas and monitor case distribution.
          </p>
        </div>

        <div className="row g-4">
          <div className="col-lg-4">
            <div className="border rounded-3 p-3 h-100">
              <h3 className="h5 fw-bold mb-3">
                Status Breakdown
              </h3>

              <div className="d-flex flex-column gap-2">
                {statusCounts.map((item) => (
                  <div
                    className="d-flex justify-content-between align-items-center"
                    key={item.status}
                  >
                    <button
                      className={`badge border-0 ${getBreakdownBadgeClass(item.status)}`}
                      onClick={() => filterByStatus(item.status)}
                      type="button"
                    >
                      {getBreakdownStatusLabel(item.status)}
                    </button>

                    <span className="fw-bold">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-top mt-3 pt-3">
                <p className="small text-muted mb-2">Legend</p>
                <div className="d-flex flex-column gap-2 small">
                  <div className="d-flex align-items-center gap-2">
                    <span className="rounded-circle bg-info" style={{ width: "10px", height: "10px", display: "inline-block" }} />
                    <span>New / verified cases</span>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <span className="rounded-circle bg-warning" style={{ width: "10px", height: "10px", display: "inline-block" }} />
                    <span>Action needed / warnings</span>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <span className="rounded-circle bg-danger" style={{ width: "10px", height: "10px", display: "inline-block" }} />
                    <span>Removed / waiting for owner</span>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <span className="rounded-circle bg-success" style={{ width: "10px", height: "10px", display: "inline-block" }} />
                    <span>Resolved cases</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="border rounded-3 p-3 h-100">
              <h3 className="h5 fw-bold mb-3">
                Top Reported Blocks
              </h3>

              {topBlocks.length === 0 ? (
                <p className="text-muted mb-0">
                  No block data available.
                </p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Block</th>
                        <th className="text-end">Reports</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topBlocks.map((block) => (
                        <tr key={block.label}>
                          <td>
                            <button
                              className="btn btn-link btn-sm p-0 text-start"
                              onClick={() => filterBySearchTerm(block.label)}
                              type="button"
                            >
                              {block.label}
                            </button>
                          </td>
                          <td className="text-end fw-bold">{block.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="col-lg-4">
            <div className="border rounded-3 p-3 h-100">
              <h3 className="h5 fw-bold mb-3">
                Top Reported Locations
              </h3>

              {topLocations.length === 0 ? (
                <p className="text-muted mb-0">
                  No location data available.
                </p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Location</th>
                        <th className="text-end">Reports</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topLocations.map((location) => (
                        <tr key={location.label}>
                          <td>
                            <button
                              className="btn btn-link btn-sm p-0 text-start"
                              onClick={() => filterBySearchTerm(location.label)}
                              type="button"
                            >
                              {location.label}
                            </button>
                          </td>
                          <td className="text-end fw-bold">{location.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="portal-card mb-5" style={{ minHeight: "auto" }}>
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start gap-3 mb-3">
          <div>
            <h3 className="h5 fw-bold mb-2">Find Reports</h3>
            <p className="text-muted mb-0">
              Search or filter the report list. The export section below will use this filtered view unless you choose all reports.
            </p>
          </div>
        </div>

        <div className="row g-3 align-items-end">
          <div className="col-lg-7">
            <label className="form-label" htmlFor="staffSearch">
              Search Reports
            </label>

            <input
              className="form-control form-control-lg"
              id="staffSearch"
              type="text"
              placeholder="Search by report ID, block, location, description or status"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="col-md-6 col-lg-3">
            <label className="form-label" htmlFor="statusFilter">
              Status
            </label>

            <select
              className="form-select form-select-lg"
              id="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {statusOptions.map((status) => (
                <option value={status} key={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-6 col-lg-2">
            <button
              className="btn btn-outline-secondary btn-lg w-100"
              type="button"
              onClick={clearFilters}
            >
              Clear
            </button>
          </div>
        </div>

        <p className="text-muted small mt-3 mb-2">
          Current view: {filteredReports.length} filtered report{filteredReports.length === 1 ? "" : "s"} out of {reports.length}.
        </p>

        <div className="border-top mt-4 pt-4">
          <div className="d-flex flex-column flex-md-row justify-content-between gap-3 align-items-start">
            <div>
              <h3 className="h5 fw-bold mb-2">Export Excel Sheet</h3>
              <p className="text-muted mb-0">
                Download a clearer report spreadsheet with report links, resident response type, claim details, and point balances.
              </p>
            </div>

            <div className="staff-export-actions">
              <div className="staff-export-checkbox mb-3">
                <input
                  className="form-check-input staff-export-checkbox-input"
                  type="checkbox"
                  id="exportAllReports"
                  checked={exportAllReports}
                  onChange={(event) => setExportAllReports(event.target.checked)}
                />
                <label className="staff-export-checkbox-label" htmlFor="exportAllReports">
                  Ignore filters and export all reports
                </label>
              </div>

              <button
                className="btn btn-success"
                type="button"
                onClick={handleExportReports}
                disabled={exportAllReports ? reports.length === 0 : filteredReports.length === 0}
              >
                {getExportButtonLabel()}
              </button>

              <p className="text-muted small mt-2 mb-0">
                {exportAllReports
                  ? "Filename: bicycle-all-reports-[date].xlsx. Reports are separated into status tabs."
                  : hasActiveFilters
                  ? `Filename: bicycle-${getExportFilePrefix()}-[date].xlsx. This export matches your current selection.`
                  : "No filters are active, so the current view export includes every report."}
              </p>
            </div>
          </div>
        </div>

        <p className="text-muted mt-3 mb-0">
          Showing {filteredReports.length} of {reports.length} reports.
        </p>
      </div>

      {reports.length === 0 ? (

        <div className="portal-card text-center">
          <p className="fs-5 text-muted m-0">
            {isLoading ? "Loading reports..." : "No reports found."}
          </p>
        </div>

      ) : filteredReports.length === 0 ? (

        <div className="portal-card text-center">
          <p className="fs-5 text-muted mb-3">
            No reports match your current search or filter.
          </p>

          <button
            className="btn btn-outline-primary"
            type="button"
            onClick={clearFilters}
          >
            Clear Filters
          </button>
        </div>

      ) : (

        <div className="row g-4" ref={reportListRef}>
          <div className="col-lg-5">
            <div className="portal-card h-100" style={{ minHeight: "auto" }}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h2 className="h4 fw-bold mb-0">
                  Report List
                </h2>

                <span className="badge bg-light text-dark">
                  {filteredReports.length} shown
                </span>
              </div>

              {unreadCount > 0 && (
                <div className="d-flex align-items-center justify-content-between rounded border bg-light px-3 py-2 mb-3">
                  <span className="small fw-semibold text-dark">
                    New submitted reports
                  </span>
                  <span className="badge bg-danger">
                    {unreadCount} unread
                  </span>
                </div>
              )}

              <div className="list-group">
                {filteredReports.map((report) => {
                  const isUnread = isUnreadReport(report);
                  const linkedFirstWarningReport = getLinkedFirstWarningReport(
                    report,
                    reports
                  );

                  return (
                    <button
                      ref={(el) => (listRefs.current[report.id] = el)}
                      className={`list-group-item list-group-item-action ${
                        selectedReportId === report.id ? "active" : ""
                      } ${isUnread ? "border-start border-4 border-danger" : ""}`}
                      type="button"
                      key={report.id}
                      onClick={() => setSelectedReportId(report.id)}
                    >
                      <div className="staff-report-row d-flex justify-content-between align-items-start gap-3">
                        <div className="staff-report-summary text-start">
                          <p className="staff-report-id fw-semibold mb-1">
                            {isUnread && (
                              <span className="badge bg-danger me-2">
                                New
                              </span>
                            )}
                            {report.id}
                          </p>

                          <p className="small mb-0">
                            Block {report.blockNumber || "N/A"} -{" "}
                            {report.location || "No location"}
                          </p>

                          <p className="small mb-0 mt-1 text-muted">
                            {getReportTypeLabel(report)}
                          </p>

                          {report.imageUrl && (
                            <p className="small mb-0 mt-1">
                              Image attached
                            </p>
                          )}

                          {report.bicycleType && (
                            <p className="small mb-0 mt-1 text-muted">
                              {report.condition || 'Unknown condition'}
                            </p>
                          )}

                          {linkedFirstWarningReport && (
                            <p className="small mb-0 mt-1 text-muted">
                              Linked 1st warning: {linkedFirstWarningReport.id}
                            </p>
                          )}
                        </div>

                        <span className={`staff-report-status-badge badge ${getBadgeClass(report.status)}`}>
                          {getDisplayStatus(report.status) || "Unknown"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="col-lg-7">
            <div className="portal-card h-100" style={{ minHeight: "auto" }}>
              {!selectedReport ? (
                <div className="text-center py-5">
                  <h2 className="h4 fw-bold">
                    Select a report
                  </h2>

                  <p className="text-muted fs-5 mb-0">
                    Click a report ID from the list to view full details and update its status.
                  </p>
                </div>
              ) : (
                <>
                  <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-start gap-3 mb-4">
                    <div>
                      <h2 className="h3 fw-bold mb-2">
                        Block {selectedReport.blockNumber || "N/A"}
                      </h2>

                      <p className="text-muted mb-0">
                        Report ID: <span className="fw-semibold">{selectedReport.id}</span>
                      </p>

                      <p className="text-muted mb-0">
                        Case Type: <span className="fw-semibold">{getReportTypeLabel(selectedReport)}</span>
                      </p>
                    </div>

                    <span className={`badge fs-6 ${getBadgeClass(selectedReport.status)}`}>
                      {getDisplayStatus(selectedReport.status) || "Unknown"}
                    </span>
                  </div>

                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <div className="border rounded-3 p-3 h-100">
                        <p className="text-muted small text-uppercase mb-1">
                          Location
                        </p>

                        <p className="fw-semibold mb-0">
                          {selectedReport.location || "Not provided"}
                        </p>
                      </div>
                    </div>

                    <div className="col-md-6">
                      <div className="border rounded-3 p-3 h-100">
                        <p className="text-muted small text-uppercase mb-1">
                          Submitted
                        </p>

                        <p className="fw-semibold mb-0">
                          {formatDate(selectedReport.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="col-12">
                      <div className="border rounded-3 p-3">
                        <p className="text-muted small text-uppercase mb-1">
                          Description
                        </p>

                        <p className="mb-0">
                          {selectedReport.description || "No description provided."}
                        </p>
                      </div>
                    </div>

                    {/* Asset Details Section */}
                    {(selectedReport.bicycleType || selectedReport.condition || selectedReport.hasLock || selectedReport.licensePlate || selectedReport.gpsLocation) && (
                      <div className="col-12">
                        <div className="border rounded-3 p-3">
                          <p className="text-muted small text-uppercase mb-3">
                            Asset Details
                          </p>
                          <div className="row g-3">
                            {selectedReport.condition && (
                              <div className="col-md-6 col-lg-3">
                                <p className="text-muted small text-uppercase mb-1">Condition</p>
                                <p className="fw-semibold mb-0">{selectedReport.condition}</p>
                              </div>
                            )}
                            {selectedReport.hasLock && (
                              <div className="col-md-6 col-lg-3">
                                <p className="text-muted small text-uppercase mb-1">Lock Status</p>
                                <p className="fw-semibold mb-0">{selectedReport.hasLock}</p>
                              </div>
                            )}
                            {selectedReport.licensePlate && (
                              <div className="col-md-6 col-lg-3">
                                <p className="text-muted small text-uppercase mb-1">License Plate</p>
                                <p className="fw-semibold mb-0">{selectedReport.licensePlate}</p>
                              </div>
                            )}
                            {selectedReport.gpsLocation && (
                                      <div className="col-12" ref={detailsRef}>
                                        <p className="text-muted small text-uppercase mb-2">GPS Coordinates</p>
                                        <p className="fw-semibold mb-2">
                                          {selectedReport.gpsLocation.latitude.toFixed(6)}, {selectedReport.gpsLocation.longitude.toFixed(6)}
                                        </p>
                                        <MapDisplay
                                          latitude={selectedReport.gpsLocation.latitude}
                                          longitude={selectedReport.gpsLocation.longitude}
                                        />
                                      </div>
                                    )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="col-12">
                      <div className="border rounded-3 p-3">
                        <p className="text-muted small text-uppercase mb-2">
                          Uploaded Image
                        </p>

                        {selectedReport.imageUrl ? (
                          <img
                            className="report-image"
                            src={selectedReport.imageUrl}
                            alt={`Reported bicycle at Block ${
                              selectedReport.blockNumber || "unknown"
                            }`}
                          />
                        ) : (
                          <p className="text-muted mb-0">
                            No image was uploaded for this report.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="col-12">
                      <div className="border rounded-3 p-3">
                        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-start gap-2 mb-3">
                          <div>
                            <h3 className="h5 fw-bold mb-1">
                              Possible Duplicate Reports
                            </h3>

                            <p className="text-muted mb-0">
                              Gemini compares the bicycle image with up to {duplicateComparisonLimit}{" "}
                              recent open reports of the same case type. Staff
                              must confirm every result.
                            </p>
                          </div>

                          <div className="d-flex align-items-center gap-2">
                            <span className="badge bg-light text-dark">
                              {aiDuplicateReports.length} flagged
                            </span>

                            <button
                              className="btn btn-primary btn-sm"
                              type="button"
                              disabled={!selectedReport.imageUrl || isCheckingDuplicates}
                              onClick={handleCheckImageDuplicates}
                            >
                              {isCheckingDuplicates
                                ? "Checking images..."
                                : selectedReport.duplicateDetection?.status === "checked"
                                  ? "Run Check Again"
                                  : "Check Image Duplicates"}
                            </button>
                          </div>
                        </div>

                        {duplicateCheckMessage?.type !== "success" && duplicateCheckMessage && (
                          <div
                            className={`alert alert-${duplicateCheckMessage.type}`}
                            role="alert"
                          >
                            {duplicateCheckMessage.text}
                          </div>
                        )}

                        {!selectedReport.imageUrl ? (
                          <div className="alert alert-secondary mb-0">
                            This report has no image, so visual duplicate checking
                            is unavailable.
                          </div>
                        ) : selectedReport.duplicateDetection?.status === "failed" &&
                          !duplicateCheckMessage ? (
                          <div className="alert alert-danger mb-0">
                            The previous image comparison failed. Check Firebase AI
                            Logic, App Check, and the available free-tier quota.
                          </div>
                        ) : selectedReport.duplicateDetection?.status !== "checked" &&
                          aiDuplicateReports.length === 0 ? (
                          <div className="alert alert-secondary mb-0">
                            This report has not been checked by Gemini yet.
                          </div>
                        ) : aiDuplicateReports.length === 0 ? (
                          <div className="alert alert-success mb-0">
                            No visually similar bicycles were flagged.
                          </div>
                        ) : (
                          <div className="vstack gap-3">
                            {aiDuplicateReports.map((match) => (
                              <div
                                className="duplicate-report-match border rounded-3 p-3"
                                key={match.report.id}
                              >
                                <div className="d-flex flex-column flex-md-row justify-content-between gap-3">
                                  <div>
                                    <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                                      <p className="fw-semibold mb-0">
                                        {match.report.id}
                                      </p>

                                      <span className={`badge ${getBadgeClass(match.report.status)}`}>
                                        {getDisplayStatus(match.report.status) || "Unknown"}
                                      </span>

                                      <span
                                        className={`badge ${getDuplicateVerdictClass(match.verdict)}`}
                                      >
                                        {getDuplicateVerdictLabel(match.verdict)}
                                      </span>
                                    </div>

                                    <p className="mb-1">
                                      Block {match.report.blockNumber || "N/A"} -{" "}
                                      Postal Code {match.report.location || "N/A"}
                                    </p>

                                    <p className="text-muted small mb-2">
                                      Submitted {formatDate(match.report.createdAt)}
                                    </p>

                                    {match.matchingFeatures?.length > 0 && (
                                      <div className="mb-2">
                                        <p className="small fw-semibold mb-1">
                                          Matching visible features
                                        </p>
                                        <ul className="small mb-0 ps-3">
                                          {match.matchingFeatures.map((feature, index) => (
                                            <li key={`${match.report.id}-match-${index}`}>
                                              {feature}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {match.conflictingFeatures?.length > 0 && (
                                      <div>
                                        <p className="small fw-semibold mb-1">
                                          Conflicting visible features
                                        </p>
                                        <ul className="small mb-0 ps-3">
                                          {match.conflictingFeatures.map((feature, index) => (
                                            <li key={`${match.report.id}-conflict-${index}`}>
                                              {feature}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>

                                  <div className="text-md-end">
                                    <img
                                      className="d-block rounded border mb-2 ms-md-auto"
                                      src={match.report.imageUrl}
                                      alt={`Bicycle in possible duplicate report ${match.report.id}`}
                                      style={{
                                        width: "112px",
                                        height: "84px",
                                        objectFit: "cover",
                                      }}
                                    />

                                    <button
                                      className="btn btn-outline-primary btn-sm"
                                      type="button"
                                      onClick={() => setSelectedReportId(match.report.id)}
                                    >
                                      View Report
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}

                            {selectedReport.duplicateDetection?.checkedAt && (
                              <p className="text-muted small mb-0">
                                Last checked {formatDate(selectedReport.duplicateDetection.checkedAt)}
                                {selectedReport.duplicateDetection.skippedCount > 0
                                  ? ` · ${selectedReport.duplicateDetection.skippedCount} older candidate(s) skipped to preserve the free quota.`
                                  : ""}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h3 className="h5 fw-bold mb-3">
                      Resident Response
                    </h3>

                    {!hasResidentResponse ? (
                      <div className="alert alert-secondary mb-0">
                        No claim, not-abandoned response, or acknowledgement has been submitted for this report.
                      </div>
                    ) : (
                      <div className="row g-3">
                        {hasClaimResponse && (
                          <div className="col-12">
                            <div className="border rounded-3 p-3 bg-light">
                              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                                <h4 className="h6 fw-bold mb-0">
                                  Bicycle Claim
                                </h4>

                                <span className={`badge ${selectedReport.status === "Pending Owner Claim" ? "bg-warning text-dark" : "bg-success"}`}>
                                  {selectedReport.status === "Pending Owner Claim" ? "Claim Submitted" : "Claimed"}
                                </span>
                              </div>

                              <div className="row g-3">
                                <div className="col-md-6">
                                  <p className="text-muted small text-uppercase mb-1">
                                    Name
                                  </p>

                                  <p className="fw-semibold mb-0">
                                    {selectedReport.claimName || "Not provided"}
                                  </p>
                                </div>

                                <div className="col-md-6">
                                  <p className="text-muted small text-uppercase mb-1">
                                    Phone
                                  </p>

                                  <p className="fw-semibold mb-0">
                                    {selectedReport.claimPhone || "Not provided"}
                                  </p>
                                </div>

                                <div className="col-12">
                                  <p className="text-muted small text-uppercase mb-1">
                                    Proof / Description
                                  </p>

                                  <p className="mb-0">
                                    {selectedReport.claimProof || "Not provided"}
                                  </p>
                                </div>

                                <div className="col-12">
                                  <p className="text-muted small text-uppercase mb-1">
                                    Submitted
                                  </p>

                                  <p className="mb-0">
                                    {formatDate(selectedReport.claimedAt)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {hasNotAbandonedResponse && (
                          <div className="col-12">
                            <div className="border rounded-3 p-3 bg-light">
                              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                                <h4 className="h6 fw-bold mb-0">
                                  Not Abandoned Report
                                </h4>

                                <span className="badge bg-primary">
                                  Not Abandoned
                                </span>
                              </div>

                              <p className="text-muted small text-uppercase mb-1">
                                Reason
                              </p>

                              <p>
                                {selectedReport.notAbandonedReason}
                              </p>

                              <p className="text-muted small text-uppercase mb-1">
                                Submitted
                              </p>

                              <p className="mb-0">
                                {formatDate(selectedReport.notAbandonedAt)}
                              </p>
                            </div>
                          </div>
                        )}

                        {hasAcknowledgementResponse && (
                          <div className="col-12">
                            <div className="border rounded-3 p-3 bg-light">
                              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                                <h4 className="h6 fw-bold mb-0">
                                  Improper Parking Acknowledgement
                                </h4>

                                <span className="badge bg-warning text-dark">
                                  {selectedReport.warningLevel || "Warning recorded"}
                                </span>
                              </div>

                              {selectedLinkedFirstWarningReport && (
                                <div className="alert alert-info d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
                                  <div>
                                    <p className="fw-semibold mb-1">
                                      Linked 1st warning report
                                    </p>

                                    <p className="mb-0">
                                      {selectedLinkedFirstWarningReport.id}
                                    </p>
                                  </div>

                                  <button
                                    className="btn btn-outline-primary btn-sm"
                                    type="button"
                                    onClick={() =>
                                      setSelectedReportId(
                                        selectedLinkedFirstWarningReport.id
                                      )
                                    }
                                  >
                                    View Linked Report
                                  </button>
                                </div>
                              )}

                              {selectedReport.enforcementReviewRequired && (
                                <div className="alert alert-danger">
                                  This case is flagged for further Town Council
                                  review and possible enforcement action.
                                </div>
                              )}

                              <div className="row g-3">
                                <div className="col-md-6">
                                  <p className="text-muted small text-uppercase mb-1">
                                    Owner Name
                                  </p>

                                  <p className="fw-semibold mb-0">
                                    {selectedReport.acknowledgementName || "Not provided"}
                                  </p>
                                </div>

                                <div className="col-md-6">
                                  <p className="text-muted small text-uppercase mb-1">
                                    Phone
                                  </p>

                                  <p className="fw-semibold mb-0">
                                    {selectedReport.acknowledgementPhone || "Not provided"}
                                  </p>
                                </div>

                                <div className="col-12">
                                  <p className="text-muted small text-uppercase mb-1">
                                    Response History
                                  </p>

                                  {selectedReport.responseHistory?.length > 0 ? (
                                    <div className="table-responsive">
                                      <table className="table table-sm align-middle mb-0">
                                        <thead>
                                          <tr>
                                            <th>Warning</th>
                                            <th>Submitted</th>
                                            <th>Response</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {selectedReport.responseHistory.map((response, index) => (
                                            <tr key={`${response.submittedAt || "response"}-${index}`}>
                                              <td>{response.warningLevel}</td>
                                              <td>{formatDate(response.submittedAt)}</td>
                                              <td>{response.notes || "Acknowledged"}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <p className="mb-0">No history entries available.</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {selectedReport.qrCodeImage && (
                    <div className="mt-3 mb-4">
                      <h3 className="h5 fw-bold">
                        QR Code Tag
                      </h3>

                      <img
                        src={selectedReport.qrCodeImage}
                        alt="QR Code"
                        style={{
                          width: "160px",
                          height: "160px",
                          border: "1px solid #ccc",
                          padding: "8px",
                          borderRadius: "8px",
                          background: "white",
                        }}
                      />

                      <p className="text-muted small mt-2">
                        <strong>Scan URL:</strong>
                        <br />
                        {selectedReport.qrUrl}
                      </p>

                      {selectedReport.expiryDate && (
                        <p className="text-muted small">
                          <strong>Notice expires:</strong>{" "}
                          {formatDate(selectedReport.expiryDate)}
                        </p>
                      )}

                      <button
                        className="btn btn-outline-primary btn-sm"
                        type="button"
                        onClick={() => window.print()}
                      >
                        Print Current Page
                      </button>

                      <Link
                        className="btn btn-primary btn-sm ms-2"
                        to={`/notice/${selectedReport.id}`}
                      >
                        Open Printable Notice
                      </Link>
                    </div>
                  )}

                  <div>
                    <h3 className="h5 fw-bold mb-3">
                      Update Status
                    </h3>

                    {availableStatusActions.length === 0 ? (
                      <div className="alert alert-secondary mb-0">
                        This case is in a final status. No further staff status updates are available.
                      </div>
                    ) : (
                      <div className="d-flex flex-wrap gap-2">
                        {availableStatusActions.map((action) => (
                          <button
                            className={action.className}
                            key={action.status}
                            type="button"
                            onClick={() =>
                              updateStatus(selectedReport.id, action.status)
                            }
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

      )}
    </div>
  );
}

export default Staff;
