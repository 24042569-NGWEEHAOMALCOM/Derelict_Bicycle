import { useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";

import { db } from "../firebase/firebase";

const monthlyStartingCompliancePoints = 100;
const monthlyRecoveryPoints = 10;
const incentiveThreshold = 80;

const normalizePhoneNumber = (phoneNumber) =>
  phoneNumber.replace(/\D/g, "").replace(/^65(?=\d{8}$)/, "");

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

const getRecoveryPointsSinceLastOffence = (latestSubmittedAt) => {
  if (!latestSubmittedAt) return 0;

  const latestDate = new Date(latestSubmittedAt);

  if (Number.isNaN(latestDate.getTime())) return 0;

  const thirtyDaysInMilliseconds = 30 * 24 * 60 * 60 * 1000;
  const monthsWithoutOffence = Math.floor(
    (Date.now() - latestDate.getTime()) / thirtyDaysInMilliseconds
  );

  return Math.max(monthsWithoutOffence, 0) * monthlyRecoveryPoints;
};

const getSubmittedAt = (report) => {
  if (report.acknowledgedAt?.toDate) {
    return report.acknowledgedAt.toDate().toISOString();
  }

  return report.acknowledgedAt || "";
};

const getComplianceEntries = (reports, normalizedPhone) => {
  const entries = [];

  reports.forEach((report) => {
    if (report.responseHistory?.length > 0) {
      report.responseHistory.forEach((response) => {
        const responsePhone = response.phoneNormalized || response.phone || "";

        if (
          normalizedPhone &&
          normalizePhoneNumber(responsePhone) !== normalizedPhone
        ) {
          return;
        }

        entries.push({
          compliancePoints:
            response.compliancePoints ?? monthlyStartingCompliancePoints,
          pointsDeducted: response.pointsDeducted ?? 0,
          recoveryPointsApplied: response.recoveryPointsApplied ?? 0,
          warningLevel: response.warningLevel || "Warning recorded",
          submittedAt: response.submittedAt || "",
        });
      });

      return;
    }

    entries.push({
      compliancePoints:
        report.compliancePoints ?? monthlyStartingCompliancePoints,
      pointsDeducted:
        report.offencePointsDeducted ?? report.compliancePointsDeducted ?? 0,
      recoveryPointsApplied: report.recoveryPointsApplied ?? 0,
      warningLevel: report.warningLevel || "Warning recorded",
      submittedAt: getSubmittedAt(report),
    });
  });

  return entries.sort((firstEntry, secondEntry) => {
    const firstDate = new Date(firstEntry.submittedAt || 0).getTime();
    const secondDate = new Date(secondEntry.submittedAt || 0).getTime();

    return firstDate - secondDate;
  });
};

function CheckCompliance() {
  const [phone, setPhone] = useState("");
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (event) => {
    event.preventDefault();

    const trimmedPhone = phone.trim();
    const normalizedPhone = normalizePhoneNumber(trimmedPhone);

    if (!normalizedPhone) {
      setSummary(null);
      setMessage({
        type: "danger",
        text: "Please enter a phone number.",
      });
      return;
    }

    setIsSearching(true);
    setMessage(null);
    setSummary(null);

    try {
      const reportMap = new Map();
      const lookupQueries = [
        query(
          collection(db, "reports"),
          where("acknowledgementPhoneNormalized", "==", normalizedPhone)
        ),
        query(
          collection(db, "reports"),
          where("acknowledgementPhone", "==", trimmedPhone)
        ),
      ];

      if (normalizedPhone !== trimmedPhone) {
        lookupQueries.push(
          query(
            collection(db, "reports"),
            where("acknowledgementPhone", "==", normalizedPhone)
          )
        );
      }

      const querySnapshots = await Promise.all(
        lookupQueries.map((lookupQuery) => getDocs(lookupQuery))
      );

      querySnapshots.forEach((querySnapshot) => {
        querySnapshot.docs.forEach((docItem) => {
          reportMap.set(docItem.id, {
            id: docItem.id,
            ...docItem.data(),
          });
        });
      });

      const complianceEntries = getComplianceEntries(
        Array.from(reportMap.values()),
        normalizedPhone
      );
      const latestEntry = complianceEntries[complianceEntries.length - 1];
      const recoveryPointsAvailable = getRecoveryPointsSinceLastOffence(
        latestEntry?.submittedAt
      );
      const latestStoredPoints =
        latestEntry?.compliancePoints ?? monthlyStartingCompliancePoints;
      const currentCompliancePoints = Math.min(
        latestStoredPoints + recoveryPointsAvailable,
        monthlyStartingCompliancePoints
      );

      setSummary({
        currentCompliancePoints,
        eligibleForIncentive:
          currentCompliancePoints >= incentiveThreshold,
        offenceCount: complianceEntries.length,
        latestStoredPoints,
        lastOffenceDate: latestEntry?.submittedAt || "",
        latestWarningLevel: latestEntry?.warningLevel || "",
        recoveryPointsAvailable,
      });
    } catch (error) {
      console.error("Error checking compliance points:", error);
      setMessage({
        type: "danger",
        text: "We could not check your compliance points right now. Please try again.",
      });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="portal-card mx-auto" style={{ maxWidth: "860px" }}>
        <div className="mb-4">
          <h1 className="fw-bold mb-3">Check Compliance Points</h1>
          <p className="text-muted fs-5 mb-0">
            Enter the phone number to check whether the score meets the 80/100 incentive requirement.
          </p>
        </div>

        <form onSubmit={handleSearch} className="mb-4">
          <label className="form-label" htmlFor="compliancePhone">
            Phone Number
          </label>
          <div className="input-group input-group-lg">
            <input
              className="form-control"
              id="compliancePhone"
              type="tel"
              placeholder="Example: 91234567"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={isSearching}
            />
            <button
              className="btn btn-primary px-4"
              type="submit"
              disabled={isSearching}
            >
              {isSearching ? "Checking..." : "Check"}
            </button>
          </div>
        </form>

        {message && (
          <div className={`alert alert-${message.type} mb-0`} role="alert">
            {message.text}
          </div>
        )}

        {summary && (
          <div className="border rounded-3 p-4 bg-light">
            <div className="d-flex flex-column flex-md-row justify-content-between gap-3 mb-4">
              <div>
                <h2 className="fw-bold h3 mb-2">
                  {summary.currentCompliancePoints}/100
                </h2>
                <p className="text-muted mb-0">
                  Current compliance points
                </p>
              </div>

              <div>
                <span
                  className={`badge fs-6 ${
                    summary.eligibleForIncentive
                      ? "bg-success"
                      : "bg-warning text-dark"
                  }`}
                >
                  {summary.eligibleForIncentive
                    ? "Eligible for incentive"
                    : "Below incentive threshold"}
                </span>
              </div>
            </div>

            <div className="row g-3">
              <div className="col-md-6">
                <div className="bg-white rounded-3 border p-3 h-100">
                  <p className="text-muted small text-uppercase mb-1">
                    Incentive Requirement
                  </p>
                  <p className="fs-5 fw-semibold mb-0">
                    At least {incentiveThreshold}/100
                  </p>
                </div>
              </div>

              <div className="col-md-6">
                <div className="bg-white rounded-3 border p-3 h-100">
                  <p className="text-muted small text-uppercase mb-1">
                    Recorded Offences
                  </p>
                  <p className="fs-5 fw-semibold mb-0">
                    {summary.offenceCount}
                  </p>
                </div>
              </div>

              <div className="col-md-6">
                <div className="bg-white rounded-3 border p-3 h-100">
                  <p className="text-muted small text-uppercase mb-1">
                    Last Recorded Offence
                  </p>
                  <p className="mb-0">
                    {summary.offenceCount > 0
                      ? formatDate(summary.lastOffenceDate)
                      : "No offences found"}
                  </p>
                </div>
              </div>

              <div className="col-md-6">
                <div className="bg-white rounded-3 border p-3 h-100">
                  <p className="text-muted small text-uppercase mb-1">
                    Recovery Applied Since Last Offence
                  </p>
                  <p className="mb-0">
                    +{summary.recoveryPointsAvailable} points
                  </p>
                </div>
              </div>

              <div className="col-12">
                <div
                  className={`alert mb-0 ${
                    summary.eligibleForIncentive
                      ? "alert-success"
                      : "alert-warning"
                  }`}
                >
                  {summary.eligibleForIncentive
                    ? "This score qualifies for the $5 NTUC voucher incentive at the end of the month."
                    : "This score does not currently meet the 80/100 requirement for the $5 NTUC voucher incentive."}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CheckCompliance;
