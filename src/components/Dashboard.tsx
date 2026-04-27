/**
 * Modern Dashboard Component
 * Visualizes key metrics and trends
 */

import React from 'react';
import {
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Package,
} from 'lucide-react';
import { ReworkCase } from '../services/api';

interface DashboardProps {
  cases: ReworkCase[];
  isLoading: boolean;
}

export function Dashboard({ cases, isLoading }: DashboardProps) {
  // Calculate statistics
  const stats = React.useMemo(() => {
    if (!cases || cases.length === 0) {
      return {
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        completionRate: 0,
        defectReasons: {} as Record<string, number>,
        sources: {} as Record<string, number>,
      };
    }

    const defectReasons: Record<string, number> = {};
    const sources: Record<string, number> = {};
    let pending = 0,
      inProgress = 0,
      completed = 0;

    cases.forEach((caseItem) => {
      // Count status
      switch (caseItem.status) {
        case 'Pending':
          pending++;
          break;
        case 'In-Progress':
          inProgress++;
          break;
        case 'Completed':
          completed++;
          break;
      }

      // Count sources
      sources[caseItem.source] = (sources[caseItem.source] || 0) + 1;

      // Count defect reasons
      caseItem.items.forEach((item) => {
        defectReasons[item.reason] = (defectReasons[item.reason] || 0) + 1;
      });
    });

    const total = cases.length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      pending,
      inProgress,
      completed,
      completionRate,
      defectReasons,
      sources,
    };
  }, [cases]);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl p-6 border border-border animate-pulse"
            >
              <div className="h-4 bg-slate-200 rounded w-1/2 mb-4" />
              <div className="h-8 bg-slate-200 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total Cases */}
        <MetricCard
          label="Total Cases"
          value={stats.total.toString()}
          icon={<Package size={24} className="text-blue-500" />}
          bgColor="bg-blue-50"
          trend={`${cases.length} recorded`}
        />

        {/* Pending Cases */}
        <MetricCard
          label="Pending"
          value={stats.pending.toString()}
          icon={<AlertCircle size={24} className="text-amber-500" />}
          bgColor="bg-amber-50"
          trend={`${Math.round((stats.pending / stats.total) * 100)}% of total`}
        />

        {/* In-Progress Cases */}
        <MetricCard
          label="In-Progress"
          value={stats.inProgress.toString()}
          icon={<Clock size={24} className="text-orange-500" />}
          bgColor="bg-orange-50"
          trend="Currently processing"
        />

        {/* Completion Rate */}
        <MetricCard
          label="Completion Rate"
          value={`${stats.completionRate}%`}
          icon={<CheckCircle2 size={24} className="text-emerald-500" />}
          bgColor="bg-emerald-50"
          trend={`${stats.completed} completed`}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Most Frequent Defect Reasons */}
        <div className="bg-white rounded-2xl p-8 border border-border">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Most Frequent Defect Reasons</h3>
            <TrendingDown size={20} className="text-amber-500" />
          </div>

          {Object.entries(stats.defectReasons)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .length > 0 ? (
            <div className="space-y-4">
              {Object.entries(stats.defectReasons)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([reason, count]) => (
                  <div key={reason} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground mb-1">{reason}</p>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full transition-all"
                          style={{
                            width: `${(count / Math.max(...Object.values(stats.defectReasons))) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="ml-4 text-sm font-bold text-foreground w-12 text-right">
                      {count}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted text-center py-8">No data available</p>
          )}
        </div>

        {/* Workload by Source */}
        <div className="bg-white rounded-2xl p-8 border border-border">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">Workload by Source</h3>
            <TrendingUp size={20} className="text-blue-500" />
          </div>

          {Object.entries(stats.sources).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(stats.sources)
                .sort(([, a], [, b]) => b - a)
                .map(([source, count]) => {
                  const total = stats.total;
                  const percentage = Math.round((count / total) * 100);

                  return (
                    <div key={source} className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground mb-1">{source}</p>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-blue-400 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                      <div className="ml-4 text-right">
                        <span className="text-sm font-bold text-foreground block">{count}</span>
                        <span className="text-xs text-muted">{percentage}%</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-sm text-muted text-center py-8">No data available</p>
          )}
        </div>
      </div>

      {/* Status Distribution */}
      <div className="bg-white rounded-2xl p-8 border border-border">
        <h3 className="text-lg font-semibold text-foreground mb-6">Status Distribution</h3>
        <div className="grid grid-cols-3 gap-6">
          {[
            { label: 'Pending', count: stats.pending, color: 'amber' },
            { label: 'In-Progress', count: stats.inProgress, color: 'orange' },
            { label: 'Completed', count: stats.completed, color: 'emerald' },
          ].map(({ label, count, color }) => {
            const percentage =
              stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
            const colorClasses: Record<string, string> = {
              amber: 'bg-amber-100 text-amber-700',
              orange: 'bg-orange-100 text-orange-700',
              emerald: 'bg-emerald-100 text-emerald-700',
            };

            return (
              <div key={label} className="text-center">
                <div
                  className={`inline-flex items-center justify-center w-24 h-24 rounded-full mb-4 ${colorClasses[color]}`}
                >
                  <div className="text-center">
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-xs font-semibold">{percentage}%</div>
                  </div>
                </div>
                <p className="font-medium text-foreground text-sm">{label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  bgColor: string;
  trend?: string;
}

function MetricCard({ label, value, icon, bgColor, trend }: MetricCardProps) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-border">
      <div className={`w-12 h-12 rounded-lg ${bgColor} flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">{label}</p>
      <h3 className="text-3xl font-bold text-foreground mb-2">{value}</h3>
      {trend && <p className="text-xs text-muted font-medium">{trend}</p>}
    </div>
  );
}
