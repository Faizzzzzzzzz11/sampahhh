import React, { useState, useMemo } from 'react';
import { Boxes, PlusCircle, Search } from 'lucide-react';
import { Bin, SystemConfig } from '../types';
import { litersOf } from '../services/routingEngine';

interface BinsQuickGridProps {
  bins: Bin[];
  config: SystemConfig;
  onOpenBinModal: (binId: number) => void;
  onOpenAddBin?: () => void;
  expanded?: boolean;
}

export const BinsQuickGrid: React.FC<BinsQuickGridProps> = ({
  bins,
  config,
  onOpenBinModal,
  onOpenAddBin,
  expanded = false,
}) => {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'fillDesc' | 'fillAsc' | 'idAsc'>('fillDesc');

  const filteredBins = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = bins.filter(b => {
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        (b.location || '').toLowerCase().includes(q) ||
        String(b.id).includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'fillDesc') return (b.noData ? -1 : b.fill) - (a.noData ? -1 : a.fill);
      if (sortBy === 'fillAsc') return (a.noData ? 999 : a.fill) - (b.noData ? 999 : b.fill);
      return a.id - b.id;
    });
  }, [bins, query, sortBy]);

  return (
    <div className="space-y-4 rounded-2xl border border-[#E2E8E5] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8E5] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E9F5EE] text-[#136D42]">
            <Boxes className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="font-['Bricolage_Grotesque'] text-base font-bold text-slate-900">
              Daftar {bins.length} Tong Sampah
            </h3>
            <p className="text-xs text-slate-500">
              Klik kartu tong untuk mengubah keterisian, sensor, atau koordinat
            </p>
          </div>
        </div>

        {onOpenAddBin && (
          <button
            onClick={onOpenAddBin}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#136D42] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#0F5734] cursor-pointer"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>+ Tambah Tong</span>
          </button>
        )}
      </div>

      {/* Search & Sort */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cari ID, nama tong, atau keterangan..."
            className="w-full rounded-xl border border-[#E2E8E5] bg-white py-2 pr-3 pl-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#136D42] focus:outline-none"
          />
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as 'fillDesc' | 'fillAsc' | 'idAsc')}
          className="rounded-xl border border-[#E2E8E5] bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#136D42] focus:outline-none cursor-pointer"
        >
          <option value="fillDesc">Terisi tertinggi</option>
          <option value="fillAsc">Terisi terendah</option>
          <option value="idAsc">Urutan nomor tong</option>
        </select>
        <span className="text-xs font-medium text-slate-500 tabular-nums self-center shrink-0">
          {filteredBins.length} tong
        </span>
      </div>

      <div
        className={`grid gap-2.5 overflow-y-auto pr-1 ${
          expanded
            ? 'grid-cols-2 sm:grid-cols-4 md:grid-cols-6 max-h-none'
            : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 max-h-72'
        }`}
      >
        {filteredBins.map(b => {
          let dot = 'bg-emerald-500';
          let badge = 'border-[#E2E8E5] bg-white hover:border-emerald-300';
          let pctColor = 'text-emerald-700';

          if (b.noData) {
            dot = 'bg-slate-400';
            badge = 'border-slate-200 bg-slate-50 hover:border-slate-300';
            pctColor = 'text-slate-600';
          } else if (b.fill >= config.redLimit) {
            dot = 'bg-red-500';
            badge = 'border-red-200 bg-red-50/50 hover:border-red-300';
            pctColor = 'text-red-700';
          } else if (b.fill >= config.yellowLimit) {
            dot = 'bg-amber-500';
            badge = 'border-amber-200 bg-amber-50/50 hover:border-amber-300';
            pctColor = 'text-amber-700';
          }

          return (
            <button
              key={b.id}
              onClick={() => onOpenBinModal(b.id)}
              className={`rounded-xl border p-3 text-left transition cursor-pointer ${badge}`}
              title={`${b.name}: ${b.noData ? 'Tanpa Data' : b.fill + '%'} — Klik untuk edit`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-slate-900 truncate">{b.name}</span>
                <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
              </div>
              <div className={`mt-1.5 font-['Bricolage_Grotesque'] text-lg font-bold tabular-nums ${pctColor}`}>
                {b.noData ? 'N/A' : `${b.fill}%`}
              </div>
              <div className="text-[10px] text-slate-500 tabular-nums">
                {b.noData ? 'Tanpa kabar' : `${litersOf(b, config)} L`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
