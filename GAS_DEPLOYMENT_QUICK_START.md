# Quick Start: GAS Deployment & Testing

## ✅ Frontend Status: NO CHANGES NEEDED

Your `api.ts` is already correct. The `fetchAllCases()` function uses the proper `POST` method with `text/plain` headers.

---

## 🔧 Backend: Deploy the Improved GAS Code

### Step 1: Access Google Apps Script
1. Open your Google Sheet
2. Click **Tools** → **Script Editor**
3. This opens Google Apps Script (GAS)

### Step 2: Replace the Code
1. Select all existing code (Ctrl+A)
2. Delete it
3. Copy the entire content from `GAS_IMPROVED.gs`
4. Paste it into the GAS editor

### Step 3: Update Configuration (if needed)
Check these constants match your setup:

```javascript
const SHEET_ID = '1Zw66PocKhrTHpPj20Tt2DwBep1vHfbrWw9soX0afss0';  // Your Google Sheet ID
const SHEET_NAME = 'MainData';                                   // Your sheet name
const folderId = "1QVYbfWc_kEBs4jONGpA3l6ai0gzvDQfj";            // Your Drive folder for images
```

**How to find Sheet ID**: Open your Google Sheet, the ID is in the URL:
```
https://docs.google.com/spreadsheets/d/[SHEET_ID_HERE]/edit
```

**How to find Folder ID**: Open your Google Drive folder, the ID is in the URL:
```
https://drive.google.com/drive/folders/[FOLDER_ID_HERE]
```

### Step 4: Deploy as Web App

**Important**: Create a NEW deployment after updating code.

1. Click **Deploy** (top right) → **New Deployment**
2. Select gear icon → choose **Web app**
3. Set:
   - **Execute as**: Your email
   - **Who has access**: Anyone
4. Click **Deploy**
5. Copy the new deployment URL

### Step 5: Update Frontend URL (if changed)

If the deployment URL changed, update [api.ts](src/services/api.ts):

```typescript
let GAS_WEB_APP_URL = 'https://script.google.com/macros/s/YOUR_NEW_URL/exec';
```

### Step 6: Test

1. Start your React frontend
2. Navigate to **Overall** tab
3. Should see cases load without CORS errors ✅

---

## 🐛 If Still Getting CORS Error

### Check 1: Browser Console (F12)
Look for "Access to fetch" or "No 'Access-Control-Allow-Origin'" header messages

### Check 2: Network Tab
- Check the readAll request
- **Response Headers** should contain: `access-control-allow-origin: *`

### Check 3: GAS Logs
In Google Apps Script: **View** → **Logs**
- Check for errors during readAll
- Look for "Skipping row" messages
- Check if sheet is being found

### Check 4: Verify Deployment Settings
- Deployed as **Web app** (not API)
- **Execute as**: Your email
- **Who has access**: Anyone
- If still failing: create a completely NEW deployment

---

## 📋 What Was Fixed

| Issue | Fix |
|-------|-----|
| CORS error on readAll | ✅ All responses include CORS headers |
| Inconsistent error responses | ✅ Centralized `createCorsResponse()` wrapper |
| Crashes on missing columns | ✅ Defensive column checks with defaults |
| Single row error breaks entire operation | ✅ Individual row try-catch blocks |
| Hard to debug | ✅ Detailed logging in Google Apps Script |
| Strict preflight checks | ✅ Text/Plain MIME type (simpler CORS) |

---

## 📊 Expected Google Sheet Structure

13 columns required (indices 0-12):

```
Col:  A        B        C     D       E            F           G          H       I      J            K        L        M
      Item ID  Case ID  Date  Source  Item Number  Item Name  Item Code  Amount  Reason Responsible Details   Status   Image URLs
```

**Requirements**:
- Headers in row 1
- Data starts from row 2
- Case ID in column B (must not be empty for rows to be processed)
- Status in column L
- Image URLs separated by `|` in column M

---

## ✨ Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Sheet MainData not found" | Verify SHEET_NAME constant matches your sheet name exactly |
| readAll returns empty array | Check Case IDs in column B, verify data starts at row 2 |
| Images not in image URLs | Verify Drive folder ID is correct and shared with you |
| Update action doesn't work | Verify status is column L (index 11) and Case ID is column B (index 1) |
| Still getting CORS error | Create a completely new deployment, don't just save |
| readAll is slow | Normal if your sheet has lots of data - consider adding filters |

---

## 🎯 Testing Checklist

- [ ] Copied `GAS_IMPROVED.gs` into Google Apps Script
- [ ] Updated SHEET_ID (if using different sheet)
- [ ] Updated SHEET_NAME (if using different sheet)
- [ ] Updated folderId (if using different folder)
- [ ] Created NEW deployment as Web app
- [ ] Updated frontend GAS_WEB_APP_URL (if URL changed)
- [ ] Tested Overall tab - cases load without CORS error
- [ ] Tested Add Case - insert still works
- [ ] Tested Update Modal - updates still work
- [ ] Checked Google Apps Script logs for errors

---

## 📈 Performance Tips

- If your sheet has **1000+ rows**, consider archiving old data
- Use the Backup sheet feature regularly
- Monitor Google Drive folder size for images
- Check Google Apps Script quotas (Apps Script → Quotas)

---

## 🔐 Security Notes

- CORS headers allow `*` origin - fine for internal tools
- If deploying to production, restrict to specific domains
- Drive sharing is set to "Anyone with link" - ensure images are not sensitive
- Consider using additional authentication if needed

---

## 💡 Next Steps

After fixing CORS and readAll:

1. **Monitor Performance**: Check Google Apps Script logs regularly
2. **Test All Features**: Verify insert, update, dashboard all work
3. **Backup Data**: Set up regular backups using the createBackup function
4. **User Training**: Show team how to use the system
5. **Future Improvements**: Add filters, export to Excel, advanced reporting
