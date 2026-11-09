import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Clock,
  Flame,
  Thermometer,
  ShieldAlert,
  Info,
  CheckCircle2,
  FileText,
  RotateCcw,
  Sparkles,
  Snowflake,
  Timer,
  Archive,
  Layers,
  ChevronRight
} from 'lucide-react';
import {
  HoldingTimeStandards,
  getActiveHoldingTimeStandards,
  HoldingCategory,
  HoldingItem
} from '../../data/holdingTimeR23';

interface HoldingTimeR23ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HoldingTimeR23Modal: React.FC<HoldingTimeR23ModalProps> = ({ isOpen, onClose }) => {
  const [standards] = useState<HoldingTimeStandards>(() => getActiveHoldingTimeStandards());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showGeneralRules, setShowGeneralRules] = useState(false);

  // Filtered Items
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return standards.categories
      .map((cat) => {
        if (selectedCategory !== 'all' && cat.id !== selectedCategory) {
          return null;
        }

        const filteredItems = cat.items.filter((item) => {
          if (!q) return true;
          return (
            item.name.toLowerCase().includes(q) ||
            item.thawing?.toLowerCase().includes(q) ||
            item.shelfLife?.toLowerCase().includes(q) ||
            item.cooking?.toLowerCase().includes(q) ||
            item.holding?.toLowerCase().includes(q) ||
            item.storage?.toLowerCase().includes(q) ||
            item.keterangan?.toLowerCase().includes(q)
          );
        });

        if (filteredItems.length === 0) return null;

        return {
          ...cat,
          items: filteredItems,
        };
      })
      .filter((cat): cat is HoldingCategory => cat !== null);
  }, [standards, searchQuery, selectedCategory]);

  const totalFilteredCount = useMemo(() => {
    return filteredCategories.reduce((acc, cat) => acc + cat.items.length, 0);
  }, [filteredCategories]);

  const totalAllItems = useMemo(() => {
    return standards.categories.reduce((acc, cat) => acc + cat.items.length, 0);
  }, [standards]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-2xl bg-[#F8FAFC] rounded-t-[28px] sm:rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden">
        {/* Header with Sleek Apple Bar */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 bg-white/95 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 font-black text-[9.5px] tracking-wider uppercase border border-emerald-500/20 shrink-0">
                {standards.revision}
              </span>
              <span className="text-[10.5px] font-extrabold text-slate-500 tracking-tight">
                {standards.version}
              </span>
              <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                • Berlaku: {standards.effectiveDateFormatted}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 stroke-[2.4] shrink-0" />
              <span>{standards.title}</span>
            </h2>
            <p className="text-[10.5px] sm:text-[11px] text-slate-500 font-medium truncate">
              Acuan resmi QA & Product Improvement — Food Safety & Display Holding Time
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-2xs"
            title="Tutup"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.4]" />
          </button>
        </div>

        {/* Search Bar & Segmented Category Filter */}
        <div className="px-4 pt-3 pb-2.5 sm:px-6 sm:pt-3.5 sm:pb-3 bg-white space-y-2.5 shrink-0 border-b border-slate-200/70">
          {/* iOS Style Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari produk (contoh: Chicken, Sosis, Oden, Fresh Milk)..."
              className="w-full pl-9 pr-9 py-2 rounded-xl bg-slate-100/80 hover:bg-slate-100 focus:bg-white border border-slate-200/70 text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2 text-[10px] cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setShowGeneralRules(false);
              }}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer shrink-0 text-xs ${
                selectedCategory === 'all' && !showGeneralRules
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua ({totalAllItems})
            </button>

            <button
              type="button"
              onClick={() => setShowGeneralRules(!showGeneralRules)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 text-xs ${
                showGeneralRules
                  ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                  : 'bg-amber-50 text-amber-800 border border-amber-200/80 hover:bg-amber-100'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 stroke-[2.4] shrink-0" />
              <span>8 Aturan Food Safety</span>
            </button>

            {standards.categories.map((cat) => {
              const isActive = selectedCategory === cat.id && !showGeneralRules;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setShowGeneralRules(false);
                  }}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer shrink-0 flex items-center gap-1.5 text-xs ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{cat.name}</span>
                  {cat.machineTemp && (
                    <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-black/10 font-bold shrink-0">
                      {cat.machineTemp}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar p-3 sm:p-5 space-y-4">
          {/* General Rules Card when toggled */}
          {showGeneralRules && (
            <div className="bg-gradient-to-br from-amber-50/90 to-orange-50/60 rounded-2xl p-4 sm:p-5 border border-amber-200/90 space-y-3 shadow-xs animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-950 font-black text-xs sm:text-sm uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 shrink-0 stroke-[2.4]" />
                  <span>Ketentuan Umum Food Safety Resmi (R23)</span>
                </div>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded-full">
                  8 Ketentuan
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {standards.generalRules.map((rule, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-white/90 border border-amber-200/60 text-xs text-amber-950 flex items-start gap-2 font-medium leading-snug shadow-2xs"
                  >
                    <span className="w-5 h-5 rounded-lg bg-amber-200 text-amber-900 text-[10.5px] font-black flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="flex-1 leading-snug">{rule}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results Summary Bar */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span>
              Menampilkan <b className="text-slate-800 font-extrabold">{totalFilteredCount}</b> produk standar holding time
            </span>
            {searchQuery && (
              <span className="text-emerald-700 font-bold truncate max-w-[150px]">
                Filter: "{searchQuery}"
              </span>
            )}
          </div>

          {/* Empty State */}
          {totalFilteredCount === 0 && (
            <div className="py-12 px-4 text-center rounded-2xl bg-white border border-slate-200/80 space-y-2.5 shadow-2xs">
              <Clock className="w-9 h-9 text-slate-300 mx-auto" />
              <h4 className="text-sm font-black text-slate-800">Produk Tidak Ditemukan</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Tidak ada standar holding time yang cocok dengan kata kunci "{searchQuery}".
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold transition hover:bg-black cursor-pointer shadow-xs"
              >
                Reset Pencarian
              </button>
            </div>
          )}

          {/* Grouped Categories with Apple Cards */}
          {filteredCategories.map((cat) => (
            <div
              key={cat.id}
              className="bg-white rounded-2xl p-3.5 sm:p-5 shadow-xs border border-slate-200/80 space-y-3.5 overflow-hidden"
            >
              {/* Category Section Header */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black shrink-0 border border-emerald-100">
                    <Flame className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                      {cat.name}
                    </h3>
                    {cat.machineTemp && (
                      <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                        <Thermometer className="w-3 h-3 text-rose-500 shrink-0" />
                        Suhu Mesin: {cat.machineTemp}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-extrabold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full shrink-0">
                  {cat.items.length} item
                </span>
              </div>

              {/* Items Card List */}
              <div className="space-y-3">
                {cat.items.map((item, idx) => {
                  const hasSpecs = item.thawing || item.shelfLife || item.cooking || item.storage;

                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-slate-50/70 hover:bg-slate-50 border border-slate-200/70 transition-all space-y-2.5 overflow-hidden shadow-2xs"
                    >
                      {/* Product Name & Prominent Holding Badge */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-snug break-words flex-1 tracking-tight">
                          {item.name}
                        </h4>
                        {item.holding && (
                          <div className="self-start sm:self-auto shrink-0 max-w-full">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-extrabold text-[11px] sm:text-xs shadow-2xs break-words tracking-tight">
                              <Clock className="w-3.5 h-3.5 text-white shrink-0 stroke-[2.4]" />
                              <span>{item.holding}</span>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Specifications Grid */}
                      {hasSpecs && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                          {item.thawing && (
                            <div className="p-2 sm:p-2.5 rounded-xl bg-sky-50/70 border border-sky-100/80 min-w-0">
                              <span className="text-[9.5px] uppercase font-bold text-sky-700 tracking-wider flex items-center gap-1">
                                <Snowflake className="w-3 h-3 shrink-0 stroke-[2.2]" />
                                <span>Thawing</span>
                              </span>
                              <span className="font-bold text-slate-800 break-words block mt-0.5 leading-snug">
                                {item.thawing}
                              </span>
                            </div>
                          )}
                          {item.shelfLife && (
                            <div className="p-2 sm:p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100/80 min-w-0">
                              <span className="text-[9.5px] uppercase font-bold text-indigo-700 tracking-wider flex items-center gap-1">
                                <Timer className="w-3 h-3 shrink-0 stroke-[2.2]" />
                                <span>Shelf Life</span>
                              </span>
                              <span className="font-bold text-slate-800 break-words block mt-0.5 leading-snug">
                                {item.shelfLife}
                              </span>
                            </div>
                          )}
                          {item.cooking && (
                            <div className="p-2 sm:p-2.5 rounded-xl bg-amber-50/70 border border-amber-100/80 min-w-0">
                              <span className="text-[9.5px] uppercase font-bold text-amber-700 tracking-wider flex items-center gap-1">
                                <Flame className="w-3 h-3 shrink-0 stroke-[2.2]" />
                                <span>Cooking Spec</span>
                              </span>
                              <span className="font-bold text-slate-800 break-words block mt-0.5 leading-snug">
                                {item.cooking}
                              </span>
                            </div>
                          )}
                          {item.storage && (
                            <div className="p-2 sm:p-2.5 rounded-xl bg-slate-100/80 border border-slate-200/70 min-w-0">
                              <span className="text-[9.5px] uppercase font-bold text-slate-600 tracking-wider flex items-center gap-1">
                                <Archive className="w-3 h-3 shrink-0 stroke-[2.2]" />
                                <span>Penyimpanan</span>
                              </span>
                              <span className="font-bold text-slate-800 break-words block mt-0.5 leading-snug">
                                {item.storage}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Notes / Keterangan */}
                      {item.keterangan && (
                        <div className="p-2.5 rounded-xl bg-teal-50/80 border border-teal-100 text-[10.5px] sm:text-xs text-teal-950 font-medium flex items-start gap-2 leading-relaxed break-words">
                          <Info className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                          <span className="break-words flex-1 leading-snug">{item.keterangan}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 sm:px-6 bg-white border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-bold text-slate-700 text-xs">Official Standards R23</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs transition cursor-pointer shadow-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
