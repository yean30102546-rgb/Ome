# CORS & Synchronization Fix Guide

## Problem Analysis

**Issue**: The `readAll` action fails with a CORS error while `insert` works fine.

**Root Cause**: When the GAS backend encounters any error (parsing, sheet access, column mismatches), it was returning responses without proper CORS headers, causing browsers to block the response.

---

## Solution Overview

### Frontend (✅ Already Correct)
Your `api.ts` is already using the correct approach:
- `fetchAllCases()` uses `method: 'POST'` with `headers: { 'Content-Type': 'text/plain;charset=utf-8' }`
- This matches the working `insertCase()` implementation
- No changes needed on the frontend

### Backend (🔧 Needs Improvements)

**Key improvements in the provided `GAS_IMPROVED.gs`:**

#### 1. **Centralized CORS Headers**
```javascript
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "text/plain;charset=utf-8"
};
```
- Single source of truth for all responses
- Ensures consistency across all endpoints

#### 2. **Response Wrapper Function**
```javascript
function createCorsResponse(responseObj) {
  const jsonString = JSON.stringify(responseObj);
  return ContentService.createTextOutput(jsonString)
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders(CORS_HEADERS);
}
```
- **Critical**: Every response (success or error) goes through this function
- Guarantees CORS headers on ALL responses
- Has fallback error handling if JSON serialization fails

#### 3. **Improved doPost with Better Error Handling**
```javascript
function doPost(e) {
  try {
    // Validate postData exists
    if (!e.postData || !e.postData.contents) {
      return createCorsResponse({ success: false, error: 'No data received' });
    }

    // Parse JSON safely
    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return createCorsResponse({ 
        success: false, 
        error: `Invalid JSON: ${parseError.toString()}` 
      });
    }

    // Route to handler
    const action = payload.action;
    let response;

    switch(action) {
      case 'insert':
        response = handleInsert(payload);
        break;
      case 'readAll':
        response = handleReadAll(payload);
        break;
      // ... other cases
    }

    return createCorsResponse(response);

  } catch (error) {
    return createCorsResponse({ 
      success: false, 
      error: `Server error: ${error.toString()}` 
    });
  }
}
```

**Benefits**:
- Catches all parsing errors
- Validates action parameter
- Uses switch instead of if-else for clarity
- ALL error paths return proper CORS headers

#### 4. **Defensive handleReadAll Function** ⭐
The main function that was causing CORS issues:

```javascript
function handleReadAll(payload) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) {
      return { success: false, error: `Sheet "${SHEET_NAME}" not found` };
    }

    const data = sheet.getDataRange().getValues();

    // Return empty array if only header row exists
    if (data.length <= 1) {
      return { 
        success: true, 
        data: [],
        message: 'No data rows found'
      };
    }

    const caseMap = new Map();

    // Process data rows with defensive checks
    for (let i = 1; i < data.length; i++) {
      try {
        const row = data[i];
        
        // ✅ Check row exists and has minimum required columns
        if (!row || row.length < 13) {
          Logger.log(`Skipping row ${i}: insufficient columns`);
          continue;
        }

        // ✅ Safe column access with defaults
        const caseId = row[1] || null;
        if (!caseId) continue; // Skip rows without Case ID

        const item = {
          id: row[0] || `item-${i}`,
          itemNumber: row[4] || '',
          itemName: row[5] || '',
          itemCode: row[6] || '',
          amount: row[7] !== undefined && row[7] !== null ? row[7] : 0,
          reason: row[8] || '',
          responsible: row[9] || '',
          details: row[10] || '',
          status: row[11] || 'Pending',
          imageUrls: imageUrlsString
            ? imageUrlsString.toString().split('|').filter(url => url && url.trim() !== '')
            : []
        };

        // Add or update case
        if (!caseMap.has(caseId)) {
          caseMap.set(caseId, { /* ... */ });
        } else {
          caseMap.get(caseId).items.push(item);
        }

      } catch (rowError) {
        Logger.log(`Error processing row ${i}: ${rowError.toString()}`);
        continue; // ✅ Continue instead of failing entire function
      }
    }

    return { 
      success: true, 
      data: Array.from(caseMap.values()),
      message: `Successfully retrieved ${casesArray.length} cases`
    };

  } catch (error) {
    Logger.log('handleReadAll error: ' + error.toString());
    return { 
      success: false, 
      error: `Read failed: ${error.toString()}` 
    };
  }
}
```

**Key Improvements**:
- ✅ Checks if sheet exists before accessing
- ✅ Validates row structure (minimum 13 columns)
- ✅ Safe column access with null coalescing (`row[7] !== undefined`)
- ✅ Filters out empty/invalid image URLs
- ✅ Individual row error handling (continue instead of throw)
- ✅ Descriptive logging for debugging
- ✅ Always returns valid JSON with CORS headers

#### 5. **Similar Improvements to Other Functions**

All handler functions now include:
- Input validation (check required fields exist)
- Sheet existence checks
- Defensive column access
- Try-catch around individual items
- Proper logging
- Fallback defaults

---

## Implementation Steps

### 1. **Replace GAS Code**
1. Open your Google Apps Script editor
2. Clear the existing code (or create a new version)
3. Copy-paste the entire `GAS_IMPROVED.gs` content

### 2. **Test the doOptions Function**
Before testing readAll, ensure CORS preflight works:
```bash
curl -X OPTIONS https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```
Should return headers with `Access-Control-Allow-Origin: *`

### 3. **Test readAll in Browser**
Open your frontend and navigate to the "Overall" tab. The page should:
- Load cases without CORS errors
- Display all your existing data
- Handle empty sheets gracefully

### 4. **Monitor Logs**
Check Google Apps Script logs for any warnings:
- Insufficient columns
- Missing Case IDs
- Image URL parsing issues

---

## Troubleshooting

### Still Getting CORS Error?
1. **Deployment Issue**: Ensure you deployed as a "New Deployment"
   - Type: Web app
   - Execute as: Your account
   - Who has access: Anyone

2. **URL Issue**: Verify the URL in your frontend matches the deployed URL
   ```typescript
   const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/YOUR_ID/exec';
   ```

3. **Browser Cache**: Clear cache and hard refresh (Ctrl+Shift+R)

### readAll Still Returns Empty?
1. Check Google Sheet has data:
   - Headers in row 1
   - Data starts from row 2
   - Case IDs in column B (index 1)

2. Check sheet name matches: `const SHEET_NAME = 'MainData';`

3. Check column structure (13 columns total):
   - 0: Item ID, 1: Case ID, 2: Date, 3: Source, 4: Item Number
   - 5: Item Name, 6: Item Code, 7: Amount, 8: Reason, 9: Responsible
   - 10: Details, 11: Status, 12: Image URLs

### Images Not Loading?
- Check Drive folder ID: `const folderId = "YOUR_ID";`
- Verify Drive folder sharing settings
- Check image URL columns are separated by `|`

---

## Frontend No Changes Needed ✅

Your `fetchAllCases()` function is already correct:

```typescript
export async function fetchAllCases(): Promise<ApiResponse<ReworkCase[]>> {
  try {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',  // ✅ POST method
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },  // ✅ Correct header
      body: JSON.stringify({ action: 'readAll' }),
    });

    if (!response.ok) throw new Error("Network response was not ok");

    const result = await response.json();
    
    if (result.success === false) {
      console.error("GAS Logic Error:", result.error);
    }

    return {
      success: result.success,
      data: result.data || [],
      error: result.error,
    };
  } catch (error) {
    console.error('Fetch Error:', error);
    return { success: false, data: [], error: 'Failed to fetch' };
  }
}
```

No modifications needed - this is already using the same pattern as the working `insertCase()`.

---

## Summary of Changes

| Aspect | Before | After |
|--------|--------|-------|
| **CORS Headers** | Not consistent | ✅ Centralized constant |
| **Error Responses** | May not have headers | ✅ All have CORS headers |
| **Column Safety** | Direct access | ✅ Defensive with checks |
| **Error Handling** | Fails entire function | ✅ Continues on row errors |
| **Logging** | Minimal | ✅ Detailed logging |
| **Response Format** | Inconsistent | ✅ Always JSON with MESSAGE |
| **Empty Sheet** | Potential crash | ✅ Returns empty array |
| **Image URLs** | May include blanks | ✅ Filtered and validated |

---

## Testing Checklist

- [ ] GAS code deployed successfully
- [ ] doOptions returns CORS headers
- [ ] doPost routes actions correctly
- [ ] readAll returns data without CORS error
- [ ] Empty sheet returns `{ success: true, data: [] }`
- [ ] Insert still works
- [ ] Update still works
- [ ] Dashboard loads statistics
- [ ] Browser DevTools shows "Access-Control-Allow-Origin" header in readAll response
- [ ] Google Apps Script logs show useful debug info
