/**
 * QSMS Rework Management System - Google Apps Script Backend
 * Deployed as a Web App
 * 
 * Setup Instructions:
 * 1. Create a new Google Apps Script project
 * 2. Copy this code into the script editor
 * 3. Create triggers and deploy as Web App
 * 4. Set execute as the Google Account that owns the spreadsheet
 * 5. Allow anyone to access
 * 6. Copy the deployment URL and use it in the frontend API service
 */

// ===== CONFIGURATION =====
// Replace with your actual Google Sheet ID
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE';
const SHEET_NAME = 'Rework Cases';
const ITEM_MASTER_SHEET_NAME = 'ItemMaster';
const BACKUP_SHEET_NAME = 'Backup';
const DRIVE_FOLDER_ID = '1QVYbfWc_kEBs4jONGpA3l6ai0gzvDQfj'; // Google Drive folder for images

function createResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doOptions(e) {
  return createResponse({ success: true, message: 'OPTIONS request accepted' });
}

function doGet(e) {
  return createResponse({ success: true, message: 'GET endpoint active. Use POST for action calls.' });
}

// ===== GLOBAL FUNCTIONS =====

/**
 * Main doPost handler for all form submissions
 */
function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      return createResponse({ success: false, error: 'No data received' });
    }

    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    let response;
    switch (action) {
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
      case 'getItemMaster':
        response = getItemMaster();
        break;
      default:
        response = { success: false, error: 'Unknown action' };
    }

    return createResponse(response);
  } catch (error) {
    return createResponse({
      success: false,
      error: error.toString()
    });
  }
}

/**
 * ===== ACTION HANDLERS =====
 */

/**
 * Handle INSERT action - Create a new rework case
 */
function handleInsert(payload) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    
    // Generate unique case ID: RWYYMMDDHHmm
    const caseId = generateCaseId();
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace('T', ' ');

    // Prepare rows for insertion
    const rowsToInsert = [];
    const itemIds = [];

    payload.items.forEach((item, index) => {
      const itemId = `${caseId}-${(index + 1).toString().padStart(3, '0')}`;
      itemIds.push(itemId);

      // Upload images to Google Drive if provided
      let imageUrls = [];
      if (item.images && Array.isArray(item.images)) {
        imageUrls = item.images.map(base64Data => uploadImageToDrive(base64Data, itemId, caseId)).filter(url => url !== '');
      }

      rowsToInsert.push([
        itemId,
        caseId,
        timestamp,
        payload.source,
        item.itemNumber || '',
        item.itemName || '',
        item.itemCode || '',
        item.amount || 0,
        item.reason || '',
        item.reasonSubtype || '', // Reason subtype (e.g., "รั่วซึม")
        item.responsible || '',
        item.responsibleSubtype || '', // Responsible subtype (e.g., "PDF")
        item.details || '',
        'Pending', // Initial status
        imageUrls.join('|'), // Image URLs separated by |
      ]);
    });

    // Append rows to sheet
    if (rowsToInsert.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rowsToInsert.length, rowsToInsert[0].length)
        .setValues(rowsToInsert);
    }

    // Create backup
    createBackup(sheet);

    return {
      success: true,
      message: `Case ${caseId} inserted successfully with ${payload.items.length} items`,
      data: {
        caseId: caseId,
        itemIds: itemIds,
        timestamp: timestamp
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Insert failed: ${error.toString()}`
    };
  }
}

/**
 * Handle READ ALL action - Fetch all cases from Google Sheets
 */
function handleReadAll(payload) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();

    if (!data || data.length <= 1) {
      return {
        success: true,
        message: 'No data rows found',
        data: []
      };
    }

    // Skip header row and convert to objects
    const caseMap = new Map(); // Group items by case ID

    // Assuming columns: Item ID | Case ID | Date | Source | ItemNumber | ItemName | ItemCode | Amount | Reason | Reason Subtype | Responsible | Responsible Subtype | Details | Status | Images
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const caseId = row[1];
      const itemId = row[0];

      const item = {
        id: itemId,
        itemNumber: row[4] || '',
        itemName: row[5] || '',
        itemCode: row[6] || '',
        amount: row[7] || 0,
        reason: row[8] || '',
        reasonSubtype: row[9] || '',
        responsible: row[10] || '',
        responsibleSubtype: row[11] || '',
        details: row[12] || '',
        status: row[13] || 'Pending',
        imageUrls: (row[14] || '').split('|').filter(url => url.trim() !== ''),
      };

      if (!caseMap.has(caseId)) {
        caseMap.set(caseId, {
          id: caseId,
          date: row[2] || '',
          source: row[3] || '',
          status: row[11] || 'Pending',
          items: [item]
        });
      } else {
        caseMap.get(caseId).items.push(item);
      }
    }

    // Convert map to array
    const casesArray = Array.from(caseMap.values());

    return {
      success: true,
      message: `Retrieved ${casesArray.length} cases`,
      data: casesArray
    };
  } catch (error) {
    return {
      success: false,
      error: `Read failed: ${error.toString()}`,
      data: []
    };
  }
}

/**
 * Handle UPDATE action - Update case status or details
 */
function handleUpdate(payload) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const caseId = payload.caseId;

    let updatedCount = 0;

    // Find and update all rows with matching case ID
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === caseId) { // Column B is Case ID
        // Update status if provided
        if (payload.updates.status) {
          sheet.getRange(i + 1, 14).setValue(payload.updates.status); // Column N is Status (0-indexed: 13)
          updatedCount++;
        }

        // Update details if provided
        if (payload.updates.items && payload.updates.items[0]) {
          const detailsIndex = 13; // Column M is Details (0-indexed: 12)
          sheet.getRange(i + 1, detailsIndex).setValue(payload.updates.items[0].details || '');
        }
      }
    }

    // Create backup
    createBackup(sheet);

    return {
      success: true,
      message: `Updated ${updatedCount} items for case ${caseId}`,
      data: { updatedCount: updatedCount }
    };
  } catch (error) {
    return {
      success: false,
      error: `Update failed: ${error.toString()}`
    };
  }
}

/**
 * Handle DASHBOARD STATS action - Get aggregated statistics
 */
function handleDashboardStats(payload) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
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
      const caseId = data[i][1];
      const status = data[i][13]; // Status column (0-indexed: 13)
      const reason = data[i][8]; // Reason column
      const source = data[i][3]; // Source column

      // Count unique cases for total
      caseIds.add(caseId);

      // Count by status
      switch (status) {
        case 'Pending':
          stats.pendingCases++;
          break;
        case 'In-Progress':
          stats.inProgressCases++;
          break;
        case 'Completed':
          stats.completedCases++;
          break;
      }

      // Count defect reasons
      if (reason) {
        stats.defectReasons[reason] = (stats.defectReasons[reason] || 0) + 1;
      }

      // Count source workload
      if (source) {
        stats.sourceWorkload[source] = (stats.sourceWorkload[source] || 0) + 1;
      }
    }

    stats.totalCases = caseIds.size;
    stats.completionRate = stats.totalCases > 0 
      ? Math.round((stats.completedCases / stats.totalCases) * 100)
      : 0;

    return {
      success: true,
      message: 'Dashboard stats retrieved',
      data: stats
    };
  } catch (error) {
    return {
      success: false,
      error: `Dashboard stats failed: ${error.toString()}`
    };
  }
}

/**
 * ===== UTILITY FUNCTIONS =====
 */

/**
 * Generate a unique case ID
 * Format: RWYYMMDDHHmm
 */
function generateCaseId() {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  
  return `RW${yy}${mm}${dd}${hh}${min}`;
}

/**
 * Create a backup of the current sheet data
 */
function createBackup(sourceSheet) {
  try {
    const spreadsheet = sourceSheet.getParent();
    const backupSheetName = BACKUP_SHEET_NAME + ' - ' + new Date().toISOString().slice(0, 10);
    
    // Check if backup sheet exists for today, if not create one
    let backupSheet = spreadsheet.getSheetByName(backupSheetName);
    
    if (!backupSheet) {
      backupSheet = spreadsheet.insertSheet(backupSheetName);
    }
    
    // Copy data
    const data = sourceSheet.getDataRange();
    backupSheet.getRange(1, 1, data.getNumRows(), data.getNumColumns())
      .setValues(data.getValues());
      
  } catch (error) {
    // Silently fail backup if there's an issue
    Logger.log('Backup creation failed: ' + error);
  }
}

/**
 * Initialize sheet headers if they don't exist
 * Run this once to set up your sheet
 */
function initializeSheet() {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const firstRow = sheet.getRange(1, 1, 1, 15).getValues()[0];
    
    // Check if headers exist
    if (!firstRow[0] || firstRow[0] === '') {
      const headers = [
        'Item ID',
        'Case ID',
        'Date',
        'Source',
        'Item Number',
        'Item Name',
        'Item Code',
        'Amount (Box)',
        'Reason',
        'Reason Subtype',
        'Responsible',
        'Responsible Subtype',
        'Details',
        'Status',
        'Image URLs'
      ];
      
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // Format header row
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#000000');
      headerRange.setFontColor('#FFFFFF');
      
      Logger.log('Sheet initialized successfully');
    }
  } catch (error) {
    Logger.log('Initialization error: ' + error);
  }
}

/**
 * Test the doPost function
 * Run this to test your API
 */
function testDoPost() {
  const testPayload = {
    action: 'insert',
    source: 'SFC',
    items: [
      {
        itemNumber: 'TEST-001',
        itemName: 'Test Product',
        itemCode: 'TP-01',
        amount: 10,
        reason: 'รั่ว',
        reasonSubtype: 'รั่วซึม',
        responsible: 'SFC',
        responsibleSubtype: 'PDF',
        details: 'Test details'
      }
    ]
  };

  const mockEvent = {
    postData: {
      contents: JSON.stringify(testPayload)
    }
  };

  const result = doPost(mockEvent);
  Logger.log(result.getContent());
}

/**
 * ===== MASTER DATA FUNCTIONS =====
 */

/**
 * Fetch Item Master Data from ItemMaster sheet
 * Returns array of {itemNumber, itemName} objects
 */
function getItemMaster() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(ITEM_MASTER_SHEET_NAME);
    
    if (!sheet) {
      return {
        success: false,
        error: `Sheet "${ITEM_MASTER_SHEET_NAME}" not found`,
        data: []
      };
    }

    const data = sheet.getDataRange().getValues();
    const itemMaster = [];

    // Skip header row (row 0)
    for (let i = 1; i < data.length; i++) {
      const itemNumber = String(data[i][0] || '').trim();
      const itemName = String(data[i][1] || '').trim();
      
      if (itemNumber && itemName) {
        itemMaster.push({
          itemNumber,
          itemName
        });
      }
    }

    return {
      success: true,
      data: itemMaster,
      message: `Retrieved ${itemMaster.length} items from master data`
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to fetch item master: ${error.toString()}`,
      data: []
    };
  }
}

/**
 * Create or get a case folder in Google Drive
 * @param {string} caseId - Case ID for folder naming
 * @returns {string} - Folder ID
 */
function getOrCreateCaseFolder(caseId) {
  try {
    const parentFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const caseFolderName = `Case_${caseId}`;
    
    // Search for existing folder
    const folders = parentFolder.getFoldersByName(caseFolderName);
    
    if (folders.hasNext()) {
      return folders.next().getId();
    }
    
    // Create new folder if not exists
    const newFolder = parentFolder.createFolder(caseFolderName);
    return newFolder.getId();
  } catch (error) {
    Logger.log('Folder creation error: ' + error);
    return DRIVE_FOLDER_ID; // Fallback to parent folder
  }
}

/**
 * Upload image to Google Drive and return file URL
 * Creates a case-specific folder and uploads image there
 * @param {string} base64Data - Base64 encoded image
 * @param {string} itemId - Item ID for naming
 * @param {string} caseId - Case ID for folder organization
 * @returns {string} - File URL
 */
function uploadImageToDrive(base64Data, itemId, caseId) {
  try {
    // Decode base64
    const data = Utilities.newBlob(Utilities.base64Decode(base64Data.split(',')[1]), 'image/jpeg');
    
    // Get or create case folder
    const caseFolderId = getOrCreateCaseFolder(caseId);
    const folder = DriveApp.getFolderById(caseFolderId);
    
    // Create file with timestamp
    const filename = `${itemId}_${new Date().getTime()}.jpg`;
    const file = folder.createFile(data).setName(filename);
    
    // Return shareable link
    return file.getUrl();
  } catch (error) {
    Logger.log('Image upload error: ' + error);
    return '';
  }
}
