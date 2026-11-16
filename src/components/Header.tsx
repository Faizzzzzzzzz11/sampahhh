import React from 'react';
import {
  Play,
  X,
  Menu,
  Sliders,
  Navigation,
  LayoutGrid,
  Boxes,
  Warehouse,
  MapPin,
  Inbox,
} from 'lucide-react';
import { CitizenReport } from '../types';
import { NavSection } from './Sidebar';

interface HeaderProps {
  activeSection: NavSection;
  onOpenMobileMenu: () => void;
  mqttStatus: 'connected' | 'connecting' | 'fallback';
  activeReportAlert: CitizenReport | null;
  onDismissAlert: () => void;
  onFocusReportedBin: (binId: number) => void;
  onOpenConfig: () => void;
  onRunOptimization: () => void;
  selectedScenario: string;
  onSelectScenario: (scenario: string) => void;
  onOpenGoogleMaps?: () => void;
}

const SECTION_META: Record<
  NavSection,
  { title: string; icon: React.ComponentType<{ className?: string }> }
> = {
  dasbor: { title: 'Dasbor', icon: LayoutGrid },
  tong: { title: 'Daftar Tong', icon: Boxes },
  pengaturan: { title: 'Pengaturan TPS', icon: Sliders },
  kapasitas: { title: 'Kapasitas TPS', icon: Warehouse },
  peta: { title: 'Peta & Rute', icon: MapPin },
  aduan: { title: 'Aduan Warga', icon: Inbox },
};

export const Header: React.FC<HeaderProps> = ({
  activeSection,
  onOpenMobileMenu,
  mqttStatus,
  activeReportAlert,
  onDismissAlert,
  onFocusReportedBin,
  onOpenConfig,
  onRunOptimization,
  selectedScenario,
  onSelectScenario,
  onOpenGoogleMaps,
}) => {
  const meta = SECTION_META[activeSection];
  const SectionIcon = meta.icon;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#E2E8E5] bg-white px-4 py-2.5 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Mobile Drawer Trigger + Section Icon Badge + Breadcrumb Metadata */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={onOpenMobileMenu}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E2E8E5] bg-[#F8FAF9] text-slate-700 hover:bg-slate-100 md:hidden cursor-pointer"
              aria-label="Buka Menu"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E9F5EE] text-[#136D42]">
              <SectionIcon className="h-4 w-4" />
            </div>

            <div className="flex items-center gap-2 min-w-0 text-sm">
              <span className="font-['Bricolage_Grotesque'] font-bold text-slate-900 truncate">
                {meta.title}
              </span>
              <span className="hidden sm:inline text-slate-300">·</span>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 truncate">
                <span>Kapanewon Godean, Sleman</span>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    mqttStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                  }`}
                  title={mqttStatus === 'connected' ? 'IoT Sync Aktif' : 'Menghubungkan IoT...'}
                />
              </span>
            </div>
          </div>

          {/* Right: Scenario Select + Concise Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={selectedScenario}
              onChange={e => onSelectScenario(e.target.value)}
              aria-label="Pilih Skenario Pengujian"
              className="max-w-[140px] sm:max-w-[185px] truncate rounded-xl border border-[#E2E8E5] bg-[#F8FAF9] px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-[#136D42] focus:outline-none cursor-pointer"
            >
              <option value="sedikit">Kasus 1 Trip (~535 L)</option>
              <option value="cukup">Kasus 2 Trip (~1.440 L)</option>
              <option value="banyak">Kasus 3 Trip (~2.150 L)</option>
              <option value="kosong">Kasus Kosong (0 Trip)</option>
              <option value="abu">Sensor Error</option>
              <option value="random">Acak Muatan</option>
            </select>

            <button
              onClick={onOpenConfig}
              aria-label="Atur Parameter Sistem"
              title="Atur Parameter Sistem"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-[#E2E8E5] bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Sliders className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden lg:inline">Parameter</span>
            </button>

            {onOpenGoogleMaps && (
              <button
                onClick={onOpenGoogleMaps}
                aria-label="Buka Navigasi Rute di Google Maps"
                title="Buka Navigasi Rute di Google Maps"
                className="hidden md:inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Navigation className="h-3.5 w-3.5 fill-current" />
                <span>G-Maps</span>
              </button>
            )}

            <button
              onClick={onRunOptimization}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#136D42] px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-[#0F5734] cursor-pointer whitespace-nowrap shrink-0"
              title="Hitung ulang rute Held-Karp TSP"
            >
              <Play className="h-3 w-3 fill-current shrink-0" />
              <span>Hitung Rute</span>
            </button>
          </div>
        </div>
      </header>

      {/* Real-time Citizen Report Alert Banner */}
      {activeReportAlert && (
        <div className="sticky top-[53px] z-35 border-b border-amber-300 bg-amber-50 px-4 py-2 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-600 text-xs font-bold text-white">
                !
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-amber-950 truncate">
                  Laporan Masuk: <span className="text-red-700 underline">{activeReportAlert.binName}</span> —{' '}
                  {activeReportAlert.type}
                </div>
                <div className="text-[11px] text-amber-800 truncate">
                  {activeReportAlert.time} · {activeReportAlert.notes}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onFocusReportedBin(activeReportAlert.binId)}
                className="rounded-lg bg-amber-700 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-amber-800 cursor-pointer"
              >
                Fokus Tong
              </button>
              <button
                onClick={onDismissAlert}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 cursor-pointer"
              >
                <X className="h-3 w-3" />
                <span>Tutup</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
