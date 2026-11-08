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
  Sparkles
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col max-h-[94vh] overflow-hidden">
        {/* Header with Liquid Glass & Document Metadata */}
        <div className="p-3.5 sm:p-5 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100 flex items-start justify-between gap-2.5 shrink-0">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 font-black text-[9px] sm:text-[10px] tracking-wider uppercase border border-emerald-500/20 shrink-0">
                {standards.revision}
              </span>
              <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 tracking-tight break-all">
                {standards.version}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                • Berlaku: {standards.effectiveDateFormatted}
              </span>
            </div>
            <h2 className="text-sm sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-1.5 break-words">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 stroke-[2.3] shrink-0" />
              <span>{standards.title}</span>
            </h2>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium break-words leading-tight">
              Acuan resmi QA & Product Improvement — Food Safety & Display Holding Time
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full iphone-glass-icon-btn flex items-center justify-center text-slate-700 hover:text-black active:scale-95 transition-transform shrink-0 cursor-pointer shadow-xs ml-1"
            title="Tutup"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.4]" />
          </button>
        </div>

        {/* Search Bar & Category Navigation */}
        <div className="p-2.5 sm:px-5 sm:pt-4 sm:pb-3 bg-white space-y-2.5 shrink-0 border-b border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari produk (contoh: Chicken, Sosis, Oden, Susu)..."
              className="w-full pl-9 pr-9 py-2 rounded-xl bg-slate-100/80 border border-slate-200/80 text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2 text-[10px]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setShowGeneralRules(false);
              }}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer shrink-0 text-xs ${
                selectedCategory === 'all' && !showGeneralRules
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua ({standards.categories.reduce((a, c) => a + c.items.length, 0)})
            </button>

            <button
              type="button"
              onClick={() => setShowGeneralRules(!showGeneralRules)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 text-xs ${
                showGeneralRules
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 stroke-[2.4] shrink-0" />
              <span>Ketentuan Umum (8 Aturan)</span>
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
                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer shrink-0 flex items-center gap-1.5 text-xs ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{cat.name}</span>
                  {cat.machineTemp && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-black/10 font-black shrink-0">
                      {cat.machineTemp}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar p-3 sm:p-5 space-y-3.5 bg-[#F8F9FD]">
          {/* General Rules Box when toggled or at top */}
          {showGeneralRules && (
            <div className="bg-amber-50/95 rounded-2xl p-3.5 sm:p-4 border border-amber-200/90 space-y-2.5 animate-in fade-in">
              <div className="flex items-center gap-2 text-amber-900 font-black text-xs uppercase tracking-wider">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Ketentuan Umum Food Safety Resmi (R23)</span>
              </div>
              <ul className="space-y-2">
                {standards.generalRules.map((rule, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-amber-950 flex items-start gap-2 font-medium leading-relaxed break-words"
                  >
                    <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="break-words flex-1 leading-snug">{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Results Summary */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span>
              Menampilkan <b className="text-slate-800">{totalFilteredCount}</b> produk standar holding time
            </span>
            {searchQuery && (
              <span className="text-emerald-700 font-bold truncate max-w-[150px]">
                Filter: "{searchQuery}"
              </span>
            )}
          </div>

          {/* Empty State */}
          {totalFilteredCount === 0 && (
            <div className="py-10 px-4 text-center rounded-2xl bg-white border border-slate-200 space-y-2">
              <Clock className="w-8 h-8 text-slate-300 mx-auto" />
              <h4 className="text-xs sm:text-sm font-black text-slate-700">Produk Tidak Ditemukan</h4>
              <p className="text-[11px] text-slate-500">
                Tidak ada standar holding time yang cocok dengan kata kunci "{searchQuery}".
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold transition hover:bg-black"
              >
                Reset Pencarian
              </button>
            </div>
          )}

          {/* Grouped by Category */}
          {filteredCategories.map((cat) => (
            <div
              key={cat.id}
              className="bg-white rounded-2xl p-3 sm:p-4 shadow-xs border border-slate-200/90 space-y-3 overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-black shrink-0">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-black text-slate-800 truncate">{cat.name}</h3>
                    {cat.machineTemp && (
                      <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                        <Thermometer className="w-3 h-3 text-rose-500 shrink-0" />
                        Suhu: {cat.machineTemp}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-extrabold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full self-start sm:self-auto shrink-0">
                  {cat.items.length} item
                </span>
              </div>

              {/* Items Card List */}
              <div className="space-y-2.5">
                {cat.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50/80 hover:bg-slate-50 border border-slate-100/90 transition space-y-2 overflow-hidden"
                  >
                    {/* Product Name & Holding Badge (Responsive Stack on Mobile) */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1.5">
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-snug break-words flex-1">
                        {item.name}
                      </h4>
                      {item.holding && (
                        <div className="self-start sm:self-auto shrink-0 max-w-full">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-900 font-extrabold text-[11px] border border-emerald-300/70 shadow-xs break-words">
                            <Clock className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>{item.holding}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Specifications Grid: 1 col on mobile, 2 col on tablet/desktop */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-slate-200/60">
                      {item.thawing && (
                        <div className="min-w-0">
                          <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider">
                            Thawing:
                          </span>
                          <span className="font-bold text-slate-800 break-words block">
                            {item.thawing}
                          </span>
                        </div>
                      )}
                      {item.shelfLife && (
                        <div className="min-w-0">
                          <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider">
                            Shelf Life Setelah Thawing:
                          </span>
                          <span className="font-bold text-slate-800 break-words block">
                            {item.shelfLife}
                          </span>
                        </div>
                      )}
                      {item.cooking && (
                        <div className="min-w-0">
                          <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider">
                            Cooking Spec:
                          </span>
                          <span className="font-bold text-slate-800 break-words block">
                            {item.cooking}
                          </span>
                        </div>
                      )}
                      {item.storage && (
                        <div className="min-w-0">
                          <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider">
                            Penyimpanan:
                          </span>
                          <span className="font-bold text-slate-800 break-words block">
                            {item.storage}
                          </span>
                        </div>
                      )}
                    </div>

                    {item.keterangan && (
                      <div className="p-2 rounded-lg bg-teal-50/80 border border-teal-100 text-[10px] text-teal-950 font-medium flex items-start gap-1.5 break-words">
                        <Info className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                        <span className="break-words flex-1 leading-snug">{item.keterangan}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 sm:px-5 bg-white border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-semibold text-slate-700 text-xs">Official Standards R23</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
