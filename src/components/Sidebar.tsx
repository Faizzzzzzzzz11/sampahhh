import React from 'react';
import {
  Trash2,
  LayoutGrid,
  Boxes,
  Sliders,
  Warehouse,
  MapPin,
  Inbox,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  RotateCcw,
  X,
} from 'lucide-react';

export type NavSection = 'dasbor' | 'tong' | 'pengaturan' | 'kapasitas' | 'peta' | 'aduan';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  pendingReportCount: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onResetMap: () => void;
}

const MENU_ITEMS: { id: NavSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dasbor', label: 'Dasbor', icon: LayoutGrid },
  { id: 'tong', label: 'Daftar Tong', icon: Boxes },
  { id: 'pengaturan', label: 'Pengaturan TPS', icon: Sliders },
  { id: 'kapasitas', label: 'Kapasitas TPS', icon: Warehouse },
  { id: 'peta', label: 'Peta & Rute', icon: MapPin },
  { id: 'aduan', label: 'Aduan Warga', icon: Inbox },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  pendingReportCount,
  theme,
  onToggleTheme,
  onResetMap,
}) => {
  const handleNavClick = (section: NavSection) => {
    onSelectSection(section);
    onCloseMobile();
  };

  const sidebarContent = (isMobile = false) => {
    const isMini = collapsed && !isMobile;

    return (
      <div className="flex h-full flex-col justify-between bg-gradient-to-b from-[#137043] to-[#0E5734] text-white select-none">
        <div>
          {/* Top Brand Lockup */}
          <div className={`flex items-center gap-3 px-4 pt-5 pb-4 ${isMini ? 'justify-center px-2' : ''}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#137043] shadow-sm">
              <Trash2 className="h-5 w-5" />
            </div>
            {!isMini && (
              <div className="min-w-0 flex-1">
                <div className="font-['Bricolage_Grotesque'] text-[15px] font-bold leading-tight tracking-tight text-white truncate">
                  TrashRoute
                </div>
                <div className="text-[11px] font-medium text-white/75 truncate">
                  Tong Sampah Pintar
                </div>
              </div>
            )}
            {isMobile && (
              <button
                onClick={onCloseMobile}
                className="rounded-lg p-1 text-white/80 hover:bg-white/10 hover:text-white cursor-pointer"
                aria-label="Tutup Menu"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Operator Profile Block */}
          <div className={`mx-3 mb-4 flex items-center gap-3 rounded-xl px-2.5 py-2 ${isMini ? 'justify-center px-0' : ''}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold text-white ring-1 ring-white/20">
              P
            </div>
            {!isMini && (
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">Pengelola TPS</div>
                <div className="text-[11px] text-white/75 truncate">Kapanewon Godean</div>
              </div>
            )}
          </div>

          {/* Menu Section */}
          <div className="px-3">
            {!isMini && (
              <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-white/60">
                MENU
              </div>
            )}
            <nav className="space-y-1">
              {MENU_ITEMS.map(item => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                const showBadge = item.id === 'aduan' && pendingReportCount > 0;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    title={isMini ? item.label : undefined}
                    className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition cursor-pointer ${
                      isMini ? 'justify-center px-2' : ''
                    } ${
                      isActive
                        ? 'bg-white/15 font-semibold text-white ring-1 ring-white/20 shadow-xs'
                        : 'font-medium text-white/85 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!isMini && <span className="truncate flex-1 text-left">{item.label}</span>}
                    {showBadge && (
                      <span
                        className={`rounded-full bg-[#F2C14E] px-1.5 py-0.5 text-[10px] font-bold text-[#10303A] tabular-nums ${
                          isMini ? 'absolute -top-1 -right-1' : ''
                        }`}
                      >
                        {pendingReportCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Utility Actions */}
        <div className="border-t border-white/15 p-3 space-y-1">
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-white/85 transition hover:bg-white/10 hover:text-white cursor-pointer ${
              isMini ? 'justify-center px-2' : ''
            }`}
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 shrink-0 text-[#F2C14E]" />
            ) : (
              <Moon className="h-4 w-4 shrink-0 text-[#F2C14E]" />
            )}
            {!isMini && <span>{theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}</span>}
          </button>

          <button
            onClick={onResetMap}
            title="Reset koordinat peta ke default Kapanewon Godean"
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-white/85 transition hover:bg-white/10 hover:text-white cursor-pointer ${
              isMini ? 'justify-center px-2' : ''
            }`}
          >
            <RotateCcw className="h-4 w-4 shrink-0" />
            {!isMini && <span>Reset Peta</span>}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside
        className={`relative hidden md:block shrink-0 transition-all duration-200 ${
          collapsed ? 'w-[72px]' : 'w-[228px]'
        }`}
      >
        <div className="sticky top-0 h-screen w-full overflow-visible">
          {sidebarContent(false)}

          {/* Floating Circular Yellow Collapse Toggle on Seam */}
          <button
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
            title={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
            className="absolute -right-3.5 top-6 z-50 flex h-7 w-7 items-center justify-center rounded-full bg-[#F2C14E] text-[#10303A] shadow-md ring-2 ring-white transition hover:bg-[#f6cf72] cursor-pointer"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Mobile Slide-Over Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[99998] flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 w-[240px] max-w-[80vw] h-full shadow-2xl">
            {sidebarContent(true)}
          </div>
        </div>
      )}
    </>
  );
};
