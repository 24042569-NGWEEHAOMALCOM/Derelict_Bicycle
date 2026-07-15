# Email Notification Setup Guide

## Overview
The system now supports automatic email notifications when bicycles are marked as "Removed". Residents receive a direct claim link via email.

## Architecture

### Client-Side (Frontend)
- **emailService.js**: Makes HTTP requests to a Cloud Function
- **Staff.jsx**: Triggers email when status changes to "Removed"
- **ClaimBike.jsx**: Accepts pre-filled email from URL params

### Server-Side (Cloud Function)
- Handles email sending using SendGrid or Firebase Admin SDK
- Sends claim link to resident email

---

## Setup Instructions

### Step 1: Environment Variables

Add to your `.env.local` file:

```env
VITE_SEND_CLAIM_EMAIL_FUNCTION=https://your-region-your-project.cloudfunctions.net/sendClaimNotificationEmail
```

Replace `your-region` and `your-project` with your Firebase project details.

---

### Step 2: Create Firebase Cloud Function

Create a `functions` folder in your project root (if not exists):

```bash
firebase init functions
```

Install dependencies in `functions/package.json`:

```bash
cd functions
npm install cors express nodemailer dotenv
```

### Step 3: Create sendClaimNotificationEmail Function

In `functions/index.js`:

```javascript
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const cors = require("cors")({ origin: true });

admin.initializeApp();

// Configure your email transporter (Gmail example)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.FIREBASE_EMAIL_USER,
    pass: process.env.FIREBASE_EMAIL_PASSWORD, // Use App Password for Gmail
  },
});

exports.sendClaimNotificationEmail = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    try {
      const {
        reportId,
        reporterEmail,
        bicycleLocation,
        blockNumber,
        claimLink,
        bicycleType,
      } = req.body;

      if (!reporterEmail || !reportId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const mailOptions = {
        from: process.env.FIREBASE_EMAIL_USER,
        to: reporterEmail,
        subject: `Your Bicycle Report #${reportId} - Ready for Claim`,
        html: `
          <h2>Your Reported Bicycle Has Been Removed</h2>
          <p>Dear Resident,</p>
          <p>Your bicycle report (ID: ${reportId}) has been identified and removed by Nee Soon Town Council.</p>
          
          <h3>Bicycle Details:</h3>
          <ul>
            <li><strong>Block:</strong> ${blockNumber}</li>
            <li><strong>Location:</strong> ${bicycleLocation}</li>
            <li><strong>Type:</strong> ${bicycleType}</li>
          </ul>

          <p><strong>Next Steps:</strong></p>
          <ol>
            <li>Click the link below to submit an ownership claim</li>
            <li>Provide your name, phone, and proof of ownership</li>
            <li>Visit the Town Council office to collect your bicycle</li>
          </ol>

          <p style="text-align: center; margin: 30px 0;">
            <a href="${claimLink}" style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Claim Your Bicycle
            </a>
          </p>

          <p><strong>Important:</strong> This link will expire in 30 days. Please submit your claim before then.</p>

          <hr>
          <p style="font-size: 12px; color: #666;">
            Questions? Contact us at <a href="mailto:feedback@nstc.org.sg">feedback@nstc.org.sg</a>
          </p>
        `,
      };

      await transporter.sendMail(mailOptions);

      return res.status(200).json({
        success: true,
        message: "Email sent successfully",
      });
    } catch (error) {
      console.error("Error sending email:", error);
      return res.status(500).json({
        error: "Failed to send email",
        details: error.message,
      });
    }
  });
});
```

### Step 4: Set Environment Variables for Cloud Function

In Firebase console or using Firebase CLI:

```bash
firebase functions:config:set email.user="your-email@gmail.com" email.password="your-app-password"
firebase deploy --only functions
```

**For Gmail:**
- Use an App Password (not your regular password)
- Enable 2-Factor Authentication on your Gmail account
- Generate an App Password at https://myaccount.google.com/apppasswords

---

### Step 5: Environment Variable Configuration

Update your `.env` file:

```env
VITE_SEND_CLAIM_EMAIL_FUNCTION=https://region-project.cloudfunctions.net/sendClaimNotificationEmail
```

Get the actual URL from Firebase Console → Functions → sendClaimNotificationEmail

---

## How It Works

### Staff Workflow
1. Staff views a report marked as "Verified" or "Tagged"
2. Staff clicks "Mark Removed" button
3. System automatically sends claim email to resident
4. Email contains direct claim link pre-filled with resident's email

### Resident Workflow
1. Resident receives email: "Your Bicycle Has Been Removed"
2. Clicks "Claim Your Bicycle" button in email
3. Lands on claim page with email pre-verified
4. Fills in name, phone, and proof of ownership
5. Submits claim
6. Status changes to "Pending Owner Claim"
7. Resident visits Town Council office for collection

### Staff Dashboard
New metrics now show:
- **Pending Claims**: Removed bicycles not yet claimed
- **Submitted Claims**: Claims awaiting staff verification

---

## Troubleshooting

### Email Not Sending
1. Check Cloud Function logs: `firebase functions:log`
2. Verify environment variables are set
3. Test email transporter credentials
4. Check recipient email is valid

### Claim Link Not Working
1. Verify `VITE_SEND_CLAIM_EMAIL_FUNCTION` is correct
2. Check Cloud Function is deployed
3. Ensure CORS is enabled in Cloud Function

### Email Timeout
- Increase Cloud Function timeout to 60 seconds in Firebase Console

---

## Alternative: Using SendGrid

If you prefer SendGrid over Gmail:

```bash
npm install @sendgrid/mail
```

Then use in Cloud Function:

```javascript
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: reporterEmail,
  from: "noreply@nstc.org.sg",
  subject: `Your Bicycle Report #${reportId} - Ready for Claim`,
  html: /* email HTML */,
};

await sgMail.send(msg);
```

---

## Testing

Test without Cloud Function:
1. The app works without email (graceful degradation)
2. Console will warn about unconfigured email service
3. Staff can still update statuses
4. Residents can still claim via QR code

Once Cloud Function is deployed, emails automatically start sending.
