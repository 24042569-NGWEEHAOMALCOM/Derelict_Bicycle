import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebase";

function NotificationSystem() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    // Listen for new reports that need attention
    const q = query(
      collection(db, "reports"),
      where("status", "in", ["Reported", "Verified", "Verified: Improperly Parked"]),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const newNotifications = [];
      querySnapshot.forEach((doc) => {
        const report = { id: doc.id, ...doc.data() };
        // Only show notifications for reports created in the last 24 hours
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (report.createdAt && report.createdAt.toDate() > oneDayAgo) {
          newNotifications.push({
            id: report.id,
            type: "new_report",
            message: `New ${report.status.toLowerCase()} report at Block ${report.blockNumber}`,
            timestamp: report.createdAt,
            read: false,
            caseId: report.id,
          });
        }
      });

      setNotifications(newNotifications.slice(0, 5)); // Show only latest 5

      // Browser notification for new reports
      if (newNotifications.length > 0 && "Notification" in window && Notification.permission === "granted") {
        const latestReport = newNotifications[0];
        new Notification("New Bicycle Report", {
          body: latestReport.message,
          icon: "/vite.svg",
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNotificationClick = (notification) => {
    // Navigate to the staff dashboard and open the reported case
    navigate(`/staff?report=${notification.caseId}`);
    setShowNotifications(false);
  };

  return (
    <div className="position-relative">
      <button
        className="btn btn-outline-secondary position-relative"
        onClick={() => setShowNotifications(!showNotifications)}
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
            {unreadCount}
          </span>
        )}
      </button>

      {showNotifications && (
        <div className="position-absolute top-100 end-0 mt-2 bg-white border rounded shadow" style={{ width: "320px", zIndex: 1050 }}>
          <div className="p-3 border-bottom">
            <h6 className="mb-0">📢 New Reports</h6>
          </div>
          <div style={{ maxHeight: "350px", overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <div className="p-3 text-muted text-center">
                No new notifications
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-3 border-bottom"
                  style={{
                    cursor: "pointer",
                    backgroundColor: "#f8f9fa",
                    transition: "background-color 0.2s",
                  }}
                  onClick={() => handleNotificationClick(notification)}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e9ecef")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f8f9fa")}
                >
                  <p className="mb-1 small fw-semibold">{notification.message}</p>
                  <small className="text-muted">
                    {notification.timestamp?.toDate().toLocaleString()}
                  </small>
                  <div className="mt-2">
                    <span className="badge bg-primary">View Case →</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationSystem;
