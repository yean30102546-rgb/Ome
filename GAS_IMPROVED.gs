/**
 * QSMS Rework Management System - Backend (Google Apps Script) - IMPROVED VERSION
 * ระบบจัดการงาน Rework พร้อมรองรับการบันทึกรูปภาพและแก้ปัญหา CORS
 * 
 * KEY IMPROVEMENTS:
 * 1. Centralized CORS headers - always included in all responses
 * 2. createCorsResponse wrapper for consistent error handling
 * 3. More defensive column access with null checks
 * 4. Better error logging and recovery
 * 5. Ensures TEXT/PLAIN MIME type for all responses
 */

// ===== CONFIGURATION =====
const SHEET_ID = '1Zw66PocKhrTHpPj20Tt2DwBep1vHfbrWw9soX0afss0'; 
const SHEET_NAME = 'MainData'; 
const BACKUP_SHEET_NAME = 'Backup';

// ===== CORS HEADERS - CONSTANT =====
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "text/plain;charset=utf-8"
};

/**
 * Helper: Create a safe response with CORS headers
 * Ensures all responses, including errors, have proper headers
 */
function createCorsResponse(responseObj) {
  try {
    const jsonString = JSON.stringify(responseObj);
    return ContentService.createTextOutput(jsonString)
      .setMimeType(ContentService.MimeType.TEXT)
      .setHeaders(CORS_HEADERS);
  } catch (error) {
    // Fallback for stringify errors
    const fallback = { success: false, error: 'Response serialization failed' };
    return ContentService.createTextOutput(JSON.stringify(fallback))
      .setMimeType(ContentService.MimeType.TEXT)
      .setHeaders(CORS_HEADERS);
  }
}

/**
 * 1. Handle OPTIONS request (Preflight for CORS)
 */
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders(CORS_HEADERS);
}

/**
 * 2. Main doPost handler - REFACTORED with better error handling
 */
function doPost(e) {
  try {
    // Validate that we have post data
    if (!e.postData || !e.postData.contents) {
      return createCorsResponse({ 
        success: false, 
        error: 'No data received' 
      });
    }

    // Parse the JSON payload
    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return createCorsResponse({ 
        success: false, 
        error: `Invalid JSON: ${parseError.toString()}` 
      });
    }

    // Validate action
    if (!payload.action) {
      return createCorsResponse({ 
        success: false, 
        error: 'Missing action parameter' 
      });
    }

    const action = payload.action;
    let response;

    // Route to appropriate handler
    switch(action) {
      case 'insert':
        response = handleInsert(payload);
        break;
      case 'readAll':
        response = handleReadAll(payload);
        break;
      case 'update':
        response = handleUpdate(payload);
        break;
      case 'dashboardStats':
        response = handleDashboardStats(payload);
        break;
      default:
        response = { success: false, error: `Unknown action: ${action}` };
    }

    return createCorsResponse(response);

  } catch (error) {
    // Catch-all for unexpected errors
    Logger.log('Unexpected error in doPost: ' + error.toString());
    return createCorsResponse({ 
      success: false, 
      error: `Server error: ${error.toString()}` 
    });
  }
}

/**
 * 3. handleInsert - IMPROVED with better error handling
 */
function handleInsert(payload) {
  try {
    // Validate required fields
    if (!payload.source || !payload.items || !Array.isArray(payload.items)) {
      return { success: false, error: 'Missing required fields: source or items' };
    }

    if (payload.items.length === 0) {
      return { success: false, error: 'Items array cannot be empty' };
    }

    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) {
      return { success: false, error: `Sheet "${SHEET_NAME}" not found` };
    }

    const folderId = "1QVYbfWc_kEBs4jONGpA3l6ai0gzvDQfj";
    let folder;
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (folderError) {
      Logger.log('Drive folder error: ' + folderError.toString());
      return { success: false, error: 'Cannot access Drive folder for images' };
    }

    const caseId = generateCaseId();
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace('T', ' ');

    const rowsToInsert = [];

    payload.items.forEach((item, index) => {
      try {
        const itemId = `${caseId}-${(index + 1).toString().padStart(3, '0')}`;
        let imageUrls = [];

        // Handle images if provided
        if (item.images && Array.isArray(item.images) && item.images.length > 0) {
          item.images.forEach((base64Data, imgIdx) => {
            try {
              // Defensive base64 handling
              if (!base64Data || typeof base64Data !== 'string') {
                Logger.log(`Skipping invalid image at index ${imgIdx}`);
                return;
              }

              const contentType = base64Data.includes(';') 
                ? base64Data.substring(5, base64Data.indexOf(';')) 
                : 'image/jpeg';
              
              const base64String = base64Data.includes(',') 
                ? base64Data.split(',')[1] 
                : base64Data;

              const bytes = Utilities.base64Decode(base64String);
              const blob = Utilities.newBlob(bytes, contentType, `${itemId}-${imgIdx}.jpg`);
              const file = folder.createFile(blob);
              
              // Set sharing for public access
              file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
              imageUrls.push(file.getUrl());
            } catch (imgError) {
              Logger.log(`Error processing image ${imgIdx}: ${imgError.toString()}`);
              // Continue without this image
            }
          });
        }

        // Build row with safe defaults
        rowsToInsert.push([
          itemId,                              // [0] Item ID
          caseId,                              // [1] Case ID
          timestamp,                           // [2] Date
          payload.source || '',                // [3] Source
          item.itemNumber || '',               // [4] Item Number
          item.itemName || '',                 // [5] Item Name
          item.itemCode || '',                 // [6] Item Code
          item.amount || 0,                    // [7] Amount (Box)
          item.reason || '',                   // [8] Reason
          item.responsible || '',              // [9] Responsible
          item.details || '',                  // [10] Details
          'Pending',                           // [11] Status (always start as Pending)
          imageUrls.join('|')                  // [12] Image URLs
        ]);
      } catch (itemError) {
        Logger.log(`Error processing item ${index}: ${itemError.toString()}`);
        // Continue processing other items
      }
    });

    // Insert rows if any were prepared
    if (rowsToInsert.length > 0) {
      try {
        sheet.getRange(
          sheet.getLastRow() + 1,
          1,
          rowsToInsert.length,
          rowsToInsert[0].length
        ).setValues(rowsToInsert);
      } catch (insertError) {
        Logger.log('Error inserting rows: ' + insertError.toString());
        return { success: false, error: `Failed to insert rows: ${insertError.toString()}` };
      }
    }

    // Create backup
    try {
      createBackup(sheet);
    } catch (backupError) {
      Logger.log('Backup failed (non-critical): ' + backupError.toString());
      // Don't fail the insert if backup fails
    }

    return { 
      success: true, 
      data: { 
        caseId: caseId,
        itemIds: rowsToInsert.map((_, i) => `${caseId}-${(i + 1).toString().padStart(3, '0')}`)
      },
      message: `Successfully inserted ${rowsToInsert.length} items`
    };

  } catch (error) {
    Logger.log('handleInsert error: ' + error.toString());
    return { 
      success: false, 
      error: `Insert failed: ${error.toString()}` 
    };
  }
}

/**
 * 4. handleReadAll - IMPROVED with defensive column access
 * This is the key function that was causing CORS issues
 */
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

    // Process data rows (skip header at index 0)
    for (let i = 1; i < data.length; i++) {
      try {
        const row = data[i];
        
        // Defensive: check if row exists and has minimum required columns
        if (!row || row.length < 13) {
          Logger.log(`Skipping row ${i}: insufficient columns (found ${row ? row.length : 0})`);
          continue;
        }

        // Safe column access with defaults
        const caseId = row[1] || null;
        
        // Skip if no Case ID
        if (!caseId) {
          Logger.log(`Skipping row ${i}: no Case ID`);
          continue;
        }

        const itemId = row[0] || `item-${i}`;
        const itemNumber = row[4] || '';
        const itemName = row[5] || '';
        const itemCode = row[6] || '';
        const amount = row[7] !== undefined && row[7] !== null ? row[7] : 0;
        const reason = row[8] || '';
        const responsible = row[9] || '';
        const details = row[10] || '';
        const status = row[11] || 'Pending';
        const imageUrlsString = row[12] || '';

        // Parse image URLs safely
        const imageUrls = imageUrlsString
          ? imageUrlsString.toString().split('|').filter(url => url && url.trim() !== '')
          : [];

        const item = {
          id: itemId,
          itemNumber: itemNumber,
          itemName: itemName,
          itemCode: itemCode,
          amount: amount,
          reason: reason,
          responsible: responsible,
          details: details,
          status: status,
          imageUrls: imageUrls
        };

        // Add or update case in map
        if (!caseMap.has(caseId)) {
          caseMap.set(caseId, {
            id: caseId,
            date: row[2] || new Date().toISOString(),
            source: row[3] || 'Unknown',
            status: status,
            items: [item]
          });
        } else {
          const existingCase = caseMap.get(caseId);
          existingCase.items.push(item);
          // Update case status to most recent item's status if not already completed
          if (existingCase.status !== 'Completed' && status === 'Completed') {
            existingCase.status = 'Completed';
          }
        }
      } catch (rowError) {
        Logger.log(`Error processing row ${i}: ${rowError.toString()}`);
        // Continue to next row instead of failing entire readAll
        continue;
      }
    }

    const casesArray = Array.from(caseMap.values());

    return { 
      success: true, 
      data: casesArray,
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

/**
 * 5. handleUpdate - IMPROVED with better validation
 */
function handleUpdate(payload) {
  try {
    if (!payload.caseId || !payload.updates) {
      return { success: false, error: 'Missing caseId or updates' };
    }

    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) {
      return { success: false, error: `Sheet "${SHEET_NAME}" not found` };
    }

    const data = sheet.getDataRange().getValues();
    const caseId = payload.caseId;
    let updatedCount = 0;

    for (let i = 1; i < data.length; i++) {
      try {
        const row = data[i];
        
        // Defensive: check if row has minimum required columns
        if (!row || row.length < 13) continue;

        if (row[1] === caseId) {
          // Update status if provided
          if (payload.updates.status) {
            try {
              sheet.getRange(i + 1, 12).setValue(payload.updates.status);
              updatedCount++;
            } catch (updateError) {
              Logger.log(`Error updating status at row ${i}: ${updateError.toString()}`);
            }
          }

          // Update details if provided
          if (payload.updates.items && 
              Array.isArray(payload.updates.items) && 
              payload.updates.items[0] && 
              payload.updates.items[0].details) {
            try {
              sheet.getRange(i + 1, 11).setValue(payload.updates.items[0].details);
            } catch (detailError) {
              Logger.log(`Error updating details at row ${i}: ${detailError.toString()}`);
            }
          }
        }
      } catch (rowError) {
        Logger.log(`Error processing row ${i} for update: ${rowError.toString()}`);
        continue;
      }
    }

    // Create backup
    try {
      createBackup(sheet);
    } catch (backupError) {
      Logger.log('Backup failed (non-critical): ' + backupError.toString());
    }

    return { 
      success: true, 
      message: `Updated ${updatedCount} items`,
      data: { updatedCount: updatedCount }
    };

  } catch (error) {
    Logger.log('handleUpdate error: ' + error.toString());
    return { 
      success: false, 
      error: `Update failed: ${error.toString()}` 
    };
  }
}

/**
 * 6. handleDashboardStats - IMPROVED with safer aggregation
 */
function handleDashboardStats(payload) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) {
      return { success: false, error: `Sheet "${SHEET_NAME}" not found` };
    }

    const data = sheet.getDataRange().getValues();
    const stats = {
      totalCases: 0,
      pendingCases: 0,
      inProgressCases: 0,
      completedCases: 0,
      completionRate: 0,
      defectReasons: {},
      sourceWorkload: {}
    };

    const caseIds = new Set();

    for (let i = 1; i < data.length; i++) {
      try {
        const row = data[i];
        
        // Defensive: check minimum columns
        if (!row || row.length < 12) continue;

        const caseId = row[1];
        const status = row[11] || 'Pending';
        const reason = row[8];
        const source = row[3];

        if (caseId) {
          caseIds.add(caseId);

          // Count by status
          if (status === 'Pending') stats.pendingCases++;
          else if (status === 'In-Progress') stats.inProgressCases++;
          else if (status === 'Completed') stats.completedCases++;

          // Track defect reasons
          if (reason && reason.trim()) {
            const reasonKey = reason.toString().trim();
            stats.defectReasons[reasonKey] = (stats.defectReasons[reasonKey] || 0) + 1;
          }

          // Track source workload
          if (source && source.trim()) {
            const sourceKey = source.toString().trim();
            stats.sourceWorkload[sourceKey] = (stats.sourceWorkload[sourceKey] || 0) + 1;
          }
        }
      } catch (rowError) {
        Logger.log(`Error processing row ${i} for stats: ${rowError.toString()}`);
        continue;
      }
    }

    stats.totalCases = caseIds.size;
    stats.completionRate = stats.totalCases > 0 
      ? Math.round((stats.completedCases / stats.totalCases) * 100) 
      : 0;

    return { 
      success: true, 
      data: stats,
      message: `Dashboard stats calculated successfully`
    };

  } catch (error) {
    Logger.log('handleDashboardStats error: ' + error.toString());
    return { 
      success: false, 
      error: `Stats calculation failed: ${error.toString()}` 
    };
  }
}

// ===== UTILITY FUNCTIONS =====

/**
 * Generate a unique Case ID with timestamp
 */
function generateCaseId() {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `RW${yy}${mm}${dd}${hh}${min}${ss}`;
}

/**
 * Create a backup of the current sheet
 */
function createBackup(sourceSheet) {
  try {
    const spreadsheet = sourceSheet.getParent();
    const backupDate = new Date().toISOString().slice(0, 10);
    const backupSheetName = `${BACKUP_SHEET_NAME} - ${backupDate}`;

    let backupSheet = spreadsheet.getSheetByName(backupSheetName);
    if (!backupSheet) {
      backupSheet = spreadsheet.insertSheet(backupSheetName);
    }

    const data = sourceSheet.getDataRange();
    backupSheet.getRange(1, 1, data.getNumRows(), data.getNumColumns()).setValues(data.getValues());

    Logger.log(`Backup created: ${backupSheetName}`);
  } catch (error) {
    Logger.log('Backup failed: ' + error.toString());
    throw error;
  }
}

/**
 * Initialize sheet with headers (run once)
 */
function initializeSheet() {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const headers = [
      'Item ID',           // 0
      'Case ID',           // 1
      'Date',              // 2
      'Source',            // 3
      'Item Number',       // 4
      'Item Name',         // 5
      'Item Code',         // 6
      'Amount (Box)',      // 7
      'Reason',            // 8
      'Responsible',       // 9
      'Details',           // 10
      'Status',            // 11
      'Image URLs'         // 12
    ];

    sheet.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight('bold')
      .setBackground('#000000')
      .setFontColor('#FFFFFF');

    Logger.log('Sheet initialized with headers');
  } catch (error) {
    Logger.log('Init error: ' + error.toString());
    throw error;
  }
}
