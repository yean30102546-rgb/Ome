# QSMS Rework Management System - Deployment Guide

Complete step-by-step instructions to deploy the Rework Management System as a fully functional web application.

---

## 📋 Table of Contents
1. [Backend Setup (Google Apps Script)](#backend-setup)
2. [Frontend Configuration](#frontend-configuration)
3. [Google Sheets Setup](#google-sheets-setup)
4. [Deployment Steps](#deployment-steps)
5. [Testing & Troubleshooting](#testing--troubleshooting)
6. [Production Checklist](#production-checklist)

---

## Backend Setup (Google Apps Script)

### Step 1: Create a New Google Apps Script Project

1. Go to [Google Apps Script](https://script.google.com)
2. Click **"+ New Project"**
3. Rename the project to `QSMS Rework Management Backend`
4. Delete the default `myFunction` code

### Step 2: Copy the Backend Code

1. Copy the entire contents of `gas/Code.gs` from your project
2. Paste it into the Google Apps Script editor
3. **Important**: Replace `'YOUR_GOOGLE_SHEET_ID_HERE'` with your actual Google Sheet ID
   - To find your Sheet ID: Open your Google Sheet > Copy the ID from the URL
   - Example URL: `https://docs.google.com/spreadsheets/d/1abc2def3ghi4jkl5mno6pqr/edit`
   - The ID is: `1abc2def3ghi4jkl5mno6pqr`

### Step 3: Initialize the Sheet Structure

1. In the Google Apps Script editor, look for the function `initializeSheet()`
2. Click on it and press **Ctrl+Enter** to run it
3. This will create the necessary column headers in your Google Sheet:
   - Item ID
   - Case ID
   - Date
   - Source
   - Item Number
   - Item Name
   - Item Code
   - Amount (Box)
   - Reason
   - Responsible
   - Details
   - Status
   - Image URLs

---

## Google Sheets Setup

### Step 1: Create a New Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Click **"+ Blank"** to create a new sheet
3. Rename it to `QSMS Rework Management`
4. **Keep this sheet open** - you'll need to copy the ID

### Step 2: Run Sheet Initialization

1. Go back to your Google Apps Script project
2. Run the `initializeSheet()` function to add headers automatically

### Step 3: Set Up Additional Sheets (Optional)

Create these sheets for better organization:
- **Rework Cases** - Main data sheet (auto-created with headers)
- **Backup** - Automatic backup location
- **Defect Codes** - Lookup table for defect reasons:
  ```
  Code | Description
  เล็ด | รั่ว/ซึม
  ซีล | ซีลฟอยล์ไม่ติด
  คราบ | เปื้อน/คราบ
  อื่นๆ | อื่นๆ
  ```

---

## Frontend Configuration

### Step 1: Update API URL

1. Open `src/services/api.ts` in your React project
2. Find the line: `const GAS_WEB_APP_URL = 'https://script.google.com/macros/d/{DEPLOYMENT_ID}/usercallback';`
3. Replace `{DEPLOYMENT_ID}` with your actual deployment ID (see Deployment Steps below)

### Step 2: Install Dependencies

```bash
npm install
# or
yarn install
```

Ensure these packages are installed:
- `react` - ^18.0.0
- `lucide-react` - Latest
- `motion` (Framer Motion) - Latest
- `tailwindcss` - Latest

### Step 3: Verify Environment

```bash
npm run dev
# or
yarn dev
```

Test that the app runs locally on `http://localhost:5173` (or your configured port)

---

## Deployment Steps

### Step 1: Deploy Google Apps Script as Web App

1. In Google Apps Script editor, click **"Deploy"** (⬆️ icon)
2. Click **"+ New Deployment"**
3. Select **Type**: `Web app`
4. Configure deployment settings:
   - **Execute as**: Your Google Account (account that owns the Sheet)
   - **Who has access**: "Anyone" (to allow the frontend to access it)
5. Click **"Deploy"**
6. You'll see a dialog with your **Deployment ID**
   - Copy this ID carefully
   - **Example**: `AKfycbwXr_abc123def456ghi789jklmnop`
7. You'll also see the **Web App URL**:
   - **Example**: `https://script.google.com/macros/d/AKfycbwXr_abc123def456ghi789jklmnop/usercallback`
8. **Copy this entire URL** - you'll need it for the frontend

### Step 2: Update Frontend with Web App URL

1. Open `src/services/api.ts`
2. Find: `const GAS_WEB_APP_URL = '...'`
3. Replace the URL with your actual GAS Web App URL from Step 1.8
4. Save the file

### Step 3: Build Frontend for Production

```bash
npm run build
# or
yarn build
```

This creates an optimized `dist/` folder with your frontend

### Step 4: Deploy Frontend

Choose one of these options:

#### Option A: Vercel (Recommended for React apps)
```bash
npm install -g vercel
vercel
# Follow the prompts to connect your GitHub repo and deploy
```

#### Option B: Netlify
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

#### Option C: GitHub Pages
1. Update `vite.config.js`:
   ```javascript
   export default {
     base: '/rework-management/', // Change to your repo name
     // ... rest of config
   }
   ```
2. Build: `npm run build`
3. Push to GitHub and enable GitHub Pages in settings

#### Option D: Manual Hosting (Any server)
1. Upload the `dist/` folder to your web server
2. Ensure your server serves `index.html` for all routes (SPA requirement)
3. Update `.env` or config files with the GAS Web App URL

### Step 5: Test Deployment

1. Open your deployed frontend URL in a browser
2. Try these actions:
   - ✅ View the "Overall" tab
   - ✅ Click "Add Case" and fill in a test form
   - ✅ Click "Save" and verify data appears in your Google Sheet
   - ✅ Click on a case row to open the Update Modal
   - ✅ View the Dashboard tab

---

## Testing & Troubleshooting

### Test the Backend API Directly

You can test the GAS API before integrating with the frontend:

1. Open **Google Apps Script editor** → **Run** → **testDoPost()**
2. Check **Logs** (View → Logs) for response
3. Verify data in your Google Sheet

### Common Issues & Solutions

#### Issue: "CORS Error" or "Failed to fetch"
**Solution:**
- Ensure GAS is deployed as Web App with "Anyone" access
- Double-check the GAS URL in `api.ts` is correct
- Check browser console for exact error message

#### Issue: "Google Sheet not found"
**Solution:**
- Verify `SHEET_ID` in `gas/Code.gs` matches your Sheet ID
- Verify sheet name matches: `const SHEET_NAME = 'Rework Cases'`
- Ensure GAS account has permission to access the Sheet

#### Issue: "Data not saving"
**Solution:**
- Check that GAS deployed as Web App (not function/library)
- Verify Sheet headers are properly initialized
- Check GAS execution logs for errors

#### Issue: "Modal doesn't open"
**Solution:**
- Ensure UpdateModal component is imported in App.tsx
- Check browser console for component errors
- Verify z-index values in CSS don't conflict

### Manual Testing Checklist

- [ ] Create a new case with 1 item
- [ ] Create a new case with 3 items
- [ ] Upload images (up to 5)
- [ ] Search for cases
- [ ] Click case row to update status
- [ ] Verify data persists after refresh
- [ ] Check dashboard statistics update
- [ ] Test on mobile device

---

## Production Checklist

Before going live to production users:

### Security
- [ ] Set `execute as` to a service account (not personal account)
- [ ] Review data in Google Sheet is what you expect
- [ ] Set up Google Sheet permissions properly
- [ ] Consider adding authentication layer (if needed)
- [ ] Use HTTPS for deployed frontend (automatically with Vercel/Netlify)

### Performance
- [ ] Test with 100+ records in Google Sheet
- [ ] Verify load times are acceptable
- [ ] Implement pagination if data grows too large
- [ ] Test image uploads and file sizes

### Data Integrity
- [ ] Set up backup sheets (already handled in Code.gs)
- [ ] Regularly backup your Google Sheet
- [ ] Document the data schema

### User Preparation
- [ ] Create user documentation
- [ ] Train team on:
  - Adding new cases
  - Updating case status
  - Viewing dashboard
  - Troubleshooting common issues
- [ ] Create admin guide for:
  - Accessing Google Sheet
  - Running reports
  - Managing data

### Monitoring
- [ ] Set up error logging
- [ ] Monitor GAS quota usage
- [ ] Create feedback channel for user issues
- [ ] Plan for regular maintenance

---

## Environment Variables (Optional)

If deploying to cloud platforms, you may want to use environment variables:

Create a `.env` file:
```
VITE_GAS_URL=https://script.google.com/macros/d/YOUR_DEPLOYMENT_ID/usercallback
VITE_APP_NAME=QSMS Rework Management
VITE_API_TIMEOUT=30000
```

Update `src/services/api.ts`:
```typescript
const GAS_WEB_APP_URL = import.meta.env.VITE_GAS_URL || 'https://...';
```

---

## Support & Maintenance

### Regular Maintenance Tasks
1. **Weekly**: Review new cases and dashboard
2. **Monthly**: Verify data integrity in Google Sheet
3. **Quarterly**: Review and optimize performance
4. **Annually**: Update dependencies and review security

### Getting Help
- Check browser console for errors: `F12` → Console tab
- Check GAS logs: Google Apps Script → View → Logs
- Review `git log` for recent changes if deploying from Git

### Scaling Considerations

If your system grows:
- Google Sheets has a ~10M cells limit
- GAS has quotas per account
- Consider moving to Google Firestore or BigQuery for larger systems
- Implement data archival strategy

---

## Quick Reference URLs

Save these for future reference:

```
Google Sheet ID: [Your ID]
GAS Deployment ID: [Your Deployment ID]
GAS Web App URL: https://script.google.com/macros/d/[ID]/usercallback
Frontend URL: [Your deployed URL]
GitHub Repo: [Your repo URL]
```

---

**Setup Complete! 🎉**

Your QSMS Rework Management System is now live and ready to use.

For questions or issues, refer to the Troubleshooting section or contact your development team.
