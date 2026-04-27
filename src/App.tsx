/**
 * QSMS Rework Management System - Refactored Frontend
 * React + Google Apps Script Integration
 * 
 * Features:
 * - Real-time data sync with Google Sheets via Google Apps Script
 * - Modal-based updates without page redirects
 * - Image upload with gallery preview (up to 5 images per item)
 * - Modern dashboard with statistics
 * - Form validation and numeric input masking
 * - Async saving with loading states
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Plus,
  ChevronRight,
  Search,
  Trash2,
  AlertCircle,
  Clock,
  CheckCircle2,
  Package,
  MoreVertical,
  BarChart3,
  RefreshCw,
} from 'lucide-react';

// Services & Utils
import {
  fetchAllCases,
  insertCase,
  updateCase,
  setGasWebAppUrl,
  fetchItemMaster,
  ReworkCase,
  ReworkItem,
} from './services/api';
import {
  generateCaseId,
  generateItemSubId,
  validateAllItems,
  isSaveDisabled,
  sortCasesByStatus,
  filterCasesByQuery,
  enforceNumeric,
  formatTimestamp,
  getStatistics,
} from './utils/helpers';

// Components
import { UpdateModal } from './components/UpdateModal';
import { Dashboard } from './components/Dashboard';
import { ImageUpload } from './components/ImageUpload';

type Tab = 'overall' | 'add' | 'dashboard';

interface ReworkItem {
  id: string;
  itemNumber: string;
  itemName: string;
  itemCode: string;
  amount: number;
  reason: string;
  reasonSubtype?: string; // e.g. "รั่วซึม", "รั่วซีลฟอยล์"
  responsible: string;
  responsibleSubtype?: string; // e.g. "PDF", "WFG"
  details?: string;
  imageUrls?: string[];
  status?: 'Pending' | 'In-Progress' | 'Completed';
}

interface ReworkCase {
  id: string;
  date: string;
  source: string;
  status: 'Pending' | 'In-Progress' | 'Completed';
  items: ReworkItem[];
}

/**
 * ===== MAIN APP COMPONENT =====
 */
export default function App() {
  // ===== REASON HIERARCHY & RESPONSIBLE MAPPING =====
  const REASON_MAIN_OPTIONS = [
    'รั่ว',
    'แตกตะเข็บ',
    'รอยมีด',
    'ขวดเปื้อน',
    'กล่องเปื้อนอย่างเดียว',
    'อื่นๆ',
  ];

  const LEAK_SUBTYPES = ['รั่วซึม', 'รั่วซีลฟอยล์', 'รั่วตามด'];

  const REASON_DEFAULT_RESPONSIBLE: Record<string, 'SFC' | 'Supplier' | ''> = {
    'รั่วซึม': 'SFC',
    'รั่วตามด': 'Supplier',
    'แตกตะเข็บ': 'Supplier',
    'รอยมีด': 'Supplier',
    'ขวดเปื้อน': 'SFC',
  };

  const RESPONSIBLE_MAIN_OPTIONS = ['SFC', 'Supplier', 'อื่นๆ'];

  const RESPONSIBLE_SUBDIVISIONS: Record<string, string[]> = {
    SFC: ['PDF', 'WFG', 'WPK', 'Customer', 'อื่นๆ'],
    Supplier: ['SP', 'PJW', 'Polymer', 'ธนกร', 'Fuchs', 'อื่นๆ'],
  };

  const [selectionModal, setSelectionModal] = useState<{
    itemId: string;
    type: 'reason' | 'responsible';
    title: string;
    options: string[];
  } | null>(null);
  const [autoFillTriggeredItem, setAutoFillTriggeredItem] = useState<string | null>(null);

  const getResponsibleDropdownOptions = (item: ReworkItem) => {
    const base = [...RESPONSIBLE_MAIN_OPTIONS];
    if (item.responsible && !base.includes(item.responsible)) {
      base.push(item.responsible);
    }
    return base;
  };

  const openSelectionModal = (
    itemId: string,
    type: 'reason' | 'responsible',
    title: string,
    options: string[]
  ) => {
    setSelectionModal({ itemId, type, title, options });
  };

  const handleSelectionModalChoose = (value: string) => {
    if (!selectionModal) return;

    setFormItems(prev =>
      prev.map(item => {
        if (item.id !== selectionModal.itemId) return item;

        if (selectionModal.type === 'reason') {
          // User selected a reason subtype (e.g., รั่วซึม)
          const suggestedResponsible = REASON_DEFAULT_RESPONSIBLE[value] || '';
          return {
            ...item,
            reason: 'รั่ว', // Keep main reason as "รั่ว"
            reasonSubtype: value, // Store subtype
            responsible: suggestedResponsible || item.responsible,
            responsibleSubtype: '', // Reset subtype when reason changes
          };
        }

        // User selected a responsible subtype (e.g., PDF)
        return {
          ...item,
          responsibleSubtype: value,
        };
      })
    );
    setSelectionModal(null);
  };

  const getReasonDropdownOptions = (item: ReworkItem) => {
    const options = [...REASON_MAIN_OPTIONS];
    if (item.reason && !options.includes(item.reason)) {
      options.push(item.reason);
    }
    return options;
  };

  const updateReasonAndResponsible = (id: string, reason: string) => {
    if (reason === 'รั่ว') {
      // Immediately open modal for leak subtypes
      setSelectionModal({
        itemId: id,
        type: 'reason',
        title: 'เลือกรูปแบบการรั่ว',
        options: LEAK_SUBTYPES,
      });
      return;
    }

    const suggestedResponsible = REASON_DEFAULT_RESPONSIBLE[reason] || '';
    setFormItems(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              reason,
              reasonSubtype: '', // Clear subtype for non-leak reasons
              responsible: suggestedResponsible || item.responsible,
              responsibleSubtype: '', // Reset responsible subtype
            }
          : item
      )
    );
  };

  const updateResponsibleSelection = (id: string, responsible: string) => {
    if (responsible === 'SFC' || responsible === 'Supplier') {
      openSelectionModal(
        id,
        'responsible',
        `เลือกระดับผู้รับผิดชอบ (${responsible})`,
        RESPONSIBLE_SUBDIVISIONS[responsible]
      );
      return;
    }

    setFormItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, responsible } : item
      )
    );
  };

  /**
   * Calculate deadline status for a case
   */
  const getDeadlineStatus = (caseDate: string, status: string) => {
    if (status === 'Completed') return null;

    const daysSince = Math.floor((Date.now() - new Date(caseDate).getTime()) / (1000 * 60 * 60 * 24));

    if (daysSince > 30) return 'danger'; // Over 30 days
    if (daysSince > 7) return 'warning'; // Over 7 days
    return null;
  };
  // ===== TAB STATE =====
  const [activeTab, setActiveTab] = useState<Tab>('overall');
  const [searchQuery, setSearchQuery] = useState('');
  // ===== DATA STATE =====
  const [cases, setCases] = useState<ReworkCase[]>([]);
  const [isLoadingCases, setIsLoadingCases] = useState(true);
  const [caseError, setCaseError] = useState<string | null>(null);

  // ===== MASTER DATA STATE =====
  const [itemMaster, setItemMaster] = useState<Map<string, string>>(new Map());
  const [isLoadingMaster, setIsLoadingMaster] = useState(true);

  // ===== FORM STATE =====
  const [caseSource, setCaseSource] = useState('SFC');
  const [formItems, setFormItems] = useState<ReworkItem[]>([
    {
      id: 'form-1',
      itemNumber: '',
      itemName: '',
      itemCode: '',
      amount: 1,
      reason: '',
      reasonSubtype: '',
      responsible: 'SFC',
      responsibleSubtype: '',
      details: '',
      imageUrls: [],
    },
  ]);

  // ===== MODAL STATE =====
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<ReworkCase | null>(null);
  const [isModalLoading, setIsModalLoading] = useState(false);

  // ===== FORM SUBMISSION STATE =====
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // ===== IMAGE UPLOAD STATE =====
  const [uploadedImages, setUploadedImages] = useState<Record<string, File[]>>({});

  const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzFFZnbPxVL62oy9FKX2bPVfOkl5f2vnif4gGoLB6p31e34po3qEFH1WMBqPrU86BwT/exec';

  /**
   * Load all cases and master data on component mount
   */
  useEffect(() => {
    setGasWebAppUrl(GAS_WEB_APP_URL);
    loadMasterData();
    loadCases();
  }, []);

  /**
   * Fetch item master data from GAS
   */
  const loadMasterData = async () => {
    try {
      setIsLoadingMaster(true);
      const result = await fetchItemMaster();
      if (result.success && result.data) {
        const masterMap = new Map(result.data.map(item => [item.itemNumber, item.itemName]));
        setItemMaster(masterMap);
      } else {
        console.warn('Failed to load master data:', result.error);
      }
    } catch (error) {
      console.error('Error loading master data:', error);
    } finally {
      setIsLoadingMaster(false);
    }
  };

  /**
   * Fetch cases from Google Sheets via GAS
   */
  const loadCases = async () => {
    try {
      setIsLoadingCases(true);
      setCaseError(null);

      const result = await fetchAllCases();

      if (result.success && result.data) {
        // Sort cases by status: Pending > In-Progress > Completed
        const sortedCases = sortCasesByStatus(result.data);
        setCases(sortedCases);
      } else {
        throw new Error(result.error || 'Failed to load cases');
      }
    } catch (error) {
      console.error('Error loading cases:', error);
      setCaseError(
        error instanceof Error ? error.message : 'Failed to load cases from server'
      );
    } finally {
      setIsLoadingCases(false);
    }
  };

  /**
   * Add a new form item
   */
  const addFormItem = () => {
    setFormItems([
      ...formItems,
      {
        id: `form-${Date.now()}`,
        itemNumber: '',
        itemName: '',
        itemCode: '',
        amount: 1,
        reason: '',
        reasonSubtype: '',
        responsible: 'SFC',
        responsibleSubtype: '',
        details: '',
        imageUrls: [],
      },
    ]);
  };

  /**
   * Remove a form item
   */
  const removeFormItem = (id: string) => {
    if (formItems.length > 1) {
      setFormItems(formItems.filter((item) => item.id !== id));
      // Also remove associated images
      const newImages = { ...uploadedImages };
      delete newImages[id];
      setUploadedImages(newImages);
    }
  };

  /**
   * Update form item field
   */
  const updateFormItem = (
    id: string,
    field: keyof ReworkItem,
    value: string | number
  ) => {
    if (field === 'itemNumber') {
      const typed = String(value);
      const itemName = itemMaster.get(typed.trim());
      setFormItems(prev =>
        prev.map(item =>
          item.id === id
            ? {
                ...item,
                itemNumber: typed,
                itemName: itemName ? itemName : item.itemName,
              }
            : item
        )
      );

      if (itemName) {
        setAutoFillTriggeredItem(id);
        window.setTimeout(() => setAutoFillTriggeredItem(prev => (prev === id ? null : prev)), 900);
      }
      return;
    }

    setFormItems(
      formItems.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]:
                field === 'itemCode'
                  ? enforceNumeric(String(value))
                  : field === 'amount'
                    ? Math.max(0, parseInt(String(value)) || 0)
                    : value,
            }
          : item
      )
    );
  };

  /**
   * Handle images selected for an item
   */
  const handleImagesSelected = (itemId: string, files: File[]) => {
    setUploadedImages((prev) => ({
      ...prev,
      [itemId]: files,
    }));
  };

  /**
   * Submit new case
   */
  const handleSubmit = async () => {
    // Validate
    const validation = validateAllItems(formItems);
    if (!validation.isValid) {
      setSaveMessage({
        type: 'error',
        text: `Please check: ${Object.values(validation.errors).flat().join(', ')}`,
      });
      setTimeout(() => setSaveMessage(null), 5000);
      return;
    }

    try {
      setIsSaving(true);
      setSaveMessage(null);

      const result = await insertCase(caseSource, formItems, uploadedImages);

      if (result.success) {
        setSaveMessage({
          type: 'success',
          text: `✅ บันทึกข้อมูลสำเร็จ! Case ID: ${result.data?.caseId || 'N/A'}`,
        });

        // Reset form
        setFormItems([
          {
            id: 'form-1',
            itemNumber: '',
            itemName: '',
            itemCode: '',
            amount: 1,
            reason: '',
            reasonSubtype: '',
            responsible: 'SFC',
            responsibleSubtype: '',
            details: '',
            imageUrls: [],
          },
        ]);
        setCaseSource('SFC');
        setUploadedImages({});

        // Reload cases in background
        await loadCases();

        // Auto-switch to overall tab after 2 seconds
        setTimeout(() => {
          setActiveTab('overall');
          setSaveMessage(null);
        }, 2000);
      } else {
        throw new Error(result.error || 'Failed to save case');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      setSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save case',
      });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Open update modal
   */
  const openUpdateModal = (caseItem: ReworkCase) => {
    setSelectedCase(caseItem);
    setIsModalOpen(true);
  };

  /**
   * Handle case update from modal
   */
  const handleUpdateCase = async (
    caseId: string,
    updates: Partial<ReworkCase>
  ) => {
    try {
      setIsModalLoading(true);

      const result = await updateCase(caseId, updates);

      if (result.success) {
        // Update local state
        setCases(
          cases.map((c) =>
            c.id === caseId ? { ...c, ...updates } : c
          )
        );
        setIsModalOpen(false);
        setSelectedCase(null);

        // Reload cases to ensure sync
        await loadCases();
      } else {
        throw new Error(result.error || 'Failed to update case');
      }
    } catch (error) {
      console.error('Error updating case:', error);
      alert(
        `Error: ${error instanceof Error ? error.message : 'Failed to update case'}`
      );
    } finally {
      setIsModalLoading(false);
    }
  };

  // ===== DERIVED DATA =====
  const filteredCases = filterCasesByQuery(cases, searchQuery);
  const stats = getStatistics(filteredCases);

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-foreground font-sans">
      {/* ===== SIDEBAR ===== */}
      <aside className="w-[260px] bg-surface border-r border-border flex flex-col z-20 h-full py-8 px-6 overflow-y-auto">
        <div
          className="flex items-center gap-2 mb-12 cursor-pointer"
          onClick={() => setActiveTab('overall')}
        >
          <div className="w-2 h-2 bg-accent rounded-full" />
          <h1 className="font-semibold text-[18px] tracking-tight text-foreground">
            QSMS Rework
          </h1>
        </div>

        <nav className="flex-1 -mx-2">
          <SidebarItem
            active={activeTab === 'overall'}
            onClick={() => setActiveTab('overall')}
            label="ภาพรวม (Overall)"
            icon={<Package size={16} />}
          />
          <SidebarItem
            active={activeTab === 'add'}
            onClick={() => setActiveTab('add')}
            label="เพิ่มงานใหม่ (Add Case)"
            icon={<Plus size={16} />}
          />
        </nav>

        {/* Dashboard at bottom */}
        <div className="pt-8 border-t border-border mt-auto">
          <SidebarItem
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
            label="แดชบอร์ด (Dashboard)"
            icon={<BarChart3 size={16} />}
          />
        </div>

        <div className="mt-8 pt-8 border-t border-border">
          <div className="flex items-center justify-between text-sm py-2 px-3 rounded-lg hover:bg-[#f4f4f5] cursor-pointer transition-all">
            <span className="font-medium text-foreground">QSMS Admin</span>
            <span className="text-[10px] uppercase font-bold text-muted bg-slate-100 px-1.5 py-0.5 rounded leading-none">
              System
            </span>
          </div>
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 overflow-y-auto bg-bg p-10 md:p-[40px_60px]">
        <AnimatePresence mode="wait">
          {/* ===== OVERALL TAB ===== */}
          {activeTab === 'overall' && (
            <motion.div
              key="overall"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-12"
            >
              <header className="flex justify-between items-end">
                <div>
                  <p className="text-sm text-muted font-medium mb-1">
                    {new Date().toLocaleDateString('th-TH', {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <h1 className="text-3xl font-medium tracking-tight text-foreground">
                    สวัสดีตอนเช้า Admin
                  </h1>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={loadCases}
                    disabled={isLoadingCases}
                    className="w-10 h-10 border border-border rounded-full flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-all text-foreground disabled:opacity-50"
                    title="Refresh data"
                  >
                    <RefreshCw size={20} className={isLoadingCases ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={() => setActiveTab('add')}
                    className="w-10 h-10 border border-border rounded-full flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-all text-foreground"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </header>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard label="จำนวนงานทั้งหมด (Total)" value={stats.total.toString()} />
                <StatCard
                  label="รอดำเนินการ (Pending)"
                  value={stats.pending.toString()}
                  trend={`${Math.round((stats.pending / (stats.total || 1)) * 100)}%`}
                />
                <StatCard label="กำลังดำเนินการ (In-Progress)" value={stats.inProgress.toString()} />
                <StatCard label="เสร็จสิ้น (Completed)" value={stats.completed.toString()} />
              </div>

              {/* Cases List */}
              <div className="space-y-6">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-base font-semibold text-foreground italic underline decoration-accent/20 underline-offset-4 tracking-tight">
                    รายการงาน Rework ล่าสุด
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                      <input
                        type="text"
                        placeholder="ค้นหางาน..."
                        className="pl-9 pr-4 py-1.5 bg-white border border-border rounded-lg text-[10px] focus:outline-none focus:ring-1 focus:ring-accent font-bold uppercase"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Loading or Error State */}
                {isLoadingCases ? (
                  <div className="glass-card p-8 bg-white text-center">
                    <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto" />
                    <p className="text-muted mt-4 text-sm">Loading cases...</p>
                  </div>
                ) : caseError ? (
                  <div className="glass-card p-6 bg-white border border-red-200 bg-red-50">
                    <div className="flex items-start gap-4">
                      <AlertCircle className="text-red-500 mt-1" size={20} />
                      <div>
                        <p className="font-semibold text-red-700">Error loading data</p>
                        <p className="text-sm text-red-600 mt-1">{caseError}</p>
                        <button
                          onClick={loadCases}
                          className="text-sm font-semibold text-red-700 hover:text-red-800 mt-3 underline"
                        >
                          Try again
                        </button>
                      </div>
                    </div>
                  </div>
                ) : filteredCases.length === 0 ? (
                  <div className="glass-card p-12 bg-white text-center">
                    <Package size={40} className="text-muted/30 mx-auto mb-4" />
                    <p className="text-muted font-medium">No cases found</p>
                    <p className="text-sm text-muted mt-1">
                      {searchQuery ? 'Try adjusting your search' : 'Start by adding a new case'}
                    </p>
                  </div>
                ) : (
                  <div className="glass-card p-2 bg-white">
                    <div className="divide-y divide-[#f1f1f1]">
                      {filteredCases.map((item) => {
                        const deadlineStatus = getDeadlineStatus(item.date, item.status);
                        return (
                          <motion.div
                            key={item.id}
                            layout
                            onClick={() => openUpdateModal(item)}
                            className={`flex items-center py-4 px-4 hover:bg-slate-50/50 transition-colors group rounded-lg cursor-pointer ${
                              deadlineStatus === 'warning' ? 'bg-orange-50 border-l-4 border-orange-400' :
                              deadlineStatus === 'danger' ? 'bg-red-50 border-l-4 border-red-400' : ''
                            }`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-medium text-foreground">
                                  {item.items[0]?.itemName || 'N/A'}
                                </div>
                                {deadlineStatus === 'warning' && (
                                  <div className="flex items-center gap-1 text-orange-600 text-xs">
                                    <Clock size={12} />
                                    <span>7 วัน</span>
                                  </div>
                                )}
                                {deadlineStatus === 'danger' && (
                                  <div className="flex items-center gap-1 text-red-600 text-xs">
                                    <AlertCircle size={12} />
                                    <span>เกิน 30 วัน</span>
                                  </div>
                                )}
                              </div>
                              <div className="text-[12px] text-muted mt-1">
                                {formatTimestamp(item.date)} &bull; Source:{' '}
                                <span className="font-bold">{item.source}</span> &bull;{' '}
                                <span className="font-mono text-accent">{item.id}</span>
                              </div>
                            </div>
                            <div className="mr-8 text-right">
                              <p className="text-xs font-bold text-foreground">
                                {item.items[0]?.amount || 0} Box
                              </p>
                              <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">
                                {item.items[0]?.reason || 'N/A'}
                              </p>
                            </div>
                            <StatusPill status={item.status} />
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'add' && (
            <motion.div
              key="add"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-5xl mx-auto space-y-10 pb-20"
            >
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">บันทึกงาน Rework ใหม่</h2>
                  <p className="text-muted text-sm mt-1">เพิ่มข้อมูลล็อตสินค้าที่พบคราบหรือความเสียหาย</p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-muted uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">
                  <Clock size={12} /> บันทึกข้อมูลสด
                </div>
              </div>

              {/* Success/Error Message */}
              <AnimatePresence>
                {saveMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`p-4 rounded-lg font-semibold text-sm ${
                      saveMessage.type === 'success'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {saveMessage.text}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-8">
                {/* Global Info */}
                <div className="glass-card p-6 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-muted uppercase tracking-[0.1em] ml-1">แหล่งที่มาของงาน (Source) *</label>
                       <select 
                         value={caseSource}
                         onChange={(e) => setCaseSource(e.target.value)}
                         className="w-full px-4 py-3 bg-slate-50 border border-border rounded-xl focus:outline-none focus:border-accent text-sm"
                       >
                         <option>SFC</option>
                         <option>Customer</option>
                       </select>
                    </div>
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-6">
                  {formItems.map((item, idx) => (
                    <motion.div 
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-card p-8 bg-white relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-accent opacity-20"></div>
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-sm font-bold text-accent flex items-center gap-2">
                          <Package size={16} /> 📦 Item ที่ {idx + 1}
                        </h3>
                        {formItems.length > 1 && (
                          <button 
                            onClick={() => removeFormItem(item.id)}
                            className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <InputField
                        label="หมายเลขรายการ (Item Number) *"
                        value={item.itemNumber}
                        onChange={(v) => updateFormItem(item.id, 'itemNumber', v)}
                        placeholder="e.g. M-101"
                        disabled={isSaving}
                      />
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-[0.1em] ml-1">
                          ชื่อรายการ (Item Name) *
                        </label>
                        <input
                          value={item.itemName}
                          onChange={(e) => updateFormItem(item.id, 'itemName', e.target.value)}
                          placeholder="ชื่อสินค้า"
                          disabled={isSaving}
                          className="w-full px-4 py-3 bg-slate-50 border border-border rounded-xl focus:outline-none focus:border-accent transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <AnimatePresence>
                          {autoFillTriggeredItem === item.id && (
                            <motion.p
                              initial={{ opacity: 0, y: -6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              className="text-xs text-emerald-600 font-medium"
                            >
                              ชื่อรายการถูกเติมอัตโนมัติ
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                      <InputField
                        label="รหัสรายการ (Item Code)"
                        value={item.itemCode}
                        onChange={(v) => updateFormItem(item.id, 'itemCode', v)}
                        placeholder="e.g. MO-01"
                        disabled={isSaving}
                      />
                      <InputField
                        label="จำนวน (Box) *"
                        type="number"
                        value={item.amount}
                        onChange={(v) => updateFormItem(item.id, 'amount', v)}
                        disabled={isSaving}
                      />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-muted uppercase tracking-[0.1em] ml-1">
                            สาเหตุที่พบ *
                          </label>
                          <div className="space-y-2">
                            <select
                              value={item.reason}
                              onChange={(e) => updateReasonAndResponsible(item.id, e.target.value)}
                              className="w-full px-4 py-3 bg-slate-50 border border-border rounded-xl focus:outline-none focus:border-accent text-sm disabled:opacity-50"
                              disabled={isSaving}
                            >
                              {getReasonDropdownOptions(item).map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                            {item.reason === 'รั่ว' && item.reasonSubtype && (
                              <div className="px-3 py-2 bg-accent/10 border border-accent rounded-lg">
                                <p className="text-[10px] text-muted font-semibold mb-1">เลือก: </p>
                                <p className="text-sm font-semibold text-accent">{item.reasonSubtype}</p>
                              </div>
                            )}
                            {item.reason === 'รั่ว' && !item.reasonSubtype && (
                              <p className="text-[10px] text-amber-600 font-medium">⚠ เลือกรูปแบบการรั่วเพื่อให้ระบบช่วยแนะนำ</p>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-muted uppercase tracking-[0.1em] ml-1">
                            ผู้รับผิดชอบ *
                          </label>
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <select
                                value={item.responsible}
                                onChange={(e) => updateFormItem(item.id, 'responsible', e.target.value)}
                                className="flex-1 px-4 py-3 bg-slate-50 border border-border rounded-xl focus:outline-none focus:border-accent text-sm disabled:opacity-50"
                                disabled={isSaving}
                              >
                                {getResponsibleDropdownOptions(item).map(option => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </select>
                              {(item.responsible === 'SFC' || item.responsible === 'Supplier') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectionModal({
                                      itemId: item.id,
                                      type: 'responsible',
                                      title: `เลือกระดับผู้รับผิดชอบ (${item.responsible})`,
                                      options: RESPONSIBLE_SUBDIVISIONS[item.responsible as 'SFC' | 'Supplier'],
                                    });
                                  }}
                                  className="px-4 py-3 bg-accent/10 text-accent border border-accent rounded-xl text-sm font-semibold hover:bg-accent/20 transition-all disabled:opacity-50"
                                  disabled={isSaving}
                                  title="เลือก subdivision"
                                >
                                  เลือก
                                </button>
                              )}
                            </div>
                            {(item.responsible === 'SFC' || item.responsible === 'Supplier') && item.responsibleSubtype && (
                              <div className="px-3 py-2 bg-accent/10 border border-accent rounded-lg">
                                <p className="text-[10px] text-muted font-semibold mb-1">เลือก: </p>
                                <p className="text-sm font-semibold text-accent">{item.responsibleSubtype}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-[0.1em] ml-1">
                          รายละเอียดเพิ่มเติม
                        </label>
                        <textarea
                          rows={3}
                          value={item.details || ''}
                          onChange={(e) => updateFormItem(item.id, 'details', e.target.value)}
                          placeholder="ระบุรายละเอียดเพิ่มเติม..."
                          className="w-full px-4 py-3 bg-slate-50 border border-border rounded-xl focus:outline-none focus:border-accent text-sm resize-none disabled:opacity-50"
                          disabled={isSaving}
                        ></textarea>
                      </div>

                      {/* Image Upload */}
                      <div className="md:col-span-1">
                        <ImageUpload
                          itemIndex={idx}
                          onImagesSelected={(files) => handleImagesSelected(item.id, files)}
                          maxImages={5}
                        />
                      </div>
                      </div>
                    </motion.div>
                  ))}

                  <div className="flex gap-4">
                    <button
                      onClick={addFormItem}
                      disabled={isSaving}
                      className="flex-1 py-4 border border-border border-dashed rounded-2xl text-muted text-xs font-bold uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Plus size={16} /> [ + ] เพิ่มรายการ
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={isSaveDisabled(formItems) || isSaving}
                      className="flex-[2] py-4 bg-accent text-white rounded-2xl text-sm font-bold hover:bg-black transition-all shadow-xl shadow-accent/10 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          กำลังบันทึก...
                        </>
                      ) : (
                        <>
                          บันทึกข้อมูลเข้าสู่ระบบ <ChevronRight size={16} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ===== DASHBOARD TAB ===== */}
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <header>
                <p className="text-sm text-muted font-medium mb-1">
                  {new Date().toLocaleDateString('th-TH', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
                <h1 className="text-3xl font-medium tracking-tight text-foreground">
                  แดชบอร์ด &amp; สถิติ
                </h1>
              </header>

              <Dashboard cases={filteredCases} isLoading={isLoadingCases} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

 {/* ===== UPDATE MODAL ===== */}
      <AnimatePresence>
        {selectionModal && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-xl bg-white rounded-3xl p-6 shadow-2xl border border-border"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[11px] text-muted uppercase tracking-[0.18em] mb-1">เลือกคำตอบ</p>
                  <h2 className="text-xl font-semibold text-foreground">{selectionModal.title}</h2>
                </div>
                <button
                  onClick={() => setSelectionModal(null)}
                  className="text-sm text-muted hover:text-foreground"
                >
                  ปิด
                </button>
              </div>
              <div className="grid gap-3">
                {selectionModal.options.map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSelectionModalChoose(option)}
                    className="w-full rounded-2xl border border-border bg-slate-50 px-4 py-4 text-left text-sm font-semibold text-foreground hover:bg-slate-100 transition"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <UpdateModal
        isOpen={isModalOpen}
        caseData={selectedCase}
        isLoading={isModalLoading}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedCase(null);
        }}
        onUpdate={handleUpdateCase}
      />
    </div> // ปิด div หลักของ App
  ); // ปิด return
} // <--- นี่คือ "ปีกกาปิด" ที่หายไปครับ! ฟังก์ชัน App จบตรงนี้

/**
 * ===== HELPER COMPONENTS & INTERFACES =====
 * ย้ายมาอยู่นอกฟังก์ชัน App ทั้งหมด
 */

interface SidebarItemProps {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}

function SidebarItem({ active, onClick, label, icon }: SidebarItemProps) {
  return (
    <div
      onClick={onClick}
      className={`sidebar-item mb-1 flex items-center gap-3 ${active ? 'active' : ''}`}
    >
      {icon && <span className="text-muted">{icon}</span>}
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  trend?: string;
}

function StatCard({ label, value, trend }: StatCardProps) {
  return (
    <div className="stat-card bg-white p-6 rounded-2xl border border-border">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted mb-3 leading-none">
        {label}
      </p>
      <div className="flex items-end justify-between">
        <h3 className="text-[28px] font-bold tracking-tighter text-foreground leading-none">
          {value}
        </h3>
        {trend && (
          <span className="text-[9px] text-muted font-bold uppercase tracking-widest bg-slate-50 px-2 py-0.5 border border-border rounded-full leading-none">
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}

interface StatusPillProps {
  status: 'Pending' | 'In-Progress' | 'Completed';
}

function StatusPill({ status }: StatusPillProps) {
  const styles: Record<string, string> = {
    Pending: 'bg-[#fef9c3] text-amber-700 border-amber-200',
    'In-Progress': 'bg-[#f4f4f5] text-foreground border-border',
    Completed: 'bg-[#f0fdf4] text-emerald-700 border-emerald-200',
  };

  const thaiLabels: Record<string, string> = {
    Pending: 'รอดำเนินการ',
    'In-Progress': 'กำลังดำเนินการ',
    Completed: 'เสร็จสิ้น',
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${
        styles[status] || styles['Pending']
      }`}
    >
      {thaiLabels[status] || status}
    </span>
  );
}

interface InputFieldProps {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
}: InputFieldProps) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase text-muted tracking-[0.1em] ml-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-4 py-3 bg-slate-50 border border-border rounded-xl focus:outline-none focus:border-accent transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
}