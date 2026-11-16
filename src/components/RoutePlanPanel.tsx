import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Navigation,
  Play,
  AlertCircle,
  ExternalLink,
  Split,
} from 'lucide-react';
import { Depot, ExecutionResult, SystemConfig, Trip } from '../types';
import { toRealKm, toTravelMinutes, litersOf } from '../services/routingEngine';
import {
  buildGoogleMapsUniversalTripUrl,
  getTripStopsWithGmapsLinks,
} from '../services/googleMapsService';
import { DistanceMatrixResult } from '../services/distanceMatrix';

interface RoutePlanPanelProps {
  depot: Depot;
  result: ExecutionResult;
  config: SystemConfig;
  totalBins: number;
  greenBinsCount: number;
  noDataBinsCount: number;
  selectedTripFilter: 'all' | 'fixed' | number | string;
  onSelectTripFilter: (filter: 'all' | 'fixed' | number | string) => void;
  onPlaySpecificTripAnim: (tripIdx: number | string) => void;
  onOpenGoogleMapsForTrip: (tripIdx: number | string) => void;
  onOpenBinModal: (binId: number) => void;
  manualSplitMode: 'auto' | number;
  onSetSplitMode: (mode: 'auto' | number) => void;
  distMatrix?: DistanceMatrixResult | null;
}

const TRIP_DOT_COLORS = ['#2563EB', '#7C3AED', '#0D9488', '#DB2777'];

export const RoutePlanPanel: React.FC<RoutePlanPanelProps> = ({
  depot,
  result,
  config,
  greenBinsCount,
  noDataBinsCount,
  selectedTripFilter,
  onSelectTripFilter,
  onPlaySpecificTripAnim,
  onOpenGoogleMapsForTrip,
  onOpenBinModal,
  manualSplitMode,
  onSetSplitMode,
  distMatrix,
}) => {
  const [expandedDirections, setExpandedDirections] = useState<Record<string, boolean>>({});

  const toggleDirections = (key: string) => {
    setExpandedDirections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const thresholdLiter = Math.round((config.targetInitialPercent / 100) * config.C);
  const hasTrips = result.trips.length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          RENCANA RUTE
        </h4>
        <div className="flex items-center gap-1 rounded-lg border border-[#E2E8E5] bg-[#F8FAF9] p-0.5 text-[10px]">
          <Split className="ml-1 h-3 w-3 text-slate-400" />
          <button
            onClick={() => onSetSplitMode('auto')}
            className={`rounded-md px-1.5 py-0.5 font-semibold transition cursor-pointer ${
              manualSplitMode === 'auto'
                ? 'bg-[#136D42] text-white'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            Auto
          </button>
          {[1, 2, 3].map(m => (
            <button
              key={m}
              onClick={() => onSetSplitMode(m)}
              className={`rounded-md px-1.5 py-0.5 font-semibold transition cursor-pointer tabular-nums ${
                manualSplitMode === m
                  ? 'bg-[#136D42] text-white'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-[#E2E8E5] bg-white p-3.5 space-y-3.5 max-h-[540px]">
        {/* Depot Header & Threshold Summary */}
        <div className="space-y-2 border-b border-[#E2E8E5] pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="font-['Bricolage_Grotesque'] text-sm font-bold text-slate-900 leading-snug">
              {depot.name}
            </div>
            <span
              className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                hasTrips
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {hasTrips ? 'Siap Berangkat' : 'Pratinjau'}
            </span>
          </div>

          <p className="text-xs leading-relaxed text-slate-600">
            {hasTrips
              ? `Rute optimal dihitung untuk ${result.redBins.length} tong penuh dan ${result.acceptedYellowBins.length} tong kuning searah dalam ${result.trips.length} trip armada.`
              : result.statusMessage ||
                `Truk tidak berangkat: total sampah ${result.totalLiter.toLocaleString()} L belum memenuhi ambang keberangkatan (${thresholdLiter.toLocaleString()} L) dan tidak ada tong penuh.`}
          </p>

          <div className="text-[11px] font-medium text-slate-500 tabular-nums">
            Total {result.totalLiter.toLocaleString()} L (ambang {thresholdLiter.toLocaleString()} L) · merah{' '}
            {result.redBins.length} · kuning {result.yellowBins.length} · hijau {greenBinsCount}
            {noDataBinsCount > 0 ? ` · offline ${noDataBinsCount}` : ''}
          </div>

          {!hasTrips && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/90 p-2.5 text-xs text-amber-900">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span>
                Belum memenuhi syarat berangkat. Naikkan keterisian tong atau pilih skenario{' '}
                <strong>Kasus 1–3 Trip</strong> di kanan atas untuk simulasi pengangkutan.
              </span>
            </div>
          )}
        </div>

        {/* Per-Trip Blocks */}
        {hasTrips && (
          <div className="space-y-4">
            {result.trips.map((trip: Trip, idx: number) => {
              const dotColor = TRIP_DOT_COLORS[idx % TRIP_DOT_COLORS.length];
              const tripKm = trip.realRoadKm || toRealKm(trip.distance);
              const tripMin = toTravelMinutes(trip.distance, config);
              const fillPct = Math.round((trip.loadLiter / config.C) * 100);
              const isSelected = selectedTripFilter === trip.tripIndex;
              const dirKey = String(trip.tripIndex);
              const isDirOpen = !!expandedDirections[dirKey];
              const gmapsUrl = buildGoogleMapsUniversalTripUrl(trip, depot);
              const stopLegs = isDirOpen
                ? getTripStopsWithGmapsLinks(trip, depot, distMatrix?.getDist)
                : [];

              return (
                <div
                  key={trip.tripIndex}
                  className={`space-y-2.5 ${
                    idx > 0 ? 'border-t border-[#E2E8E5] pt-3.5' : ''
                  }`}
                >
                  {/* Trip Title Row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 text-xs">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: dotColor }}
                      />
                      <span className="font-bold text-slate-900 truncate tabular-nums">
                        Trip {trip.tripIndex} · {trip.loadLiter.toLocaleString()} L ({fillPct}%) ·{' '}
                        {tripKm} km lewat jalan
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        onSelectTripFilter(isSelected ? 'all' : (trip.tripIndex as number))
                      }
                      className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                        isSelected
                          ? 'border-[#136D42] bg-[#136D42] text-white'
                          : 'border-[#E2E8E5] bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {isSelected ? 'Aktif' : 'Lihat'}
                    </button>
                  </div>

                  {/* Primary Google Maps & Simulasi Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <a
                      href={gmapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#2563EB] px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-[#1D4ED8]"
                      title="Buka navigasi turn-by-turn di Google Maps (Mode Mobil)"
                    >
                      <Navigation className="h-3 w-3 fill-current" />
                      <span>Google Maps</span>
                    </a>

                    <button
                      onClick={() => onOpenGoogleMapsForTrip(trip.tripIndex)}
                      className="inline-flex items-center gap-1 rounded-full border border-[#E2E8E5] bg-[#F8FAF9] px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 cursor-pointer"
                    >
                      <span>Panduan</span>
                    </button>

                    <button
                      onClick={() => onPlaySpecificTripAnim(trip.tripIndex)}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 cursor-pointer"
                      title={`Simulasikan rute Trip ${trip.tripIndex}`}
                    >
                      <Play className="h-3 w-3 fill-current" />
                      <span>≈ {tripMin}m</span>
                    </button>
                  </div>

                  {/* Vertical Stop List */}
                  <div className="space-y-1.5 pt-0.5 text-xs">
                    {/* Origin: Pangkalan */}
                    <div className="flex items-center gap-2.5 text-slate-700">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#136D42] text-[10px] font-bold text-white">
                        P
                      </span>
                      <span className="font-semibold text-slate-800">Pangkalan</span>
                    </div>

                    {/* Bin Stops */}
                    {trip.bins.map((bin, bIdx) => {
                      const liter = litersOf(bin, config);
                      const badgeBg =
                        bin.fill >= config.redLimit
                          ? 'bg-red-600'
                          : bin.fill >= config.yellowLimit
                          ? 'bg-amber-500'
                          : 'bg-emerald-600';

                      return (
                        <button
                          key={bin.id}
                          onClick={() => onOpenBinModal(bin.id)}
                          className="flex w-full items-center gap-2.5 rounded-lg px-0.5 py-0.5 text-left transition hover:bg-slate-50 cursor-pointer"
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white tabular-nums ${badgeBg}`}
                          >
                            {bIdx + 1}
                          </span>
                          <span className="truncate font-medium text-slate-800 tabular-nums">
                            {bin.name} · {bin.fill}% · {liter} L
                          </span>
                        </button>
                      );
                    })}

                    {/* Destination: Kembali ke pangkalan */}
                    <div className="flex items-center gap-2.5 text-slate-700">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#136D42] text-[10px] font-bold text-white">
                        P
                      </span>
                      <span className="font-semibold text-slate-800">Kembali ke pangkalan</span>
                    </div>
                  </div>

                  {/* Expandable Turn-by-Turn Accordion */}
                  <div className="rounded-xl border border-[#E2E8E5] bg-[#FAFBFB] overflow-hidden">
                    <button
                      onClick={() => toggleDirections(dirKey)}
                      className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold text-slate-800 transition hover:bg-slate-100/70 cursor-pointer"
                    >
                      {isDirOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                      )}
                      <span>Petunjuk arah belok demi belok</span>
                    </button>

                    {isDirOpen && (
                      <div className="border-t border-[#E2E8E5] bg-white px-3 py-2 space-y-2">
                        {stopLegs.map((leg, lIdx) => (
                          <div
                            key={`${leg.id}-${lIdx}`}
                            className="flex items-center justify-between gap-2 text-[11px] border-b border-slate-100 last:border-b-0 pb-1.5 last:pb-0"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-800 truncate">
                                {lIdx === 0
                                  ? `Mulai: ${leg.name}`
                                  : `${leg.prevName} → ${leg.name}`}
                              </div>
                              {leg.distanceFromPrevKm !== undefined && lIdx > 0 && (
                                <div className="text-[10px] text-slate-500 tabular-nums">
                                  Jarak leg: {leg.distanceFromPrevKm} km
                                </div>
                              )}
                            </div>
                            {leg.legNavUrl && lIdx > 0 && (
                              <a
                                href={leg.legNavUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100"
                              >
                                <ExternalLink className="h-2.5 w-2.5" />
                                <span>Arah</span>
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
