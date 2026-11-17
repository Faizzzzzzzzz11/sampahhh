import React, { useState } from 'react';
import { Gauge, Eye, Play, Layers, ChevronDown, ChevronUp, Route, CheckCircle2, MapPin } from 'lucide-react';
import { ExecutionResult, SystemConfig, Trip } from '../types';
import { toRealKm } from '../services/routingEngine';

interface EfficiencyCardProps {
  result: ExecutionResult;
  config: SystemConfig;
  convPlan: { trips: number; dist: number; liter: number };
  binCount: number;
  fixedTrip?: Trip;
  selectedTripFilter?: 'all' | 'fixed' | number | string;
  onSelectTripFilter?: (filter: 'all' | 'fixed' | number | string) => void;
  onPlaySpecificTripAnim?: (tripIdx: number | 'fixed') => void;
  showFixedComparison?: boolean;
  onToggleFixedComparison?: () => void;
  onOpenGoogleMapsForTrip?: (tripIdx: number | string) => void;
}

export const EfficiencyCard: React.FC<EfficiencyCardProps> = ({
  result,
  config,
  convPlan,
  binCount,
  fixedTrip,
  selectedTripFilter,
  onSelectTripFilter,
  onPlaySpecificTripAnim,
  showFixedComparison = false,
  onToggleFixedComparison,
  onOpenGoogleMapsForTrip,
}) => {
  const [showSubTripsDetail, setShowSubTripsDetail] = useState(false);

  const convKm = fixedTrip?.realRoadKm || toRealKm(convPlan.dist);
  const smartKm = result.totalRealRoadKm || toRealKm(result.totalDistance);
  const convDistNum = parseFloat(convKm) || convPlan.dist;
  const smartDistNum = parseFloat(smartKm) || result.totalDistance;
  const savedDist = convDistNum - smartDistNum;
  const pctSaved = convDistNum > 0 ? ((savedDist / convDistNum) * 100).toFixed(1) : '0.0';
  const savedKm = (convDistNum - smartDistNum).toFixed(1);
  const savedFuel = (parseFloat(savedKm) * (config.fuelPerKm || 0.22)).toFixed(1);

  const isFixedActive = selectedTripFilter === 'fixed' || (typeof selectedTripFilter === 'string' && selectedTripFilter.startsWith('fixed-'));

  return (
    <div className="space-y-3.5 rounded-2xl border border-[#E2E8E5] bg-white p-4 sm:p-5 dark:bg-[#121D22] dark:border-[#243741] transition">
      {/* Header with Title & Quick Map Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#E2E8E5] pb-3 dark:border-[#243741]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E9F5EE] text-[#136D42] dark:bg-emerald-950/60 dark:text-emerald-400">
            <Gauge className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-['Bricolage_Grotesque'] text-base font-bold text-slate-900 dark:text-white">
                Tingkat Efisiensi: Rute Tetap vs Rute Cerdas
              </h3>
              {isFixedActive ? (
                <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold text-white">
                  RUTE TETAP AKTIF DI PETA
                </span>
              ) : showFixedComparison ? (
                <span className="rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-[10px] font-bold dark:bg-blue-900/50 dark:text-blue-300">
                  OVERLAY BANDINGKAN: ON
                </span>
              ) : null}
            </div>
            <p className="text-xs text-slate-500 dark:text-[#A3B9B1]">
              Komparasi jarak jalan raya (Mode Mobil), konsumsi solar, dan kapasitas truk (C = {config.C.toLocaleString()} L).
            </p>
          </div>
        </div>

        {/* Action Buttons for Rute Tetap */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {onSelectTripFilter && (
            <button
              onClick={() => onSelectTripFilter(isFixedActive ? 'all' : 'fixed')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-semibold transition cursor-pointer ${
                isFixedActive
                  ? 'bg-slate-800 text-white hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600'
                  : 'border border-[#E2E8E5] bg-[#F8FAF9] text-slate-800 hover:bg-slate-100 dark:bg-[#17262D] dark:border-[#243741] dark:text-white'
              }`}
              title={isFixedActive ? 'Kembali ke rute cerdas' : 'Tampilkan rute tetap di peta'}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>{isFixedActive ? 'Kembali ke Rute Cerdas' : 'Lihat Rute Tetap'}</span>
            </button>
          )}

          {onToggleFixedComparison && (
            <button
              onClick={onToggleFixedComparison}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-semibold transition cursor-pointer ${
                showFixedComparison
                  ? 'bg-[#2563EB] text-white hover:bg-[#1D4ED8]'
                  : 'border border-[#E2E8E5] bg-[#F8FAF9] text-slate-800 hover:bg-slate-100 dark:bg-[#17262D] dark:border-[#243741] dark:text-white'
              }`}
              title="Tampilkan garis rute tetap bersamaan dengan rute cerdas di peta"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>{showFixedComparison ? 'Bandingkan: Aktif' : 'Bandingkan di Peta'}</span>
            </button>
          )}

          {onPlaySpecificTripAnim && (
            <button
              onClick={() => onPlaySpecificTripAnim('fixed')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-1.5 font-semibold text-white transition hover:bg-slate-900 cursor-pointer dark:bg-slate-700 dark:hover:bg-slate-600"
              title="Simulasikan armada melintasi rute tetap dari titik terdekat"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Simulasi Rute Tetap</span>
            </button>
          )}
        </div>
      </div>

      {/* 3-Column Comparative Metrics */}
      <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-[#E2E8E5] bg-white sm:grid-cols-3 dark:border-[#243741] dark:bg-[#17262D]">
        {/* Cell 1: Effective Fixed Route (Nearest-first) */}
        <div
          className={`p-4 transition border-b border-[#E2E8E5] sm:border-b-0 sm:border-r dark:border-[#243741] ${
            isFixedActive ? 'bg-slate-100/90 dark:bg-slate-800/40 ring-2 ring-inset ring-slate-400' : ''
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-600 dark:text-[#A3B9B1]">
              Rute Tetap (Dari Terdekat)
            </span>
            <span className="rounded bg-slate-100 border border-[#E2E8E5] px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 tabular-nums">
              {binCount} TONG
            </span>
          </div>
          <div className="mt-1.5 font-['Bricolage_Grotesque'] text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100 tabular-nums">
            {convKm} km
          </div>
          <div className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400 tabular-nums">
            {convPlan.trips} trip armada · Mengangkut {convPlan.liter.toLocaleString()} L total
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-[#A3B9B1]">
            Kunjungi semua {binCount} tong mulai dari titik terdekat pangkalan; kembali saat truk penuh.
          </p>
        </div>

        {/* Cell 2: Smart Multi-Trip Route */}
        <div
          className={`p-4 transition border-b border-[#E2E8E5] bg-[#F8FAF9] sm:border-b-0 sm:border-r dark:bg-emerald-950/15 dark:border-[#243741] ${
            !isFixedActive ? 'ring-2 ring-inset ring-[#136D42]/25' : ''
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[#136D42] dark:text-emerald-400">
              Rute Cerdas (Held-Karp TSP)
            </span>
            <span className="rounded bg-[#E9F5EE] px-1.5 py-0.5 text-[10px] font-bold text-[#136D42] dark:bg-emerald-900/50 dark:text-emerald-300">
              ADAPTIF
            </span>
          </div>
          <div className="mt-1.5 font-['Bricolage_Grotesque'] text-2xl font-bold tracking-tight text-[#136D42] dark:text-emerald-300 tabular-nums">
            {smartKm} km
          </div>
          <div className="mt-0.5 text-[11px] text-slate-700 dark:text-emerald-400 tabular-nums">
            {result.tripCount} trip armada · {result.redBins.length} tong penuh + {result.acceptedYellowBins.length} hampir penuh searah
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-emerald-400/90">
            {result.tripCount === 0
              ? 'Armada standby (belum ada tong penuh); tidak perlu perjalanan mubazir.'
              : 'Hanya mengunjungi tong prioritas & searah jalan raya, menghindari rute mubazir.'}
          </p>
        </div>

        {/* Cell 3: Savings */}
        <div className="bg-emerald-50/45 p-4 dark:bg-emerald-950/25">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
              Penghematan &amp; Efisiensi
            </span>
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200">
              SOLAR &amp; WAKTU
            </span>
          </div>
          <div className="mt-1.5 font-['Bricolage_Grotesque'] text-2xl font-bold tracking-tight text-[#136D42] dark:text-emerald-400 tabular-nums">
            {savedDist >= 0 ? `Hemat ${pctSaved}%` : `+${Math.abs(parseFloat(savedKm))} km`}
          </div>
          <div className="mt-0.5 text-[11px] text-emerald-800 dark:text-emerald-300 font-medium tabular-nums">
            Hemat solar ~<strong>{Math.max(0, parseFloat(savedFuel))}</strong> Liter · Selisih {Math.abs(parseFloat(savedKm))} km
          </div>
          <p className="mt-1 text-[11px] text-emerald-700/90 dark:text-emerald-400">
            {result.tripCount === 0
              ? `Menghemat seluruh ${convKm} km perjalanan konvensional saat tong belum penuh.`
              : convPlan.trips === result.tripCount
              ? 'Jumlah trip sama dengan jarak tempuh lebih ringkas.'
              : convPlan.trips > result.tripCount
              ? `Berhasil pangkas ${convPlan.trips - result.tripCount} trip bolak-balik pangkalan.`
              : `Rute cerdas membagi menjadi ${result.tripCount} trip agar muatan optimal.`}
          </p>
        </div>
      </div>

      {/* Visual Distance Reduction Progress Bar */}
      <div className="space-y-1.5 rounded-xl border border-[#E2E8E5] bg-[#F8FAF9] p-3 text-xs dark:bg-[#17262D] dark:border-[#243741]">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-[#A3B9B1]">
          <span>Perbandingan Jarak Tempuh Jalan Raya</span>
          <span className="font-mono text-slate-900 dark:text-white tabular-nums">
            {smartKm} km (Cerdas) vs {convKm} km (Tetap dari Terdekat)
          </span>
        </div>
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className="h-full bg-[#136D42] transition-all duration-500 rounded-full"
            style={{
              width: `${Math.min(100, (parseFloat(smartKm) / Math.max(0.1, parseFloat(convKm))) * 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Rute Tetap Breakdown Drawer (Urutan Perhentian & Sub-Trip) */}
      {fixedTrip && (
        <div className="rounded-xl border border-[#E2E8E5] bg-[#F8FAF9] p-3 dark:bg-[#17262D] dark:border-[#243741] transition">
          <button
            onClick={() => setShowSubTripsDetail(prev => !prev)}
            className="flex w-full items-center justify-between text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 text-[#136D42] dark:text-emerald-400" />
              <span>
                Detail Perjalanan Rute Tetap Mulai Terdekat ({fixedTrip.subTripCount || 1} Sub-Trip Pengangkutan)
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-[#A3B9B1]">
              <span>{showSubTripsDetail ? 'Sembunyikan' : 'Buka Rincian'}</span>
              {showSubTripsDetail ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </div>
          </button>

          {showSubTripsDetail && (
            <div className="mt-3 space-y-2 border-t border-[#E2E8E5] pt-2.5 dark:border-[#243741]">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {fixedTrip.subTrips?.map((st, sIdx) => {
                  const firstBin = st.bins[0]?.name || `T${st.bins[0]?.id}`;
                  const lastBin = st.bins[st.bins.length - 1]?.name || `T${st.bins[st.bins.length - 1]?.id}`;
                  const isSubActive = selectedTripFilter === `fixed-${st.subIndex || sIdx + 1}`;

                  return (
                    <div
                      key={sIdx}
                      className={`rounded-xl border p-2.5 text-xs transition ${
                        isSubActive
                          ? 'border-[#136D42] bg-[#E9F5EE]/50 dark:border-emerald-500 dark:bg-slate-800'
                          : 'border-[#E2E8E5] bg-white dark:border-[#243741] dark:bg-[#121D22]'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                        <span>Sub-Trip Tetap #{sIdx + 1}</span>
                        <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                          {st.bins.length} Tong
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-600 dark:text-[#A3B9B1]">
                        Mulai terdekat: <strong>{firstBin}</strong> → <strong>{lastBin}</strong>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                        <span>Muatan: {st.loadLiter} L</span>
                        <span>Jarak: {st.realRoadKm || toRealKm(st.distance)} km</span>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5">
                        {onSelectTripFilter && (
                          <button
                            onClick={() => onSelectTripFilter(`fixed-${sIdx + 1}`)}
                            className="flex-1 rounded-lg border border-[#E2E8E5] bg-[#F8FAF9] py-1 text-[10px] font-bold text-slate-800 hover:bg-slate-100 cursor-pointer dark:bg-[#17262D] dark:border-[#243741] dark:text-white"
                          >
                            Fokus di Peta
                          </button>
                        )}
                        {onOpenGoogleMapsForTrip && (
                          <button
                            onClick={() => onOpenGoogleMapsForTrip(`fixed-${sIdx + 1}`)}
                            className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#2563EB] px-2 py-1 text-[10px] font-bold text-white hover:bg-[#1D4ED8] transition cursor-pointer"
                            title={`Navigasi Google Maps untuk Sub-Trip Tetap #${sIdx + 1}`}
                          >
                            <MapPin className="h-3 w-3" />
                            <span>G-Maps</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Full Tour String */}
              <div className="mt-2 text-[11px] text-slate-600 dark:text-[#A3B9B1]">
                <div className="font-semibold">Urutan Lengkap Rute Tetap (Mulai dari Terdekat):</div>
                <div className="mt-1 rounded-lg border border-[#E2E8E5] bg-white p-2 font-mono text-[11px] text-slate-900 break-all dark:bg-[#121D22] dark:border-[#243741] dark:text-white">
                  {fixedTrip.tour.map(n => n.name || n.id).join(' → ')}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
