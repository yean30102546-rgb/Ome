# QSMS Rework Management System

A modern, production-ready web application for managing rework cases with real-time Google Sheets integration.

## 🎯 Features

### Core Functionality
- ✅ **Real-time Data Sync** - Seamless integration with Google Sheets via Google Apps Script
- ✅ **Case Management** - Create, read, update rework cases with multiple items per case
- ✅ **Status Tracking** - Track cases through Pending → In-Progress → Completed workflow
- ✅ **Modal-based Updates** - Update case status without page redirects
- ✅ **Image Upload** - Upload up to 5 images per item with thumbnail gallery preview
- ✅ **Advanced Search** - Search cases by ID, source, or product name
- ✅ **Form Validation** - Strict validation with helpful error messages
- ✅ **Numeric Masking** - Force numeric input for specific fields (Item Code, Amount, etc.)

### Dashboard & Analytics
- 📊 **Modern Dashboard** - Beautiful, contemporary design with Glassmorphism aesthetic
- 📈 **Key Metrics** - Total cases, pending tasks, completion rate
- 📉 **Defect Analysis** - Most frequent defect reasons visualization
- 🏢 **Workload Distribution** - Cases by source (SFC, Customer, etc.)
- 📋 **Status Distribution** - Visual breakdown of case statuses

### User Experience
- 🎨 **Modern UI** - Clean industrial tech aesthetic with smooth animations
- ⚡ **Async Operations** - Non-blocking saves with loading states
- 🔄 **Status-based Sorting** - Cases automatically sorted: Pending → In-Progress → Completed
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile
- 🇹🇭 **Thai Language Support** - Full Thai language interface

---

## 🏗️ Architecture

### Frontend Stack
- **React 18** - Component-based UI framework
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Framer Motion** - Smooth animations and transitions
- **Lucide React** - Beautiful SVG icons

### Backend
- **Google Apps Script** - Serverless backend
- **Google Sheets** - Data storage and database
- **Google Drive** - File hosting for images (optional)

### Data Flow
```
React Frontend
    ↓
Google Apps Script Web App (JSON API)
    ↓
Google Sheets (Data Storage)
```

---

## 📁 Project Structure

```
src/
├── App.tsx                    # Main application component
├── main.tsx                   # Entry point
├── index.css                  # Global styles
│
├── services/
│   └── api.ts                 # Google Apps Script API integration
│
├── components/
│   ├── UpdateModal.tsx        # Modal for updating case status
│   ├── Dashboard.tsx          # Analytics dashboard
│   └── ImageUpload.tsx        # Image upload with preview
│
└── utils/
    └── helpers.ts             # Utility functions (validation, formatting, etc.)

gas/
└── Code.gs                    # Google Apps Script backend

DEPLOYMENT_GUIDE.md            # Complete deployment instructions
README.md                      # This file
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ and npm/yarn
- Google Account with access to Google Sheets and Apps Script
- A code editor (VS Code recommended)

### Local Development

1. **Clone/Download the project**
   ```bash
   git clone <your-repo>
   cd rework-management
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   ```
   http://localhost:5173
   ```

### First Time Setup

1. Create a Google Sheet (see DEPLOYMENT_GUIDE.md)
2. Deploy Google Apps Script code as Web App
3. Update `src/services/api.ts` with your GAS Web App URL
4. Run the app locally to test

---

## 📊 Data Schema

### Google Sheet Columns
| Column | Type | Purpose |
|--------|------|---------|
| Item ID | Text | Unique identifier for each item (RW260426-001-1) |
| Case ID | Text | Unique identifier for case (RW260426-001) |
| Date | DateTime | Timestamp when case was created |
| Source | Text | SFC or Customer |
| Item Number | Text | Product item number |
| Item Name | Text | Product name |
| Item Code | Text | Product code |
| Amount (Box) | Number | Quantity in boxes |
| Reason | Text | Defect reason |
| Responsible | Text | Accountable party |
| Details | Text | Additional information |
| Status | Text | Pending / In-Progress / Completed |
| Image URLs | Text | Pipe-separated URLs |

---

## 🎨 UI Components

### Page Tabs
1. **Overall** - List of all cases with search and status tracking
2. **Add Case** - Form to create new rework cases with items
3. **Dashboard** - Analytics and statistics visualization

### Key Components
- `SidebarItem` - Navigation menu items
- `StatCard` - Statistics display card
- `StatusPill` - Status badge with color coding
- `InputField` - Form input with label
- `UpdateModal` - Modal for case updates
- `Dashboard` - Analytics dashboard
- `ImageUpload` - Image upload with gallery

---

## 🔒 Data Validation

### Required Fields
- Item Number ✓
- Item Name ✓
- Amount (Box) ✓ (must be > 0)
- Reason ✓
- Responsible ✓

### Optional Fields
- Item Code (numbers only)
- Details (text)
- Images (up to 5 per item)

### Input Masking
- **Item Code**: Numbers only (enforced)
- **Amount Box**: Numbers only (positive)
- **Item Number**: Numbers only

### Save Button
- Disabled until all required fields are filled
- Shows loading state during submission
- Displays success/error messages

---

## 🔄 Workflow

### Creating a New Case
1. Click "เพิ่มงานใหม่ (Add Case)" in sidebar
2. Select source (SFC or Customer)
3. Fill in item details (can add multiple items)
4. Upload images (optional, up to 5 per item)
5. Click "บันทึกข้อมูลเข้าสู่ระบบ" to save
6. App automatically redirects to Overall tab on success

### Updating Case Status
1. Go to "ภาพรวม (Overall)" tab
2. Click on a case row
3. Modal opens with current case details
4. Select new status (Pending / In-Progress / Completed)
5. Click "บันทึกการเปลี่ยนแปลง" to save
6. Data updates immediately

### Viewing Analytics
1. Click "Dashboard" in sidebar
2. View key metrics:
   - Total cases and breakdown by status
   - Completion rate percentage
   - Most frequent defect reasons
   - Workload distribution by source
   - Status distribution pie chart

---

## 🛠️ Customization

### Change Status Types
Edit `App.tsx`:
```typescript
type Status = 'Pending' | 'In-Progress' | 'Completed';
// Change to your preferred statuses
```

### Change Defect Reasons
Edit `App.tsx` in the form section:
```jsx
<option>Custom Reason 1</option>
<option>Custom Reason 2</option>
```

### Change Color Scheme
Edit `index.css` theme variables:
```css
--color-accent: #18181b;  /* Change primary color */
--color-bg: #fdfdfd;      /* Change background */
```

### Adjust Image Upload Limits
Edit `components/ImageUpload.tsx`:
```typescript
maxImages={5}  // Change from 5 to desired number
```

---

## 📱 Responsive Design

The application is fully responsive:
- **Desktop**: Full sidebar navigation with expanded layout
- **Tablet**: Collapsible navigation with adjusted grid
- **Mobile**: Stack layout with simplified controls

---

## ⚡ Performance

- **Lazy Loading**: Components load on-demand
- **Memoization**: React optimization for expensive computations
- **Pagination Ready**: Dashboard can be extended with pagination for large datasets
- **Batch Operations**: Multiple items can be saved in one API call

---

## 🔐 Security Considerations

### Data Protection
- All data stored in Google Sheets (benefits from Google's security)
- HTTPS enforced on deployed frontend
- No sensitive data in local storage
- GAS functions execute with account permissions

### Access Control
- GAS deployed as Web App with "Anyone" access (adjust if needed)
- Google Sheet permissions control data access
- Consider adding authentication layer for sensitive deployments

### Best Practices
- Don't hardcode sensitive information
- Use environment variables for URLs
- Regularly backup Google Sheets
- Monitor GAS quotas and usage

---

## 🐛 Troubleshooting

### Common Issues

**"Failed to fetch" error**
- Verify GAS Web App URL in `api.ts`
- Check browser console for CORS errors
- Ensure GAS is deployed as Web App (not function)

**Data not saving**
- Check Google Sheet exists and is accessible
- Verify column headers match expected schema
- Check GAS logs for detailed errors

**Images not uploading**
- Verify file size < 10MB
- Check file format (PNG, JPG, GIF)
- Verify image upload handler in GAS

**Modal doesn't appear**
- Clear browser cache
- Check z-index in CSS
- Verify UpdateModal component is imported

---

## 📚 API Reference

### Insert Case
```typescript
insertCase(source: string, items: ReworkItem[], imageData?: Record<string, File[]>)
```
Creates a new case with items and optional images.

### Fetch All Cases
```typescript
fetchAllCases(): Promise<ApiResponse<ReworkCase[]>>
```
Retrieves all cases from Google Sheets.

### Update Case
```typescript
updateCase(caseId: string, updates: Partial<ReworkCase>)
```
Updates an existing case's status or details.

### Dashboard Stats
```typescript
fetchDashboardStats()
```
Gets aggregated statistics for the dashboard.

---

## 📈 Future Enhancements

- 📧 Email notifications on case creation
- 📞 WhatsApp integration for updates
- 🔔 Real-time notifications with WebSockets
- 🗂️ Advanced filtering and export to Excel
- 📅 Calendar view for case timeline
- 👥 User roles and permissions
- 💬 Comments/notes system
- 🔐 Two-factor authentication
- 📊 Advanced reporting with charts
- 🤖 AI-powered defect classification

---

## 📝 License

This project is proprietary. All rights reserved.

---

## 👥 Support

For issues, questions, or feature requests:
1. Check DEPLOYMENT_GUIDE.md for common issues
2. Review browser console and GAS logs
3. Contact your development team

---

**Made with ❤️ for QSMS Rework Management**

Last Updated: April 2026
Version: 1.0.0
