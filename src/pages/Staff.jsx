import { useEffect, useState, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { collection, getDocs, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import QRCode from "qrcode";
import NotificationSystem from "../components/NotificationSystem";
import MapDisplay from "../components/MapDisplay";

const statusOptions = [
  "All",
  "Reported",
  "Verified",
  "Verified: Improperly Parked",
  "Tagged",
  "Acknowledged - 1st Warning",
  "Acknowledged - 2nd Warning",
  "Removed",
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
      label: "Close Case",
      status: "Closed",
      className: "btn btn-success btn-sm",
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

  if (report.status === "Reported") {
    return [
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
      {
        label: "Close Case",
        status: "Closed",
        className: "btn btn-success btn-sm",
      },
    ];
  }

  return statusActions[report.status] || [];
};

const isClosedStatus = (status) =>
  status === "Closed" || status?.startsWith("Closed -");

const isUnreadReport = (report) => report?.read === false;

const cleanText = (value) => String(value || "").trim().toLowerCase();

const getPossibleDuplicateReports = (selectedReport, reportList) => {
  if (!selectedReport) return [];

  const same = (firstValue, secondValue) =>
    cleanText(firstValue) === cleanText(secondValue);
  const words = cleanText(selectedReport.description)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/);
  const plate = cleanText(selectedReport.licensePlate);

  return reportList
    .filter(
      (report) =>
        report.id !== selectedReport.id &&
        report.caseType === selectedReport.caseType &&
        same(report.blockNumber, selectedReport.blockNumber) &&
        same(report.location, selectedReport.location)
    )
    .map((report) => ({
      report,
      reasons: [
        "same case type",
        "same block and postal code",
        ...(words.some(
          (word) => word.length > 2 && cleanText(report.description).includes(word)
        )
          ? ["similar description"]
          : []),
        ...(plate && same(plate, report.licensePlate)
          ? ["same license plate"]
          : []),
      ],
    }))
    .slice(0, 5);
};

const seenReportsStorageKey = "staffSeenReportIds";

const getStoredSeenReportIds = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(seenReportsStorageKey) || "[]"));
  } catch (error) {
    return new Set();
  }
};

const storeSeenReportIds = (seenReportIds) => {
  try {
    localStorage.setItem(
      seenReportsStorageKey,
      JSON.stringify(Array.from(seenReportIds))
    );
  } catch (error) {
    console.error("Error storing seen reports:", error);
  }
};

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
        points: existing.points + (report.pointsEarned || 0),
        reports: existing.reports + 1,
      },
    };
  }, {});

  return Object.values(residentMap).sort((first, second) => second.points - first.points);
};

function Staff() {
  const [reports, setReports] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReportId, setSelectedReportId] = useState("");
  const location = useLocation();
  const listRefs = useRef({});
  const detailsRef = useRef(null);
  const readUpdateAttemptsRef = useRef(new Set());
  const seenReportIdsRef = useRef(getStoredSeenReportIds());
  const hasSeenBaselineRef = useRef(
    localStorage.getItem(seenReportsStorageKey) !== null
  );

  const applyReadState = (reportList) => {
    if (!hasSeenBaselineRef.current) {
      seenReportIdsRef.current = new Set(reportList.map((report) => report.id));
      storeSeenReportIds(seenReportIdsRef.current);
      hasSeenBaselineRef.current = true;
    }

    return reportList.map((report) => ({
      ...report,
      read:
        report.read === false || !seenReportIdsRef.current.has(report.id)
          ? false
          : true,
    }));
  };

  const getReportList = async () => {
    const querySnapshot = await getDocs(collection(db, "reports"));

    return querySnapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data(),
    }));
  };

  const fetchReports = async () => {
    const reportList = await getReportList();

    setReports(applyReadState(reportList));
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

        setReports(applyReadState(reportList));
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching reports:", error);
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  // If a `report` query parameter is present, auto-select that report
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const reportId = params.get("report");
      if (reportId) {
        setSelectedReportId(reportId);
      }
    } catch (err) {
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
    seenReportIdsRef.current.add(selectedReportId);
    storeSeenReportIds(seenReportIdsRef.current);

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
      } catch (err) {
        // ignore
      }
    }

    // Also scroll the details panel into view (right column) if present
    if (detailsRef.current && detailsRef.current.scrollIntoView) {
      try {
        detailsRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch (err) {
        // ignore
      }
    }
  }, [selectedReportId]);

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

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
  const possibleDuplicateReports = getPossibleDuplicateReports(selectedReport, reports);
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
  const topResidentContributors = residentPointSummary.slice(0, 5);
  const topLocations = getTopCounts(reports, "location");

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("All");
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

    if (status === "Closed")
      return "bg-success";

    if (status === "Closed - Claimed")
      return "bg-success";

    if (status === "Closed - Not Abandoned")
      return "bg-primary";

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
            Points are tracked per reporter email. Every verified report earns 10 points and 100 points earns one $5 NTUC voucher.
          </p>
        </div>

        {topResidentContributors.length === 0 ? (
          <p className="text-muted mb-0">
            No resident contribution data is available yet.
          </p>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Email</th>
                  <th className="text-end">Points</th>
                  <th className="text-end">Vouchers</th>
                  <th className="text-end">Reports</th>
                </tr>
              </thead>
              <tbody>
                {topResidentContributors.map((resident) => (
                  <tr key={resident.reporterEmail}>
                    <td>{resident.reporterName || resident.reporterEmail}</td>
                    <td>{resident.reporterEmail}</td>
                    <td className="text-end fw-bold">{resident.points}</td>
                    <td className="text-end fw-bold">{Math.floor(resident.points / 100)}</td>
                    <td className="text-end fw-bold">{resident.reports}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                    <span className={`badge ${getBadgeClass(item.status)}`}>
                      {item.status}
                    </span>

                    <span className="fw-bold">
                      {item.count}
                    </span>
                  </div>
                ))}
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
                          <td>{block.label}</td>
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
                          <td>{location.label}</td>
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

        <div className="row g-4">
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
                              Matched using case type, block and postal code,
                              description, and license plate.
                            </p>
                          </div>

                          <span className="badge bg-light text-dark">
                            {possibleDuplicateReports.length} matches
                          </span>
                        </div>

                        {possibleDuplicateReports.length === 0 ? (
                          <div className="alert alert-secondary mb-0">
                            No likely duplicate reports found.
                          </div>
                        ) : (
                          <div className="vstack gap-3">
                            {possibleDuplicateReports.map((match) => (
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
                                    </div>

                                    <p className="mb-1">
                                      Block {match.report.blockNumber || "N/A"} -{" "}
                                      Postal Code {match.report.location || "N/A"}
                                    </p>

                                    <p className="text-muted small mb-2">
                                      Submitted {formatDate(match.report.createdAt)}
                                    </p>

                                    <div className="d-flex flex-wrap gap-2">
                                      {match.reasons.map((reason) => (
                                        <span
                                          className="badge bg-light text-dark border"
                                          key={`${match.report.id}-${reason}`}
                                        >
                                          {reason}
                                        </span>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="text-md-end">
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

                                <span className="badge bg-success">
                                  Claimed
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
