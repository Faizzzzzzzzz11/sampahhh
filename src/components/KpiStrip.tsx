import React from 'react';
import { Bin, ExecutionResult, SystemConfig } from '../types';
import { toRealKm, toTravelMinutes, toFuelLiters } from '../services/routingEngine';

interface KpiStripProps {
  bins: Bin[];
  result: ExecutionResult;
  config: SystemConfig;
}

export const KpiStrip: React.FC<KpiStripProps> = ({ bins, result, config }) => {
  const totalKm = result.totalRealRoadKm || toRealKm(result.totalDistance);
  const totalDistNumber = parseFloat(result.totalRealRoadKm || '') || result.totalDistance;
  const totalMin = toTravelMinutes(totalDistNumber, config);
  const totalFuel = toFuelLiters(totalDistNumber, config);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 overflow-hidden rounded-2xl border border-[#E2E8E5] bg-white text-slate-900 divide-y sm:divide-y-0 sm:divide-x divide-[#E2E8E5]">
      <div className="p-4">
        <div className="text-[11px] font-semibold text-slate-500">Total Tong</div>
        <div className="mt-1 font-['Bricolage_Grotesque'] text-2xl font-bold tracking-tight tabular-nums text-slate-900">
          {bins.length}
        </div>
        <div className="mt-0.5 text-[11px] text-slate-500">aktif di peta</div>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          Wajib (&ge;{config.redLimit}%)
        </div>
        <div className="mt-1 font-['Bricolage_Grotesque'] text-2xl font-bold tracking-tight tabular-nums text-red-600">
          {result.redBins.length}
        </div>
        <div className="mt-0.5 text-[11px] text-slate-500">tong penuh</div>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Selektif
        </div>
        <div className="mt-1 font-['Bricolage_Grotesque'] text-2xl font-bold tracking-tight tabular-nums text-amber-600">
          {result.yellowBins.length}
        </div>
        <div className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
          {result.acceptedYellowBins.length} lolos rute
        </div>
      </div>

      <div className="p-4">
        <div className="text-[11px] font-semibold text-slate-500">Total Muatan</div>
        <div className="mt-1 font-['Bricolage_Grotesque'] text-2xl font-bold tracking-tight tabular-nums text-[#136D42]">
          {result.totalLiter.toLocaleString()} <span className="text-xs font-medium text-slate-500">L</span>
        </div>
        <div className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
          kapasitas {config.C.toLocaleString()} L
        </div>
      </div>

      <div className="p-4">
        <div className="text-[11px] font-semibold text-slate-500">Jumlah Trip</div>
        <div className="mt-1 font-['Bricolage_Grotesque'] text-2xl font-bold tracking-tight tabular-nums text-slate-900">
          {result.tripCount}
        </div>
        <div className="mt-0.5 text-[11px] text-slate-500">ritasi armada</div>
      </div>

      <div className="p-4">
        <div className="text-[11px] font-semibold text-slate-500">Jarak Tempuh</div>
        <div className="mt-1 font-['Bricolage_Grotesque'] text-2xl font-bold tracking-tight tabular-nums text-[#2563EB]">
          {totalKm} <span className="text-xs font-medium text-slate-500">km</span>
        </div>
        <div className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
          ≈ {totalMin} mnt · {totalFuel} L
        </div>
      </div>
    </div>
  );
};
