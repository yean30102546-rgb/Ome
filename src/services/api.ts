/**
 * API Service for Google Apps Script Integration
 * แก้ไขจุดที่ 1 (JSON Sync) และ จุดที่ 2 (CORS Bypass)
 */

// ⚠️ GAS URL ต้องถูกตั้งค่าจาก App.tsx หรือ environment
let GAS_WEB_APP_URL = '';

export function setGasWebAppUrl(url: string): void {
  const normalizedUrl = String(url || '').trim();
  if (normalizedUrl && normalizedUrl.includes('script.google.com/macros/s') && normalizedUrl.endsWith('/exec')) {
    GAS_WEB_APP_URL = normalizedUrl;
  } else {
    console.warn('Invalid GAS Web App URL set:', url);
  }
}

function ensureGasWebAppUrl() {
  if (!GAS_WEB_APP_URL) {
    throw new Error('GAS_WEB_APP_URL is not configured. Call setGasWebAppUrl(url) before using the API.');
  }
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ReworkItem {
  id: string;
  itemNumber: string;
  itemName: string;
  itemCode: string;
  amount: number;
  reason: string;
  reasonSubtype?: string;
  responsible: string;
  responsibleSubtype?: string;
  details?: string;
  imageUrls?: string[];
  status?: 'Pending' | 'In-Progress' | 'Completed';
}

export interface ReworkCase {
  id: string;
  date: string;
  source: string;
  status: 'Pending' | 'In-Progress' | 'Completed';
  items: ReworkItem[];
}

/**
 * ฟังก์ชันช่วยแปลงไฟล์ภาพเป็น Base64
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const DEFAULT_HEADERS = { 'Content-Type': 'text/plain;charset=utf-8' };

async function postToGas<T>(payload: object): Promise<ApiResponse<T>> {
  ensureGasWebAppUrl();

  const response = await fetch(GAS_WEB_APP_URL, {
    method: 'POST',
    mode: 'cors',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Network response was not ok (${response.status})`);
  }

  return (await response.json()) as ApiResponse<T>;
}

/**
 * 1. Insert a new rework case (แก้ไขการส่งเป็น JSON + Base64 Images)
 */
export async function insertCase(
  source: string,
  items: ReworkItem[],
  imageData?: Record<string, File[]>
): Promise<ApiResponse<{ caseId: string; itemIds: string[] }>> {
  try {
    // แปลงไฟล์รูปภาพทั้งหมดเป็น Base64 ก่อนส่ง (เพื่อให้ GAS.txt รับได้)
    const processedItems = await Promise.all(items.map(async (item) => {
      const base64Images = imageData && imageData[item.id]
        ? await Promise.all(imageData[item.id].map(fileToBase64))
        : [];
      
      return {
        itemNumber: item.itemNumber,
        itemName: item.itemName,
        itemCode: item.itemCode,
        amount: item.amount,
        reason: item.reason,
        reasonSubtype: item.reasonSubtype || '',
        responsible: item.responsible,
        responsibleSubtype: item.responsibleSubtype || '',
        details: item.details || '',
        images: base64Images // ส่งเป็น Array ของ string (base64)
      };
    }));

    const result = await postToGas<{ caseId: string; itemIds: string[] }>({
      action: 'insert',
      source,
      items: processedItems,
    });
    return {
      success: result.success,
      data: result.data,
      error: result.error
    };
  } catch (error) {
    console.error('Error inserting case:', error);
    return { success: false, error: 'Failed to insert case' };
  }
}

/**
 * 2. Fetch all rework cases (ดึงข้อมูล)
 */
export async function fetchAllCases(): Promise<ApiResponse<ReworkCase[]>> {
  try {
    const result = await postToGas<ReworkCase[]>({ action: 'readAll' });

    if (result.success === false) {
      console.error('GAS Logic Error:', result.error);
      return { success: false, data: [], error: result.error };
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
/**
 * 3. Update case status (อัปเดต)
 */
export async function updateCase(
  caseId: string,
  updates: Partial<ReworkCase>
): Promise<ApiResponse> {
  try {
    const result = await postToGas({
      action: 'update',
      caseId,
      updates,
    });

    return { success: result.success, message: result.message };
  } catch (error) {
    return { success: false, error: 'Update failed' };
  }
}

/**
 * 4. Fetch dashboard statistics
 */
export async function fetchDashboardStats(): Promise<ApiResponse> {
  try {
    const result = await postToGas({ action: 'dashboardStats' });
    return { success: result.success, data: result.data };
  } catch (error) {
    return { success: false };
  }
}

/**
 * 5. Fetch item master data
 */
export async function fetchItemMaster(): Promise<ApiResponse<{itemNumber: string, itemName: string}[]>> {
  try {
    const result = await postToGas<{itemNumber: string, itemName: string}[]>({ action: 'getItemMaster' });
    return { success: result.success, data: result.data || [], error: result.error };
  } catch (error) {
    return { success: false, data: [], error: 'Failed to fetch item master' };
  }
}