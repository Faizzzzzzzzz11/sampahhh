import React, { useState, useEffect, useMemo, useRef, useCallback, useSyncExternalStore } from 'react';
import { Crosshair, Search, Sliders, Building2, Check } from 'lucide-react';
import { Sidebar, NavSection } from './components/Sidebar';
import { Header } from './components/Header';
import { KpiStrip } from './components/KpiStrip';
import { RouteMap } from './components/RouteMap';
import { RoutePlanPanel } from './components/RoutePlanPanel';
import { TruckTelemetryBar } from './components/TruckTelemetryBar';
import { TripBreakdownCard } from './components/TripBreakdownCard';
import { TpsCapacityCard } from './components/TpsCapacityCard';
import { EfficiencyCard } from './components/EfficiencyCard';
import { BinsQuickGrid } from './components/BinsQuickGrid';
import { IncidentDesk } from './components/IncidentDesk';
import {
  EditBinModal,
  AddBinModal,
  DepotModal,
  ConfigModal,
} from './components/Modals';
import { GoogleMapsNavModal } from './components/GoogleMapsNavModal';
import {
  Bin,
  Depot,
  SystemConfig,
  ExecutionResult,
  CitizenReport,
  AnimWaypoint,
} from './types';
import {
  DEFAULT_CONFIG,
  DEFAULT_DEPOT,
  DEFAULT_BINS_24,
  GODEAN_DEPOT_PRESETS,
} from './data/godeanData';
import {
  runFlowchartLogic,
  conventionalPlan,
  getFixedTrip,
  buildAnimationPath,
  roadGeometryStore,
} from './services/routingEngine';
import {
  isValidCoordinate,
  migrateStorageData,
  CURRENT_SCHEMA_VERSION,
} from './services/coordinateUtils';
import {
  buildDistanceMatrix,
  DistanceMatrixResult,
} from './services/distanceMatrix';
import { RealtimeSyncManager, playAlertChime } from './services/realtimeSync';

const MAP_STORAGE_KEY = 'trashroute_map_v5';
const THEME_STORAGE_KEY = 'trashroute_theme';
const TPS_CONFIG_STORAGE_KEY = 'trashroute_tps_config';
const TPS_COMPLETED_STORAGE_KEY = 'trashroute_tps_completed';

type BinStatusFilter = 'all' | 'red' | 'yellow' | 'green' | 'nodata';
type BinSortOrder = 'fillDesc' | 'fillAsc' | 'idAsc';

export default function App() {
  // -------------------------------------------------------------
  // NAVIGATION & SIDEBAR STATE
  // -------------------------------------------------------------
  const [activeSection, setActiveSection] = useState<NavSection>('peta');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Live clock for "Langsung · HH:MM:SS"
  const [liveTime, setLiveTime] = useState(() =>
    new Date().toLocaleTimeString('id-ID', { hour12: false })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTime(new Date().toLocaleTimeString('id-ID', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // -------------------------------------------------------------
  // THEME MANAGEMENT (LIGHT DEFAULT MATCHING FOREST-GREEN SAAS SHELL)
  // -------------------------------------------------------------
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'light';
  });

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // -------------------------------------------------------------
  // INITIAL MAP DATA WITH SCHEMA MIGRATION & COORDINATE VALIDATION
  // -------------------------------------------------------------
  const initialMapData = useMemo(() => {
    try {
      const saved = localStorage.getItem(MAP_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return migrateStorageData(parsed, DEFAULT_DEPOT, DEFAULT_BINS_24);
      }
    } catch {}
    return {
      depot: DEFAULT_DEPOT,
      bins: DEFAULT_BINS_24,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };
  }, []);

  // -------------------------------------------------------------
  // STATE MANAGEMENT
  // -------------------------------------------------------------
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
  const [depot, setDepot] = useState<Depot>(initialMapData.depot);
  const [bins, setBins] = useState<Bin[]>(initialMapData.bins);

  // Asynchronous OSRM Road Distance Matrix State
  const [distMatrix, setDistMatrix] = useState<DistanceMatrixResult | null>(null);
  const [, setIsCalculatingMatrix] = useState<boolean>(false);

  const [selectedScenario, setSelectedScenario] = useState('sedikit');
  const [selectedTripFilter, setSelectedTripFilter] = useState<'all' | 'fixed' | number | string>('all');
  const [showFixedComparison, setShowFixedComparison] = useState(false);
  const [manualSplitMode, setManualSplitMode] = useState<'auto' | number>('auto');
  const [editMode, setEditMode] = useState(false);
  const [mapPickMode, setMapPickMode] = useState<'bin' | 'depot' | null>(null);
  const [addBinCoords, setAddBinCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Map Card Status Filter + Search + Sort
  const [statusFilter, setStatusFilter] = useState<BinStatusFilter>('all');
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [mapSortOrder, setMapSortOrder] = useState<BinSortOrder>('fillDesc');

  // Reports State
  const [reports, setReports] = useState<CitizenReport[]>([]);
  const [activeReportAlert, setActiveReportAlert] = useState<CitizenReport | null>(null);
  const [mqttStatus, setMqttStatus] = useState<'connected' | 'connecting' | 'fallback'>('connecting');

  // Animation State
  const [animRunning, setAnimRunning] = useState(false);
  const [animSpeed, setAnimSpeed] = useState(2);
  const [animWaypoint, setAnimWaypoint] = useState<AnimWaypoint | null>(null);
  const [currentTruckLoad, setCurrentTruckLoad] = useState(0);
  const [prevTruckLoad, setPrevTruckLoad] = useState(0);

  // TPS (Tempat Pembuangan Sementara) Capacity State
  const [tpsMaxCapacity, setTpsMaxCapacity] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(TPS_CONFIG_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.tpsMaxCapacity) return parsed.tpsMaxCapacity;
      }
    } catch {}
    return 6000;
  });

  const [tpsInitialWaste, setTpsInitialWaste] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(TPS_CONFIG_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.tpsInitialWaste !== undefined) return parsed.tpsInitialWaste;
      }
    } catch {}
    return 0;
  });

  const [completedTripIds, setCompletedTripIds] = useState<(number | string)[]>(() => {
    try {
      const saved = localStorage.getItem(TPS_COMPLETED_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Modals State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingBinId, setEditingBinId] = useState<number | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [depotModalOpen, setDepotModalOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [gmapsModalOpen, setGmapsModalOpen] = useState(false);
  const [gmapsInitialTripIndex, setGmapsInitialTripIndex] = useState<number | string | undefined>(undefined);
  const [settingsSavedNotice, setSettingsSavedNotice] = useState(false);

  const handleOpenGoogleMaps = useCallback((tripIdx?: number | string) => {
    setGmapsInitialTripIndex(tripIdx);
    setGmapsModalOpen(true);
  }, []);

  // Persist TPS State
  useEffect(() => {
    try {
      localStorage.setItem(
        TPS_CONFIG_STORAGE_KEY,
        JSON.stringify({ tpsMaxCapacity, tpsInitialWaste })
      );
    } catch {}
  }, [tpsMaxCapacity, tpsInitialWaste]);

  useEffect(() => {
    try {
      localStorage.setItem(TPS_COMPLETED_STORAGE_KEY, JSON.stringify(completedTripIds));
    } catch {}
  }, [completedTripIds]);

  // Refs for animation loop
  const animFrameRef = useRef<number | null>(null);
  const animIndexRef = useRef(0);
  const animPathRef = useRef<AnimWaypoint[]>([]);
  const syncManagerRef = useRef<RealtimeSyncManager | null>(null);

  // -------------------------------------------------------------
  // ASYNCHRONOUS OSRM DISTANCE MATRIX CALCULATION
  // -------------------------------------------------------------
  useEffect(() => {
    let isCurrent = true;
    setIsCalculatingMatrix(true);

    buildDistanceMatrix([depot, ...bins], config)
      .then(matrix => {
        if (isCurrent) {
          setDistMatrix(matrix);
          setIsCalculatingMatrix(false);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setIsCalculatingMatrix(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [depot, bins, config.truckSpeedKmh]);

  // -------------------------------------------------------------
  // CALCULATIONS (ROUTING & CONVENTIONAL PLAN WITH SAME DISTANCE MATRIX)
  // -------------------------------------------------------------
  const roadGeomVersion = useSyncExternalStore(
    roadGeometryStore.subscribe,
    roadGeometryStore.getSnapshot
  );

  const result: ExecutionResult = useMemo(() => {
    return runFlowchartLogic(bins, depot, config, manualSplitMode, distMatrix);
  }, [bins, depot, config, manualSplitMode, distMatrix, roadGeomVersion]);

  const convPlan = useMemo(() => {
    return conventionalPlan(bins, depot, config, distMatrix);
  }, [bins, depot, config, distMatrix, roadGeomVersion]);

  const fixedTrip = useMemo(() => {
    return getFixedTrip(bins, depot, config, distMatrix);
  }, [bins, depot, config, distMatrix, roadGeomVersion]);

  // Persist Map State
  useEffect(() => {
    try {
      localStorage.setItem(
        MAP_STORAGE_KEY,
        JSON.stringify({
          schemaVersion: CURRENT_SCHEMA_VERSION,
          depot,
          bins,
        })
      );
    } catch {}
  }, [depot, bins]);

  // -------------------------------------------------------------
  // REAL-TIME SYNC & MQTT INITIALIZATION
  // -------------------------------------------------------------
  useEffect(() => {
    syncManagerRef.current = new RealtimeSyncManager(
      report => {
        setReports(prev => {
          if (prev.some(r => r.reportId === report.reportId)) return prev;
          return [report, ...prev];
        });
        setActiveReportAlert(report);
        playAlertChime();

        setBins(prevBins =>
          prevBins.map(b => {
            if (b.id === report.binId) {
              const newFill = report.type.includes('Meluap') ? Math.max(88, b.fill) : b.fill;
              return {
                ...b,
                fill: newFill,
                hasActiveReport: true,
                reportType: report.type,
                reportTime: report.time,
              };
            }
            return b;
          })
        );
      },
      (binId, fillPercent) => {
        setBins(prevBins =>
          prevBins.map(b => (b.id === binId ? { ...b, fill: Math.round(fillPercent) } : b))
        );
      },
      status => setMqttStatus(status)
    );

    return () => {
      syncManagerRef.current?.destroy();
    };
  }, []);

  // -------------------------------------------------------------
  // TRUCK ANIMATION ENGINE
  // -------------------------------------------------------------
  const handleToggleAnimation = useCallback(() => {
    if (animRunning) {
      setAnimRunning(false);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    } else {
      let tripsToAnimate = result.trips;
      if (selectedTripFilter === 'fixed') {
        tripsToAnimate = [fixedTrip];
      } else if (typeof selectedTripFilter === 'string' && selectedTripFilter.startsWith('fixed-')) {
        const subIdx = parseInt(selectedTripFilter.replace('fixed-', ''), 10) - 1;
        if (fixedTrip.subTrips && fixedTrip.subTrips[subIdx]) {
          const st = fixedTrip.subTrips[subIdx];
          tripsToAnimate = [
            {
              tripIndex: `Tetap #${st.subIndex || subIdx + 1}`,
              isFixed: true,
              bins: st.bins,
              loadLiter: st.loadLiter,
              tour: st.tour || [depot, ...st.bins, depot],
              distance: st.distance,
              roadCoords: st.roadCoords,
              realRoadKm: st.realRoadKm,
            },
          ];
        } else {
          tripsToAnimate = [fixedTrip];
        }
      } else if (selectedTripFilter !== 'all') {
        tripsToAnimate = result.trips.filter(t => t.tripIndex === selectedTripFilter);
      }

      if (tripsToAnimate.length === 0) return;

      const path = buildAnimationPath(tripsToAnimate);
      if (path.length === 0) return;

      animPathRef.current = path;
      if (animIndexRef.current >= path.length) {
        animIndexRef.current = 0;
        setCurrentTruckLoad(0);
        setPrevTruckLoad(0);
      }

      setAnimRunning(true);
    }
  }, [animRunning, result.trips, selectedTripFilter, fixedTrip, depot]);

  const pauseTicksRef = useRef<number>(0);

  const handleResetAnimation = useCallback(() => {
    setAnimRunning(false);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animIndexRef.current = 0;
    pauseTicksRef.current = 0;
    setAnimWaypoint(null);
    setCurrentTruckLoad(0);
    setPrevTruckLoad(0);
  }, []);

  useEffect(() => {
    if (!animRunning) return;

    let lastTime = 0;
    const step = (timestamp: number) => {
      const interval = 80 / animSpeed;
      if (timestamp - lastTime >= interval) {
        lastTime = timestamp;

        if (pauseTicksRef.current > 0) {
          pauseTicksRef.current--;
          animFrameRef.current = requestAnimationFrame(step);
          return;
        }

        if (animIndexRef.current < animPathRef.current.length) {
          const pt = animPathRef.current[animIndexRef.current];
          setAnimWaypoint(pt);

          if (pt.isStop && pt.stopBin) {
            pauseTicksRef.current = Math.max(6, Math.round(12 / animSpeed));

            if (pt.stopBin.id === 'P') {
              if (pt.tripIndex !== undefined) {
                setCompletedTripIds(prev => {
                  if (prev.includes(pt.tripIndex)) return prev;
                  return [...prev, pt.tripIndex];
                });
              }
              setPrevTruckLoad(currentTruckLoad);
              setCurrentTruckLoad(0);
            } else {
              const binLiter = Math.round((('fill' in pt.stopBin ? pt.stopBin.fill || 0 : 0) * config.binCap) / 100);
              setCurrentTruckLoad(prev => {
                setPrevTruckLoad(prev);
                return Math.min(config.C, prev + binLiter);
              });
            }
          }

          animIndexRef.current++;
          animFrameRef.current = requestAnimationFrame(step);
        } else {
          setAnimRunning(false);
          animIndexRef.current = 0;
          pauseTicksRef.current = 0;
        }
      } else {
        animFrameRef.current = requestAnimationFrame(step);
      }
    };

    animFrameRef.current = requestAnimationFrame(step);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [animRunning, animSpeed, config.binCap, config.C, currentTruckLoad]);

  const handlePlaySpecificTripAnim = (tripIdx: number | string) => {
    setSelectedTripFilter(tripIdx);
    handleResetAnimation();
    setTimeout(() => {
      let tripsToAnimate = result.trips.filter(t => t.tripIndex === tripIdx);
      if (tripIdx === 'fixed') {
        tripsToAnimate = [fixedTrip];
      } else if (typeof tripIdx === 'string' && tripIdx.startsWith('fixed-')) {
        const subIdx = parseInt(tripIdx.replace('fixed-', ''), 10) - 1;
        if (fixedTrip.subTrips && fixedTrip.subTrips[subIdx]) {
          const st = fixedTrip.subTrips[subIdx];
          tripsToAnimate = [
            {
              tripIndex: `Tetap #${st.subIndex || subIdx + 1}`,
              isFixed: true,
              bins: st.bins,
              loadLiter: st.loadLiter,
              tour: st.tour || [depot, ...st.bins, depot],
              distance: st.distance,
              roadCoords: st.roadCoords,
              realRoadKm: st.realRoadKm,
            },
          ];
        } else {
          tripsToAnimate = [fixedTrip];
        }
      }
      const path = buildAnimationPath(tripsToAnimate);
      animPathRef.current = path;
      animIndexRef.current = 0;
      setAnimRunning(true);
    }, 100);
  };

  // -------------------------------------------------------------
  // PRESET SCENARIOS
  // -------------------------------------------------------------
  const handleSelectScenario = (scenario: string) => {
    setSelectedScenario(scenario);
    handleResetAnimation();
    setCompletedTripIds([]);

    setBins(prev => {
      const updated = prev.map(b => ({ ...b, noData: false }));

      if (scenario === 'kosong') {
        updated.forEach((b, idx) => {
          b.fill = idx % 2 === 0 ? 30 : 60;
        });
      } else if (scenario === 'sedikit') {
        updated.forEach(b => {
          if ([1, 4, 15, 21].includes(b.id)) {
            b.fill = 85;
          } else if ([2, 14, 22].includes(b.id)) {
            b.fill = 65;
          } else {
            b.fill = 20;
          }
        });
      } else if (scenario === 'cukup') {
        updated.forEach(b => {
          if ([1, 3, 4, 6, 8, 9, 10, 12, 13, 15, 17, 19, 21, 24].includes(b.id)) {
            b.fill = 88;
          } else if ([2, 7, 14, 18, 22].includes(b.id)) {
            b.fill = 68;
          } else {
            b.fill = 25;
          }
        });
      } else if (scenario === 'banyak') {
        const fills = [90, 88, 92, 85, 91, 89, 93, 87, 90, 86, 94, 88, 89, 91, 87, 92, 85, 90, 88, 93, 89, 91, 86, 92];
        updated.forEach((b, idx) => {
          b.fill = fills[idx % fills.length];
        });
      } else if (scenario === 'abu') {
        updated.forEach(b => {
          if ([4, 12, 20].includes(b.id)) b.noData = true;
          else if ([1, 8, 15].includes(b.id)) b.fill = 85;
          else b.fill = 40;
        });
      } else if (scenario === 'random') {
        updated.forEach(b => {
          b.fill = Math.floor(10 + Math.random() * 88);
        });
      }
      return updated;
    });
  };

  // -------------------------------------------------------------
  // BIN & DEPOT ACTIONS
  // -------------------------------------------------------------
  const handleOpenBinModal = (binId: number) => {
    setEditingBinId(binId);
    setEditModalOpen(true);
  };

  const handleSaveBinModal = (
    binId: number,
    fill: number,
    noData: boolean,
    name?: string,
    location?: string
  ) => {
    setBins(prev =>
      prev.map(b =>
        b.id === binId
          ? {
              ...b,
              fill,
              noData,
              name: name !== undefined && name.trim() !== '' ? name.trim() : b.name,
              location: location !== undefined ? location.trim() : b.location,
            }
          : b
      )
    );
    setEditModalOpen(false);
  };

  const handleDeleteBin = (binId: number) => {
    if (bins.length <= 1) return;
    setBins(prev => prev.filter(item => item.id !== binId));
    setEditModalOpen(false);
  };

  const handleQuickFillChange = (binId: number, fill: number) => {
    setBins(prev => prev.map(b => (b.id === binId ? { ...b, fill, noData: false } : b)));
  };

  const handleUpdateBinPosition = (binId: number, lat: number, lng: number) => {
    if (!isValidCoordinate(lat, lng)) return;
    setBins(prev =>
      prev.map(b =>
        b.id === binId
          ? {
              ...b,
              lat: Math.round(lat * 100000) / 100000,
              lng: Math.round(lng * 100000) / 100000,
            }
          : b
      )
    );
  };

  const handleUpdateDepotPosition = (lat: number, lng: number) => {
    if (!isValidCoordinate(lat, lng)) return;
    setDepot(prev => ({
      ...prev,
      lat: Math.round(lat * 100000) / 100000,
      lng: Math.round(lng * 100000) / 100000,
    }));
  };

  const handleAddBin = (name: string, location: string, lat: number, lng: number, fill: number) => {
    if (!isValidCoordinate(lat, lng)) return;
    const nextId = bins.reduce((max, b) => Math.max(max, b.id), 0) + 1;
    const newBin: Bin = {
      id: nextId,
      name,
      location,
      lat: Math.round(lat * 100000) / 100000,
      lng: Math.round(lng * 100000) / 100000,
      fill,
      noData: false,
    };
    setBins(prev => [...prev, newBin]);
  };

  const handleStartPickBinOnMap = () => {
    setAddModalOpen(false);
    setActiveSection('peta');
    setMapPickMode('bin');
  };

  const handleMapClickCoord = (lat: number, lng: number) => {
    if (mapPickMode === 'depot') {
      handleUpdateDepotPosition(lat, lng);
      setMapPickMode(null);
      return;
    }
    const roundedLat = Math.round(lat * 100000) / 100000;
    const roundedLng = Math.round(lng * 100000) / 100000;
    setAddBinCoords({ lat: roundedLat, lng: roundedLng });
    setMapPickMode(null);
    setAddModalOpen(true);
  };

  const handleSaveDepotModal = (name: string, location: string, lat: number, lng: number) => {
    if (!isValidCoordinate(lat, lng)) return;
    setDepot(prev => ({
      ...prev,
      name,
      location,
      lat: Math.round(lat * 100000) / 100000,
      lng: Math.round(lng * 100000) / 100000,
    }));
  };

  const handleResetMap = () => {
    try {
      localStorage.removeItem(MAP_STORAGE_KEY);
    } catch {}
    setDepot(DEFAULT_DEPOT);
    setBins(DEFAULT_BINS_24);
    handleSelectScenario('sedikit');
  };

  // -------------------------------------------------------------
  // CITIZEN REPORTS
  // -------------------------------------------------------------
  const handleTriggerDemoReport = () => {
    const randomBin = bins[Math.floor(Math.random() * bins.length)];
    const types = [
      'Sampah Meluap (Penuh Sesak)',
      'Tutup Tong Rusak/Pecah',
      'Bau Menyengat & Lalat',
    ];
    const chosenType = types[Math.floor(Math.random() * types.length)];

    const newReport: CitizenReport = {
      reportId: 'REP-' + Math.floor(1000 + Math.random() * 9000),
      binId: randomBin.id,
      binName: randomBin.name,
      type: chosenType,
      time: new Date().toLocaleTimeString('id-ID'),
      notes: 'Laporan warga masuk via Portal Pelaporan Real-Time IoT.',
      status: 'pending',
      timestamp: Date.now(),
    };

    syncManagerRef.current?.publishReport(newReport);
  };

  const handleUserCitizenReport = (binId: number, type: string, notes: string) => {
    const targetBin = bins.find(b => b.id === binId);
    const newReport: CitizenReport = {
      reportId: 'REP-' + Math.floor(1000 + Math.random() * 9000),
      binId,
      binName: targetBin ? targetBin.name : `Tong ${binId}`,
      type,
      time: new Date().toLocaleTimeString('id-ID'),
      notes,
      status: 'pending',
      timestamp: Date.now(),
    };

    syncManagerRef.current?.publishReport(newReport);
  };

  const handleResolveReport = (reportId: string, binId: number) => {
    const targetBin = bins.find(b => b.id === binId);
    setReports(prev =>
      prev.map(r => (r.reportId === reportId ? { ...r, status: 'resolved' as const } : r))
    );

    if (activeReportAlert?.reportId === reportId) {
      setActiveReportAlert(null);
    }

    if (targetBin) {
      setBins(prev =>
        prev.map(b => (b.id === binId ? { ...b, hasActiveReport: false, fill: 15 } : b))
      );
      syncManagerRef.current?.resolveReport(reportId, binId, targetBin.name);
    }
  };

  const handleClearResolvedReports = () => {
    setReports(prev => prev.filter(r => r.status === 'pending'));
  };

  const handleFocusBin = (binId: number) => {
    handleOpenBinModal(binId);
  };

  const handleRefreshRoadGeometries = useCallback(async () => {
    if (selectedTripFilter === 'fixed' || (typeof selectedTripFilter === 'string' && selectedTripFilter.startsWith('fixed-'))) {
      const fixedTours: (Bin | Depot)[][] = [fixedTrip.tour];
      if (fixedTrip.subTrips) {
        fixedTrip.subTrips.forEach(st => {
          if (st.tour && st.tour.length >= 2) fixedTours.push(st.tour);
        });
      }
      await roadGeometryStore.refreshTourGeometries(fixedTours);
      return;
    }

    let tripsToRefresh = result.trips;
    if (selectedTripFilter !== 'all') {
      tripsToRefresh = result.trips.filter(t => t.tripIndex === selectedTripFilter);
    }

    const tours = tripsToRefresh.map(t => t.tour).filter(tour => tour && tour.length >= 2);
    if (tours.length > 0) {
      await roadGeometryStore.refreshTourGeometries(tours);
    }
  }, [result.trips, selectedTripFilter, fixedTrip]);

  // TPS Capacity Action Handlers
  const handleToggleTripCompleted = useCallback((tripIndex: number | string) => {
    setCompletedTripIds(prev =>
      prev.includes(tripIndex) ? prev.filter(id => id !== tripIndex) : [...prev, tripIndex]
    );
  }, []);

  const handleCompleteAllTrips = useCallback(() => {
    setCompletedTripIds(result.trips.map(t => t.tripIndex));
  }, [result.trips]);

  const handleResetTps = useCallback(() => {
    setCompletedTripIds([]);
    setTpsInitialWaste(0);
  }, []);

  const handleChangeTpsMaxCapacity = useCallback((capacity: number) => {
    setTpsMaxCapacity(capacity);
  }, []);

  const handleChangeTpsInitialWaste = useCallback((waste: number) => {
    setTpsInitialWaste(waste);
  }, []);

  // Derived Bin Status Counts & Filtering for Peta & Rute Card
  const binCounts = useMemo(() => {
    let red = 0;
    let yellow = 0;
    let green = 0;
    let noData = 0;

    bins.forEach(b => {
      if (b.noData) noData++;
      else if (b.fill >= config.redLimit) red++;
      else if (b.fill >= config.yellowLimit) yellow++;
      else green++;
    });

    return { red, yellow, green, noData };
  }, [bins, config.redLimit, config.yellowLimit]);

  const matchingBins = useMemo(() => {
    const q = mapSearchQuery.trim().toLowerCase();
    const filtered = bins.filter(b => {
      if (statusFilter === 'red' && (b.noData || b.fill < config.redLimit)) return false;
      if (statusFilter === 'yellow' && (b.noData || b.fill < config.yellowLimit || b.fill >= config.redLimit)) return false;
      if (statusFilter === 'green' && (b.noData || b.fill >= config.yellowLimit)) return false;
      if (statusFilter === 'nodata' && !b.noData) return false;

      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        (b.location || '').toLowerCase().includes(q) ||
        String(b.id).includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      if (mapSortOrder === 'fillDesc') return (b.noData ? -1 : b.fill) - (a.noData ? -1 : a.fill);
      if (mapSortOrder === 'fillAsc') return (a.noData ? 999 : a.fill) - (b.noData ? 999 : b.fill);
      return a.id - b.id;
    });
  }, [bins, statusFilter, mapSearchQuery, mapSortOrder, config.redLimit, config.yellowLimit]);

  const highlightedBinIds = useMemo(() => {
    if (statusFilter === 'all' && mapSearchQuery.trim() === '') return null;
    return new Set(matchingBins.map(b => b.id));
  }, [statusFilter, mapSearchQuery, matchingBins]);

  const pendingReportCount = reports.filter(r => r.status === 'pending').length;
  const editingBin = bins.find(b => b.id === editingBinId) || null;

  return (
    <div className="flex min-h-screen bg-[#F5F7F6] text-slate-900 font-['Public_Sans'] dark:bg-[#0B1317] dark:text-[#F3F7F5]">
      {/* Left Collapsible Forest-Green Sidebar */}
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        pendingReportCount={pendingReportCount}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onResetMap={handleResetMap}
      />

      {/* Right Content Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          activeSection={activeSection}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          mqttStatus={mqttStatus}
          activeReportAlert={activeReportAlert}
          onDismissAlert={() => setActiveReportAlert(null)}
          onFocusReportedBin={handleFocusBin}
          onOpenConfig={() => setConfigModalOpen(true)}
          onRunOptimization={() => handleRefreshRoadGeometries()}
          selectedScenario={selectedScenario}
          onSelectScenario={handleSelectScenario}
          onOpenGoogleMaps={() => handleOpenGoogleMaps()}
        />

        <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-5 px-4 py-5 sm:px-6 lg:px-8">
          {/* ========================================================== */}
          {/* VIEW 1: PETA & RUTE (DEFAULT MATCHING SCREENSHOT) */}
          {/* ========================================================== */}
          {activeSection === 'peta' && (
            <div className="space-y-4">
              {/* Page Title & Depot Subtitle */}
              <div>
                <h1 className="font-['Bricolage_Grotesque'] text-2xl font-bold tracking-tight text-slate-900">
                  Peta &amp; Rute Pengangkutan
                </h1>
                <p className="mt-0.5 text-sm font-medium text-slate-600">
                  {depot.name}
                </p>
              </div>

              {/* Unified Main Card: Peta lokasi & rute */}
              <section className="rounded-2xl border border-[#E2E8E5] bg-white p-4 sm:p-5 space-y-3.5">
                {/* Card Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-['Bricolage_Grotesque'] text-base font-bold text-slate-900">
                    Peta lokasi &amp; rute
                  </h2>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 tabular-nums">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        mqttStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                      }`}
                    />
                    <span>Langsung · {liveTime}</span>
                  </div>
                </div>

                {/* Interactive Status Filter Chips Row */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button
                    onClick={() => setStatusFilter(prev => (prev === 'red' ? 'all' : 'red'))}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition cursor-pointer tabular-nums ${
                      statusFilter === 'red'
                        ? 'border-red-300 bg-red-50 text-red-800 font-semibold'
                        : 'border-[#E2E8E5] bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    <span>Penuh {binCounts.red}</span>
                  </button>

                  <button
                    onClick={() => setStatusFilter(prev => (prev === 'yellow' ? 'all' : 'yellow'))}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition cursor-pointer tabular-nums ${
                      statusFilter === 'yellow'
                        ? 'border-amber-300 bg-amber-50 text-amber-800 font-semibold'
                        : 'border-[#E2E8E5] bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    <span>Hampir penuh {binCounts.yellow}</span>
                  </button>

                  <button
                    onClick={() => setStatusFilter(prev => (prev === 'green' ? 'all' : 'green'))}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition cursor-pointer tabular-nums ${
                      statusFilter === 'green'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold'
                        : 'border-[#E2E8E5] bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>Aman {binCounts.green}</span>
                  </button>

                  <button
                    onClick={() => setStatusFilter(prev => (prev === 'nodata' ? 'all' : 'nodata'))}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition cursor-pointer tabular-nums ${
                      statusFilter === 'nodata'
                        ? 'border-slate-400 bg-slate-100 text-slate-900 font-semibold'
                        : 'border-[#E2E8E5] bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    <span>Tak ada kabar {binCounts.noData}</span>
                  </button>

                  <button
                    onClick={() => setSelectedTripFilter('all')}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#E2E8E5] bg-white px-3 py-1 font-medium text-slate-700 transition hover:bg-slate-50 cursor-pointer tabular-nums"
                  >
                    <span className="h-2 w-2 rounded-full bg-violet-500" />
                    <span>Rute {result.tripCount}</span>
                  </button>

                  <button
                    onClick={handleToggleAnimation}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition cursor-pointer tabular-nums ${
                      animRunning
                        ? 'border-blue-300 bg-blue-50 text-blue-800 font-semibold'
                        : 'border-[#E2E8E5] bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                    <span>Truk {animRunning ? 1 : result.tripCount > 0 ? 1 : 0}</span>
                  </button>
                </div>

                {/* Search + Sort Toolbar Row */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={mapSearchQuery}
                      onChange={e => setMapSearchQuery(e.target.value)}
                      placeholder="Cari ID, lokasi, atau keterangan tong..."
                      className="w-full rounded-xl border border-[#E2E8E5] bg-white py-2 pr-3 pl-9 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#136D42] focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <select
                      value={mapSortOrder}
                      onChange={e => setMapSortOrder(e.target.value as BinSortOrder)}
                      aria-label="Urutkan Tong"
                      className="rounded-xl border border-[#E2E8E5] bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-[#136D42] focus:outline-none cursor-pointer"
                    >
                      <option value="fillDesc">Terisi tertinggi</option>
                      <option value="fillAsc">Terisi terendah</option>
                      <option value="idAsc">Nomor tong</option>
                    </select>
                    <span className="text-xs font-medium text-slate-500 tabular-nums whitespace-nowrap">
                      {matchingBins.length} tong
                    </span>
                  </div>
                </div>

                {/* Quick Search Result Pills (only shown when searching or status filtering) */}
                {(statusFilter !== 'all' || mapSearchQuery.trim() !== '') && (
                  <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#E2E8E5] bg-[#F8FAF9] px-3 py-2 text-xs">
                    <span className="text-[11px] font-semibold text-slate-500 mr-1">
                      Hasil ({matchingBins.length}):
                    </span>
                    {matchingBins.slice(0, 8).map(b => (
                      <button
                        key={b.id}
                        onClick={() => handleOpenBinModal(b.id)}
                        className="rounded-lg border border-[#E2E8E5] bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:border-[#136D42] cursor-pointer tabular-nums"
                      >
                        {b.name} ({b.noData ? '?' : `${b.fill}%`})
                      </button>
                    ))}
                    {matchingBins.length > 8 && (
                      <span className="text-[11px] text-slate-500">
                        +{matchingBins.length - 8} lainnya
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setStatusFilter('all');
                        setMapSearchQuery('');
                      }}
                      className="ml-auto text-[11px] font-semibold text-[#136D42] hover:underline cursor-pointer"
                    >
                      Reset Filter
                    </button>
                  </div>
                )}

                {/* Main Split Viewport: Map (Left 8 cols) + RENCANA RUTE (Right 4 cols) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch pt-1">
                  <div className="lg:col-span-8">
                    <RouteMap
                      embedded
                      highlightedBinIds={highlightedBinIds}
                      bins={bins}
                      depot={depot}
                      config={config}
                      result={result}
                      selectedTripFilter={selectedTripFilter}
                      onSelectTripFilter={setSelectedTripFilter}
                      onEditBin={handleOpenBinModal}
                      onDeleteBin={handleDeleteBin}
                      onQuickFillChange={handleQuickFillChange}
                      onTriggerReport={binId => {
                        const target = bins.find(b => b.id === binId);
                        if (target) {
                          handleUserCitizenReport(
                            binId,
                            'Sampah Meluap (Penuh Sesak)',
                            'Aduan darurat dikirim via marker peta.'
                          );
                        }
                      }}
                      onUpdateBinPosition={handleUpdateBinPosition}
                      onUpdateDepotPosition={handleUpdateDepotPosition}
                      editMode={editMode}
                      onToggleEditMode={() => setEditMode(!editMode)}
                      onOpenAddBin={() => {
                        setAddBinCoords(null);
                        setAddModalOpen(true);
                      }}
                      onStartPickBinOnMap={handleStartPickBinOnMap}
                      onOpenDepotModal={() => setDepotModalOpen(true)}
                      onResetMap={handleResetMap}
                      animRunning={animRunning}
                      animSpeed={animSpeed}
                      onToggleAnimation={handleToggleAnimation}
                      onResetAnimation={handleResetAnimation}
                      onChangeAnimSpeed={setAnimSpeed}
                      currentTruckWaypoint={animWaypoint}
                      currentTruckLoad={currentTruckLoad}
                      mapPickMode={mapPickMode}
                      onMapClickCoord={handleMapClickCoord}
                      onRefreshRoadGeometries={handleRefreshRoadGeometries}
                      theme={theme}
                      fixedTrip={fixedTrip}
                      showFixedComparison={showFixedComparison}
                      onToggleFixedComparison={() => setShowFixedComparison(prev => !prev)}
                      onOpenGoogleMapsModal={() =>
                        handleOpenGoogleMaps(selectedTripFilter !== 'all' ? selectedTripFilter : undefined)
                      }
                    />
                  </div>

                  <div className="lg:col-span-4">
                    <RoutePlanPanel
                      depot={depot}
                      result={result}
                      config={config}
                      totalBins={bins.length}
                      greenBinsCount={binCounts.green}
                      noDataBinsCount={binCounts.noData}
                      selectedTripFilter={selectedTripFilter}
                      onSelectTripFilter={setSelectedTripFilter}
                      onPlaySpecificTripAnim={handlePlaySpecificTripAnim}
                      onOpenGoogleMapsForTrip={handleOpenGoogleMaps}
                      onOpenBinModal={handleOpenBinModal}
                      manualSplitMode={manualSplitMode}
                      onSetSplitMode={setManualSplitMode}
                      distMatrix={distMatrix}
                    />
                  </div>
                </div>
              </section>

              {animRunning && (
                <TruckTelemetryBar
                  waypoint={animWaypoint}
                  load={currentTruckLoad}
                  prevLoad={prevTruckLoad}
                  config={config}
                  speed={animSpeed}
                  onChangeSpeed={setAnimSpeed}
                />
              )}
            </div>
          )}

          {/* ========================================================== */}
          {/* VIEW 2: DASBOR (KPI + EFISIENSI + RINCIAN TRIP) */}
          {/* ========================================================== */}
          {activeSection === 'dasbor' && (
            <div className="space-y-5">
              <div>
                <h1 className="font-['Bricolage_Grotesque'] text-2xl font-bold tracking-tight text-slate-900">
                  Ringkasan Dasbor Operasional
                </h1>
                <p className="mt-0.5 text-sm font-medium text-slate-600">
                  {depot.name} · Evaluasi Rute Held-Karp Multi-Trip
                </p>
              </div>

              <KpiStrip bins={bins} result={result} config={config} />

              <EfficiencyCard
                result={result}
                config={config}
                convPlan={convPlan}
                binCount={bins.length}
                fixedTrip={fixedTrip}
                selectedTripFilter={selectedTripFilter}
                onSelectTripFilter={filter => {
                  setSelectedTripFilter(filter);
                  setActiveSection('peta');
                }}
                onPlaySpecificTripAnim={tripIdx => {
                  setActiveSection('peta');
                  handlePlaySpecificTripAnim(tripIdx);
                }}
                showFixedComparison={showFixedComparison}
                onToggleFixedComparison={() => setShowFixedComparison(prev => !prev)}
                onOpenGoogleMapsForTrip={handleOpenGoogleMaps}
              />

              <TripBreakdownCard
                result={result}
                config={config}
                manualSplitMode={manualSplitMode}
                onSetSplitMode={setManualSplitMode}
                selectedTripFilter={selectedTripFilter}
                onSelectTripFilter={filter => {
                  setSelectedTripFilter(filter);
                  setActiveSection('peta');
                }}
                onPlaySpecificTripAnim={tripIdx => {
                  setActiveSection('peta');
                  handlePlaySpecificTripAnim(tripIdx);
                }}
                fixedTrip={fixedTrip}
                depot={depot}
                onOpenGoogleMapsForTrip={handleOpenGoogleMaps}
              />
            </div>
          )}

          {/* ========================================================== */}
          {/* VIEW 3: DAFTAR TONG */}
          {/* ========================================================== */}
          {activeSection === 'tong' && (
            <div className="space-y-4">
              <div>
                <h1 className="font-['Bricolage_Grotesque'] text-2xl font-bold tracking-tight text-slate-900">
                  Daftar &amp; Status Tong Sampah
                </h1>
                <p className="mt-0.5 text-sm font-medium text-slate-600">
                  Pantau tingkat keterisian sensor IoT HC-SR04 seluruh titik
                </p>
              </div>

              <BinsQuickGrid
                expanded
                bins={bins}
                config={config}
                onOpenBinModal={handleOpenBinModal}
                onOpenAddBin={() => {
                  setAddBinCoords(null);
                  setAddModalOpen(true);
                }}
              />
            </div>
          )}

          {/* ========================================================== */}
          {/* VIEW 4: PENGATURAN TPS & PARAMETER ALGORITMA */}
          {/* ========================================================== */}
          {activeSection === 'pengaturan' && (
            <div className="space-y-5">
              <div>
                <h1 className="font-['Bricolage_Grotesque'] text-2xl font-bold tracking-tight text-slate-900">
                  Pengaturan TPS &amp; Parameter Algoritma
                </h1>
                <p className="mt-0.5 text-sm font-medium text-slate-600">
                  Konfigurasi lokasi pangkalan armada dan ambang batas optimasi rute
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Card 1: Pangkalan / TPS 3R */}
                <div className="rounded-2xl border border-[#E2E8E5] bg-white p-5 space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-[#E2E8E5] pb-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E9F5EE] text-[#136D42]">
                      <Building2 className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h3 className="font-['Bricolage_Grotesque'] text-base font-bold text-slate-900">
                        Pangkalan Armada &amp; TPS 3R
                      </h3>
                      <p className="text-xs text-slate-500">Titik awal dan akhir seluruh perjalanan truk</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#E2E8E5] bg-[#F8FAF9] p-3.5 text-xs space-y-1">
                    <div className="font-bold text-slate-900">{depot.name}</div>
                    <div className="text-slate-600">{depot.location}</div>
                    <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                      GPS: {depot.lat.toFixed(5)}, {depot.lng.toFixed(5)}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Pilih Cepat Preset Lokasi Kapanewon Godean:
                    </label>
                    <select
                      onChange={e => {
                        const p = GODEAN_DEPOT_PRESETS[e.target.value];
                        if (p) {
                          handleSaveDepotModal(p.name, p.location, p.lat, p.lng);
                          setSettingsSavedNotice(true);
                          setTimeout(() => setSettingsSavedNotice(false), 2000);
                        }
                      }}
                      className="w-full rounded-xl border border-[#E2E8E5] bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-[#136D42] focus:outline-none cursor-pointer"
                      defaultValue=""
                    >
                      <option value="">-- Ganti Pangkalan Strategis --</option>
                      {Object.entries(GODEAN_DEPOT_PRESETS).map(([key, p]) => (
                        <option key={key} value={key}>
                          {p.name} ({p.location})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => setDepotModalOpen(true)}
                      className="rounded-xl bg-[#136D42] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0F5734] cursor-pointer"
                    >
                      Ubah Detail Pangkalan
                    </button>
                    <button
                      onClick={() => {
                        setActiveSection('peta');
                        setMapPickMode('depot');
                      }}
                      className="rounded-xl border border-[#E2E8E5] bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
                    >
                      Pilih Titik di Peta
                    </button>
                  </div>
                </div>

                {/* Card 2: Parameter Algoritma */}
                <div className="rounded-2xl border border-[#E2E8E5] bg-white p-5 space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-[#E2E8E5] pb-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
                      <Sliders className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h3 className="font-['Bricolage_Grotesque'] text-base font-bold text-slate-900">
                        Parameter Algoritma &amp; Armada
                      </h3>
                      <p className="text-xs text-slate-500">Kapasitas truk, ambang batas tong, dan detour</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl border border-[#E2E8E5] bg-[#F8FAF9] p-3">
                      <div className="text-slate-500">Kapasitas Truk (C)</div>
                      <div className="mt-1 font-['Bricolage_Grotesque'] text-lg font-bold text-slate-900 tabular-nums">
                        {config.C.toLocaleString()} L
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#E2E8E5] bg-[#F8FAF9] p-3">
                      <div className="text-slate-500">Kapasitas Per Tong</div>
                      <div className="mt-1 font-['Bricolage_Grotesque'] text-lg font-bold text-slate-900 tabular-nums">
                        {config.binCap} L
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#E2E8E5] bg-[#F8FAF9] p-3">
                      <div className="text-slate-500">Ambang Merah / Kuning</div>
                      <div className="mt-1 font-['Bricolage_Grotesque'] text-lg font-bold text-slate-900 tabular-nums">
                        {config.redLimit}% / {config.yellowLimit}%
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#E2E8E5] bg-[#F8FAF9] p-3">
                      <div className="text-slate-500">Ambang Berangkat</div>
                      <div className="mt-1 font-['Bricolage_Grotesque'] text-lg font-bold text-slate-900 tabular-nums">
                        {config.targetInitialPercent}% ({Math.round((config.targetInitialPercent / 100) * config.C)} L)
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => setConfigModalOpen(true)}
                      className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#1D4ED8] cursor-pointer"
                    >
                      Ubah Parameter Algoritma
                    </button>

                    {settingsSavedNotice && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <Check className="h-3.5 w-3.5" />
                        <span>Lokasi diterapkan</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* VIEW 5: KAPASITAS TPS */}
          {/* ========================================================== */}
          {activeSection === 'kapasitas' && (
            <div className="space-y-4">
              <div>
                <h1 className="font-['Bricolage_Grotesque'] text-2xl font-bold tracking-tight text-slate-900">
                  Kapasitas Penampungan TPS 3R
                </h1>
                <p className="mt-0.5 text-sm font-medium text-slate-600">
                  Pemantauan volume residu dan alokasi transfer ke TPA
                </p>
              </div>

              <TpsCapacityCard
                depot={depot}
                result={result}
                config={config}
                tpsMaxCapacity={tpsMaxCapacity}
                tpsInitialWaste={tpsInitialWaste}
                completedTripIds={completedTripIds}
                onToggleTripCompleted={handleToggleTripCompleted}
                onCompleteAllTrips={handleCompleteAllTrips}
                onResetTps={handleResetTps}
                onChangeMaxCapacity={handleChangeTpsMaxCapacity}
                onChangeInitialWaste={handleChangeTpsInitialWaste}
                selectedTripFilter={selectedTripFilter}
                onSelectTripFilter={filter => {
                  setSelectedTripFilter(filter);
                  setActiveSection('peta');
                }}
                onPlaySpecificTripAnim={tripIdx => {
                  setActiveSection('peta');
                  handlePlaySpecificTripAnim(tripIdx);
                }}
              />
            </div>
          )}

          {/* ========================================================== */}
          {/* VIEW 6: ADUAN WARGA */}
          {/* ========================================================== */}
          {activeSection === 'aduan' && (
            <div className="space-y-4">
              <div>
                <h1 className="font-['Bricolage_Grotesque'] text-2xl font-bold tracking-tight text-slate-900">
                  Aduan &amp; Laporan Warga
                </h1>
                <p className="mt-0.5 text-sm font-medium text-slate-600">
                  Tindak lanjut insiden sampah meluap dan kondisi lapangan
                </p>
              </div>

              <IncidentDesk
                reports={reports}
                bins={bins}
                onTriggerDemoReport={handleTriggerDemoReport}
                onClearResolved={handleClearResolvedReports}
                onFocusBin={handleFocusBin}
                onResolveReport={handleResolveReport}
              />
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-[#E2E8E5] bg-white py-3.5 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1440px] flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <div>TrashRoute © 2026 · Kapanewon Godean, Sleman</div>
            <div>Jarak Jalan Raya Nyata + Held-Karp TSP Multi-Trip</div>
          </div>
        </footer>
      </div>

      {/* Floating Map Picking Helper Banner */}
      {mapPickMode && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-[99999] flex max-w-xl w-[92%] sm:w-auto items-center justify-between gap-3.5 rounded-2xl border-2 border-[#136D42] bg-[#0F5734] p-4 text-white shadow-2xl"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#136D42] font-bold">
              <Crosshair className="h-5 w-5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-['Bricolage_Grotesque'] text-sm font-bold text-white">
                  {mapPickMode === 'bin' ? 'Mode Klik Peta Aktif (Tambah Tong)' : 'Mode Pindah Pangkalan'}
                </span>
              </div>
              <p className="text-xs text-white/85">
                {mapPickMode === 'bin'
                  ? 'Klik pada jalan atau titik mana saja pada peta untuk menentukan lokasi tong baru.'
                  : 'Klik pada peta untuk menetapkan koordinat baru pangkalan armada.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setMapPickMode(null);
              if (mapPickMode === 'bin') {
                setAddModalOpen(true);
              }
            }}
            className="shrink-0 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/25 cursor-pointer"
          >
            Batal
          </button>
        </aside>
      )}

      {/* Modals */}
      <EditBinModal
        bin={editingBin}
        config={config}
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSave={handleSaveBinModal}
        onDelete={handleDeleteBin}
      />

      <AddBinModal
        isOpen={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
          setAddBinCoords(null);
        }}
        onAddBin={(name, location, lat, lng, fill) => {
          handleAddBin(name, location, lat, lng, fill);
          setAddBinCoords(null);
        }}
        nextId={bins.reduce((max, b) => Math.max(max, b.id), 0) + 1}
        initialLat={addBinCoords?.lat}
        initialLng={addBinCoords?.lng}
        onPickOnMap={handleStartPickBinOnMap}
      />

      <DepotModal
        depot={depot}
        isOpen={depotModalOpen}
        onClose={() => setDepotModalOpen(false)}
        onSaveDepot={handleSaveDepotModal}
      />

      <ConfigModal
        config={config}
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        onSaveConfig={newCfg => setConfig(prev => ({ ...prev, ...newCfg }))}
      />

      <GoogleMapsNavModal
        isOpen={gmapsModalOpen}
        onClose={() => setGmapsModalOpen(false)}
        result={result}
        depot={depot}
        config={config}
        fixedTrip={fixedTrip}
        initialTripIndex={gmapsInitialTripIndex}
        distMatrix={distMatrix}
      />
    </div>
  );
}
