// Email service to send notifications to residents
// Uses Firebase Cloud Function endpoint

const CLOUD_FUNCTION_URL = import.meta.env.VITE_SEND_CLAIM_EMAIL_FUNCTION || "";

export const sendClaimNotificationEmail = async (report) => {
  if (!CLOUD_FUNCTION_URL) {
    console.warn("Email service not configured. Skipping email notification.");
    return { success: false, error: "Email service not configured" };
  }

  if (!report.reporterEmail) {
    console.warn("No reporter email found for report:", report.id);
    return { success: false, error: "Reporter email not found" };
  }

  const claimLink = `${window.location.origin}/claim/${report.id}?email=${encodeURIComponent(
    report.reporterEmail
  )}`;

  try {
    const response = await fetch(CLOUD_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reportId: report.id,
        reporterEmail: report.reporterEmail,
        bicycleLocation: report.location || "Unknown location",
        blockNumber: report.blockNumber || "N/A",
        claimLink: claimLink,
        bicycleType: report.bicycleType || "Unknown type",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Email service error:", errorData);
      return { success: false, error: errorData.error || "Failed to send email" };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error("Error sending claim notification email:", error);
    return { success: false, error: error.message };
  }
};

export const sendReminderEmail = async (report, daysRemaining) => {
  if (!CLOUD_FUNCTION_URL) {
    console.warn("Email service not configured. Skipping reminder email.");
    return { success: false, error: "Email service not configured" };
  }

  const claimLink = `${window.location.origin}/claim/${report.id}?email=${encodeURIComponent(
    report.reporterEmail
  )}`;

  try {
    const response = await fetch(CLOUD_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "reminder",
        reportId: report.id,
        reporterEmail: report.reporterEmail,
        daysRemaining,
        claimLink,
      }),
    });

    if (!response.ok) {
      console.error("Reminder email failed");
      return { success: false };
    }

    return { success: true };
  } catch (error) {
    console.error("Error sending reminder email:", error);
    return { success: false };
  }
};
