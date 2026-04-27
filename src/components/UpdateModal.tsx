/**
 * Update Modal Component
 * Allows users to update case status and details
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { ReworkCase } from '../services/api';

interface UpdateModalProps {
  isOpen: boolean;
  caseData: ReworkCase | null;
  isLoading: boolean;
  onClose: () => void;
  onUpdate: (caseId: string, updates: Partial<ReworkCase>) => Promise<void>;
}

export function UpdateModal({
  isOpen,
  caseData,
  isLoading,
  onClose,
  onUpdate,
}: UpdateModalProps) {
  const [newStatus, setNewStatus] = React.useState<'Pending' | 'In-Progress' | 'Completed'>(
    caseData?.status || 'Pending'
  );

  React.useEffect(() => {
    if (caseData) {
      setNewStatus(caseData.status);
    }
  }, [caseData]);

  const handleUpdate = async () => {
    if (!caseData) return;
    await onUpdate(caseData.id, { status: newStatus });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-8 py-6 flex items-center justify-between border-b border-border">
                <div>
                  <h2 className="text-xl font-bold text-foreground">อัปเดตสถานะงาน</h2>
                  <p className="text-sm text-muted mt-1">{caseData?.id}</p>
                </div>
                <button
                  onClick={onClose}
                  disabled={isLoading}
                  className="p-2 hover:bg-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <X size={20} className="text-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="px-8 py-6 space-y-8">
                {/* Case Info */}
                {caseData && (
                  <div className="bg-slate-50 rounded-xl p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
                          แหล่งที่มา
                        </p>
                        <p className="text-base font-semibold text-foreground">{caseData.source}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
                          วันที่
                        </p>
                        <p className="text-base font-semibold text-foreground">{caseData.date}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
                          จำนวนรายการ
                        </p>
                        <p className="text-base font-semibold text-foreground">
                          {caseData.items.length} items
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
                          สถานะปัจจุบัน
                        </p>
                        <StatusBadge status={caseData.status} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Status Update Section */}
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-muted uppercase tracking-[0.1em]">
                    เปลี่ยนสถานะเป็น *
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    {(['Pending', 'In-Progress', 'Completed'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => setNewStatus(status)}
                        disabled={isLoading}
                        className={`p-4 rounded-xl border-2 transition-all font-semibold disabled:opacity-50 ${
                          newStatus === status
                            ? 'border-accent bg-accent/5 text-accent'
                            : 'border-border text-muted hover:border-accent/50'
                        }`}
                      >
                        {status === 'Pending' && (
                          <AlertCircle size={20} className="mx-auto mb-2" />
                        )}
                        {status === 'In-Progress' && (
                          <Clock size={20} className="mx-auto mb-2" />
                        )}
                        {status === 'Completed' && (
                          <CheckCircle2 size={20} className="mx-auto mb-2" />
                        )}
                        <div className="text-xs">{status}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Item Details */}
                {caseData && caseData.items.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
                      รายละเอียดรายการ
                    </p>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {caseData.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-50 rounded-lg p-4 text-sm border border-border"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <p className="font-semibold text-foreground">{item.itemName}</p>
                            <span className="text-xs text-muted bg-white px-2 py-1 rounded">
                              {item.amount} Box
                            </span>
                          </div>
                          <p className="text-xs text-muted mb-1">
                            Item Code: <span className="font-mono font-semibold">{item.itemCode}</span>
                          </p>
                          <p className="text-xs text-muted">
                            Reason: <span className="font-semibold">{item.reason}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-slate-50 px-8 py-6 flex gap-4 border-t border-border">
                <button
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex-1 py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={isLoading || !caseData}
                  className="flex-1 py-3 rounded-xl bg-accent text-white font-semibold hover:bg-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      กำลังบันทึก...
                    </>
                  ) : (
                    'บันทึกการเปลี่ยนแปลง'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function StatusBadge({ status }: { status: 'Pending' | 'In-Progress' | 'Completed' }) {
  const styles = {
    Pending: 'bg-[#fef9c3] text-amber-700 border-amber-200',
    'In-Progress': 'bg-[#f4f4f5] text-foreground border-border',
    Completed: 'bg-[#f0fdf4] text-emerald-700 border-emerald-200',
  };

  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${styles[status]}`}>
      {status}
    </span>
  );
}
