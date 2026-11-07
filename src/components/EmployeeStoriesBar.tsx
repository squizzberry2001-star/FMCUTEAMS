import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  X,
  Camera,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Trash2,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Heart,
} from 'lucide-react';
import { User } from '../types';

export interface StorySlide {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  userAvatar: string;
  imageUrl: string;
  caption: string;
  storeTag?: string;
  createdAt: string; // HH:MM WIB
  dateKey: string; // YYYY-MM-DD
  /** Map of emoji -> array of userNames who reacted */
  reactions: Record<string, string[]>;
}

interface EmployeeStoriesBarProps {
  currentUser?: User | null;
  users?: User[];
}

const MAX_STORIES_PER_DAY = 3;
const QUICK_EMOJIS = ['❤️', '🔥', '👏', '😍', '👍', '🙌', '🚀', '💯'];
const STORAGE_KEY = 'fmcu_employee_stories_v1';
const VIEWED_STORAGE_KEY = 'fmcu_viewed_stories_v1';

const getTodayDateKey = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getCurrentWibTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;
};

const getDefaultSeedStories = (todayKey: string): StorySlide[] => [
  {
    id: 'seed-story-1',
    userId: 'septiana',
    userName: 'Septiana Indasari',
    userRole: 'Field Supervisor FMCU',
    userAvatar:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=180&auto=format&fit=crop&q=80',
    imageUrl:
      'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=900&auto=format&fit=crop&q=80',
    caption: 'Pengecekan standar QSC & display produk pagi ini di Store Thamrin berjalan lancar ✨',
    storeTag: 'FM Thamrin City',
    createdAt: '08:30 WIB',
    dateKey: todayKey,
    reactions: {
      '🔥': ['Hadi Ilman', 'Novy Rusnani', 'Sutris Ismawan', 'Fikri S.'],
      '❤️': ['Tini Pratiwi', 'Marisa Giselina', 'Zildzian Azhar'],
      '👏': ['Hadi Ilman', 'Fikri S.'],
    },
  },
  {
    id: 'seed-story-2',
    userId: 'septiana',
    userName: 'Septiana Indasari',
    userRole: 'Field Supervisor FMCU',
    userAvatar:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=180&auto=format&fit=crop&q=80',
    imageUrl:
      'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=900&auto=format&fit=crop&q=80',
    caption: 'Briefing tim shift pagi untuk memastikan pelayanan & FEFO chiller terjaga 100% 💪',
    storeTag: 'FM Thamrin City',
    createdAt: '09:15 WIB',
    dateKey: todayKey,
    reactions: {
      '👍': ['Hadi Ilman', 'Sutris Ismawan'],
      '💯': ['Novy Rusnani', 'Tini Pratiwi'],
    },
  },
  {
    id: 'seed-story-3',
    userId: 'hadi',
    userName: 'Hadi Ilman',
    userRole: 'Area Manager FMCU',
    userAvatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=180&auto=format&fit=crop&q=80',
    imageUrl:
      'https://images.unsplash.com/photo-1542838132-92c53300491e?w=900&auto=format&fit=crop&q=80',
    caption: 'Audit kesegaran produk fresh & kesiapan area F&B bar station hari ini 🚀',
    storeTag: 'FM Sudirman Park',
    createdAt: '09:40 WIB',
    dateKey: todayKey,
    reactions: {
      '🔥': ['Septiana Indasari', 'Novy Rusnani', 'Marisa Giselina', 'Sutris Ismawan', 'Fikri S.'],
      '🚀': ['Tini Pratiwi', 'Zildzian Azhar'],
      '👏': ['Septiana Indasari'],
    },
  },
  {
    id: 'seed-story-4',
    userId: 'novy',
    userName: 'Novy Rusnani',
    userRole: 'Regional Manager',
    userAvatar:
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=180&auto=format&fit=crop&q=80',
    imageUrl:
      'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=900&auto=format&fit=crop&q=80',
    caption: 'Apresiasi untuk tim store dengan pencapaian QSC tertinggi minggu ini! Pertahankan 🌟',
    storeTag: 'FM Grand Indonesia',
    createdAt: '10:05 WIB',
    dateKey: todayKey,
    reactions: {
      '❤️': ['Septiana Indasari', 'Hadi Ilman', 'Sutris Ismawan', 'Fikri S.', 'Tini Pratiwi'],
      '😍': ['Marisa Giselina', 'Zildzian Azhar'],
      '🙌': ['Hadi Ilman'],
    },
  },
  {
    id: 'seed-story-5',
    userId: 'sutris',
    userName: 'Sutris Ismawan',
    userRole: 'Store Head',
    userAvatar:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=180&auto=format&fit=crop&q=80',
    imageUrl:
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=900&auto=format&fit=crop&q=80',
    caption: 'Area coffee machine & chiller sudah deep cleaning sesuai jadwal checklist harian ✅',
    storeTag: 'FM Kuningan',
    createdAt: '10:50 WIB',
    dateKey: todayKey,
    reactions: {
      '👏': ['Septiana Indasari', 'Hadi Ilman', 'Novy Rusnani'],
      '🔥': ['Fikri S.'],
    },
  },
  {
    id: 'seed-story-6',
    userId: 'marisa',
    userName: 'Marisa Giselina',
    userRole: 'Field Auditor FMCU',
    userAvatar:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=180&auto=format&fit=crop&q=80',
    imageUrl:
      'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=900&auto=format&fit=crop&q=80',
    caption: 'Monitoring kelengkapan price card & planogram rak minuman dingin 📋',
    storeTag: 'FM Kemang',
    createdAt: '11:20 WIB',
    dateKey: todayKey,
    reactions: {
      '❤️': ['Septiana Indasari', 'Tini Pratiwi'],
      '👍': ['Hadi Ilman'],
    },
  },
];

// Compress uploaded image for smooth localStorage persistence
const compressStoryImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const maxDim = 1080;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
          URL.revokeObjectURL(objectUrl);
          resolve(dataUrl);
        } else {
          URL.revokeObjectURL(objectUrl);
          resolve(objectUrl);
        }
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
    img.src = objectUrl;
  });
};

export const EmployeeStoriesBar: React.FC<EmployeeStoriesBarProps> = ({
  currentUser,
}) => {
  const todayKey = getTodayDateKey();
  const currentUserName = currentUser?.name || 'Sarah Jenkins';
  const currentUserRole = currentUser?.role || 'Field Staff FMCU';
  const currentUserAvatar =
    currentUser?.avatar ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=180&auto=format&fit=crop&q=80';
  const currentUserId = currentUserName.toLowerCase().replace(/\s+/g, '-');

  const [stories, setStories] = useState<StorySlide[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn(e);
    }
    return getDefaultSeedStories(todayKey);
  });

  const [viewedStoryIds, setViewedStoryIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(VIEWED_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn(e);
    }
    return [];
  });

  // Save stories to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stories));
    } catch (e) {
      console.warn('Story storage full, trimming oldest seed:', e);
    }
  }, [stories]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEWED_STORAGE_KEY, JSON.stringify(viewedStoryIds));
    } catch (e) {
      console.warn(e);
    }
  }, [viewedStoryIds]);

  // Group stories by user
  const myTodayStories = stories.filter(
    (s) =>
      s.dateKey === todayKey &&
      (s.userId === currentUserId || s.userName.toLowerCase() === currentUserName.toLowerCase())
  );

  // Other employees' stories grouped by userName
  const otherUserGroups = React.useMemo(() => {
    const map = new Map<
      string,
      {
        userId: string;
        userName: string;
        userRole: string;
        userAvatar: string;
        slides: StorySlide[];
      }
    >();

    stories.forEach((s) => {
      if (
        s.userId === currentUserId ||
        s.userName.toLowerCase() === currentUserName.toLowerCase()
      ) {
        return;
      }
      const key = s.userName.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          userId: s.userId,
          userName: s.userName,
          userRole: s.userRole,
          userAvatar: s.userAvatar,
          slides: [],
        });
      }
      const group = map.get(key)!;
      if (group.slides.length < MAX_STORIES_PER_DAY) {
        group.slides.push(s);
      }
    });

    return Array.from(map.values());
  }, [stories, currentUserId, currentUserName]);

  // Story Viewer State
  const [activeViewerGroupIdx, setActiveViewerGroupIdx] = useState<number | null>(null); // -1 for own stories, 0..N for otherUserGroups
  const [activeSlideIdx, setActiveSlideIdx] = useState<number>(0);
  const [slideProgress, setSlideProgress] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Floating emoji burst animation in viewer
  const [floatingBursts, setFloatingBursts] = useState<
    { id: number; emoji: string; left: number }[]
  >([]);

  // Upload Story Modal State
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [draftImage, setDraftImage] = useState<string>('');
  const [draftCaption, setDraftCaption] = useState<string>('');
  const [draftStoreTag, setDraftStoreTag] = useState<string>('Store Visit FMCU');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState<boolean>(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Determine currently active slides in viewer
  const currentViewerSlides: StorySlide[] = React.useMemo(() => {
    if (activeViewerGroupIdx === null) return [];
    if (activeViewerGroupIdx === -1) return myTodayStories;
    return otherUserGroups[activeViewerGroupIdx]?.slides || [];
  }, [activeViewerGroupIdx, myTodayStories, otherUserGroups]);

  const currentSlide = currentViewerSlides[activeSlideIdx] || null;

  // Mark current slide as viewed
  useEffect(() => {
    if (currentSlide && !viewedStoryIds.includes(currentSlide.id)) {
      setViewedStoryIds((prev) => [...prev, currentSlide.id]);
    }
  }, [currentSlide, viewedStoryIds]);

  // Auto-advance progress bar in viewer (6 seconds per slide)
  useEffect(() => {
    if (activeViewerGroupIdx === null || !currentSlide || isPaused) return;

    const interval = setInterval(() => {
      setSlideProgress((prev) => {
        if (prev >= 100) {
          handleNextSlide();
          return 0;
        }
        return prev + 2; // 50 ticks * 120ms = 6000ms
      });
    }, 120);

    return () => clearInterval(interval);
  }, [activeViewerGroupIdx, activeSlideIdx, currentSlide, isPaused]);

  const openOwnStoriesOrUpload = () => {
    if (myTodayStories.length > 0) {
      setActiveViewerGroupIdx(-1);
      setActiveSlideIdx(0);
      setSlideProgress(0);
    } else {
      handleOpenUploadModal();
    }
  };

  const handleOpenUploadModal = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setUploadError(null);
    if (myTodayStories.length >= MAX_STORIES_PER_DAY) {
      setUploadError(
        `Batas harian tercapai (${MAX_STORIES_PER_DAY}/${MAX_STORIES_PER_DAY} story hari ini). Maksimal upload 3x story per hari.`
      );
    }
    setShowUploadModal(true);
  };

  const openEmployeeStoryGroup = (index: number) => {
    const group = otherUserGroups[index];
    if (!group || group.slides.length === 0) return;
    // Start at first unviewed slide if any
    const firstUnviewedIdx = group.slides.findIndex((s) => !viewedStoryIds.includes(s.id));
    setActiveViewerGroupIdx(index);
    setActiveSlideIdx(firstUnviewedIdx >= 0 ? firstUnviewedIdx : 0);
    setSlideProgress(0);
  };

  const closeViewer = () => {
    setActiveViewerGroupIdx(null);
    setActiveSlideIdx(0);
    setSlideProgress(0);
  };

  const handleNextSlide = () => {
    if (activeViewerGroupIdx === null) return;
    if (activeSlideIdx < currentViewerSlides.length - 1) {
      setActiveSlideIdx((prev) => prev + 1);
      setSlideProgress(0);
    } else if (activeViewerGroupIdx === -1) {
      if (otherUserGroups.length > 0) {
        setActiveViewerGroupIdx(0);
        setActiveSlideIdx(0);
        setSlideProgress(0);
      } else {
        closeViewer();
      }
    } else if (activeViewerGroupIdx < otherUserGroups.length - 1) {
      setActiveViewerGroupIdx((prev) => (prev !== null ? prev + 1 : null));
      setActiveSlideIdx(0);
      setSlideProgress(0);
    } else {
      closeViewer();
    }
  };

  const handlePrevSlide = () => {
    if (activeViewerGroupIdx === null) return;
    if (activeSlideIdx > 0) {
      setActiveSlideIdx((prev) => prev - 1);
      setSlideProgress(0);
    } else if (activeViewerGroupIdx > 0) {
      const prevGroupIdx = activeViewerGroupIdx - 1;
      const prevSlides = otherUserGroups[prevGroupIdx]?.slides || [];
      setActiveViewerGroupIdx(prevGroupIdx);
      setActiveSlideIdx(Math.max(0, prevSlides.length - 1));
      setSlideProgress(0);
    } else if (activeViewerGroupIdx === 0 && myTodayStories.length > 0) {
      setActiveViewerGroupIdx(-1);
      setActiveSlideIdx(Math.max(0, myTodayStories.length - 1));
      setSlideProgress(0);
    } else {
      setSlideProgress(0);
    }
  };

  // Toggle or add emoji reaction on the current story
  const handleToggleReaction = (emoji: string) => {
    if (!currentSlide) return;

    // Trigger floating emoji burst
    const burstId = Date.now() + Math.random();
    const randomLeft = 22 + Math.floor(Math.random() * 56);
    setFloatingBursts((prev) => [...prev, { id: burstId, emoji, left: randomLeft }]);
    setTimeout(() => {
      setFloatingBursts((prev) => prev.filter((b) => b.id !== burstId));
    }, 1200);

    setStories((prev) =>
      prev.map((slide) => {
        if (slide.id !== currentSlide.id) return slide;
        const currentReactors = slide.reactions[emoji] || [];
        const hasReacted = currentReactors.some(
          (name) => name.toLowerCase() === currentUserName.toLowerCase()
        );
        const updatedReactors = hasReacted
          ? currentReactors.filter(
              (name) => name.toLowerCase() !== currentUserName.toLowerCase()
            )
          : [...currentReactors, currentUserName];

        const updatedReactions = { ...slide.reactions };
        if (updatedReactors.length > 0) {
          updatedReactions[emoji] = updatedReactors;
        } else {
          delete updatedReactions[emoji];
        }

        return {
          ...slide,
          reactions: updatedReactions,
        };
      })
    );
  };

  // Handle selecting photo for new story
  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingPhoto(true);
    setUploadError(null);
    try {
      const compressed = await compressStoryImage(file);
      setDraftImage(compressed);
    } catch (err) {
      console.error(err);
      setUploadError('Gagal memuat foto. Silakan pilih foto lain.');
    } finally {
      setIsProcessingPhoto(false);
      e.target.value = '';
    }
  };

  const handlePublishStory = (e: React.FormEvent) => {
    e.preventDefault();
    if (myTodayStories.length >= MAX_STORIES_PER_DAY) {
      setUploadError(
        `Anda sudah mencapai batas maksimal ${MAX_STORIES_PER_DAY}x upload story hari ini!`
      );
      return;
    }
    if (!draftImage) {
      setUploadError('Pilih atau ambil foto terlebih dahulu untuk dibagikan ke Story.');
      return;
    }

    const newStory: StorySlide = {
      id: `story-${Date.now()}`,
      userId: currentUserId,
      userName: currentUserName,
      userRole: currentUserRole,
      userAvatar: currentUserAvatar,
      imageUrl: draftImage,
      caption: draftCaption.trim() || 'Update aktivitas kunjungan harian FMCU ✨',
      storeTag: draftStoreTag.trim() || 'FMCU Field Activity',
      createdAt: getCurrentWibTime(),
      dateKey: todayKey,
      reactions: {},
    };

    setStories((prev) => [newStory, ...prev]);
    setDraftImage('');
    setDraftCaption('');
    setShowUploadModal(false);

    // Immediately open viewer to show the newly posted story
    setTimeout(() => {
      setActiveViewerGroupIdx(-1);
      setActiveSlideIdx(0);
      setSlideProgress(0);
    }, 80);
  };

  const handleDeleteOwnStory = (storyId: string) => {
    setStories((prev) => prev.filter((s) => s.id !== storyId));
    if (currentViewerSlides.length <= 1) {
      closeViewer();
    } else {
      setActiveSlideIdx((prev) => Math.max(0, prev - 1));
    }
  };

  const remainingQuota = Math.max(0, MAX_STORIES_PER_DAY - myTodayStories.length);

  return (
    <>
      {/* Horizontal Instagram-Style Circle Stories Strip */}
      <div className="w-full mb-3.5 -mx-1 px-1">
        <div className="flex items-center gap-3.5 overflow-x-auto no-scrollbar py-1.5">
          {/* 1. Leftmost Button: User Story Silhouette + '+' Badge at Bottom-Right */}
          <div className="flex flex-col items-center flex-shrink-0 w-[68px]">
            <div className="relative">
              <button
                type="button"
                onClick={openOwnStoriesOrUpload}
                className={`w-16 h-16 rounded-full p-[2.5px] transition-transform active:scale-95 cursor-pointer ${
                  myTodayStories.length > 0
                    ? 'bg-gradient-to-tr from-[#FEDA77] via-[#DD2A7B] to-[#8134AF] shadow-sm'
                    : 'bg-gradient-to-tr from-slate-200 via-slate-300 to-slate-200'
                }`}
                title="Cerita Anda (Maks 3x/hari)"
              >
                <div className="w-full h-full rounded-full bg-white p-[2px] flex items-center justify-center overflow-hidden relative">
                  {myTodayStories.length > 0 ? (
                    <img
                      src={myTodayStories[0].imageUrl || currentUserAvatar}
                      alt={currentUserName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    /* Story Silhouette with Subtle Avatar Overlay */
                    <div className="w-full h-full rounded-full bg-gradient-to-b from-slate-100 to-slate-200 flex items-center justify-center relative overflow-hidden">
                      <svg
                        viewBox="0 0 24 24"
                        className="w-9 h-9 text-slate-400/90 translate-y-1"
                        fill="currentColor"
                      >
                        <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>

              {/* Daily Quota Pill Top-Left (e.g. 1/3) */}
              <span className="absolute -top-1 -left-1 px-1.5 py-0.2 rounded-full bg-slate-900/90 text-white text-[9px] font-black tracking-tight border border-white shadow-xs pointer-events-none">
                {myTodayStories.length}/{MAX_STORIES_PER_DAY}
              </span>

              {/* Instagram '+' Badge at Bottom-Right */}
              <button
                type="button"
                onClick={handleOpenUploadModal}
                className={`absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full flex items-center justify-center border-2 border-[#F8F9FD] shadow-md transition-transform active:scale-90 cursor-pointer ${
                  remainingQuota > 0
                    ? 'bg-gradient-to-tr from-[#0095F6] to-[#2563EB] text-white'
                    : 'bg-slate-400 text-white'
                }`}
                title={
                  remainingQuota > 0
                    ? `Tambah Story (${remainingQuota} kuota tersisa hari ini)`
                    : 'Kuota Story Hari Ini Penuh (3/3)'
                }
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            </div>

            <span className="text-[10px] font-bold text-slate-700 mt-1.5 truncate w-full text-center leading-tight">
              Cerita Anda
            </span>
          </div>

          {/* 2. Other Employees' Story Circles */}
          {otherUserGroups.map((group, idx) => {
            const hasUnviewed = group.slides.some((s) => !viewedStoryIds.includes(s.id));
            const firstName = group.userName.split(' ')[0];

            // Count total reactions across this employee's stories
            const totalGroupReactions = group.slides.reduce((acc, s) => {
              return (
                acc +
                Object.values(s.reactions).reduce((sum, arr) => sum + arr.length, 0)
              );
            }, 0);

            return (
              <button
                key={group.userId + idx}
                type="button"
                onClick={() => openEmployeeStoryGroup(idx)}
                className="flex flex-col items-center flex-shrink-0 w-[68px] group cursor-pointer"
              >
                <div className="relative">
                  <div
                    className={`w-16 h-16 rounded-full p-[2.5px] transition-all duration-300 group-hover:scale-105 group-active:scale-95 ${
                      hasUnviewed
                        ? 'bg-gradient-to-tr from-[#FEDA77] via-[#DD2A7B] to-[#8134AF] shadow-sm'
                        : 'bg-slate-300/80'
                    }`}
                  >
                    <div className="w-full h-full rounded-full bg-white p-[2px] overflow-hidden">
                      <img
                        src={group.userAvatar}
                        alt={group.userName}
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                  </div>

                  {/* Slide count badge if >1 story */}
                  {group.slides.length > 1 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-white text-slate-900 border border-slate-200 shadow-xs text-[9px] font-black flex items-center justify-center">
                      {group.slides.length}
                    </span>
                  )}

                  {/* Mini reaction indicator pill at bottom center */}
                  {totalGroupReactions > 0 && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded-full bg-white/95 backdrop-blur-xs border border-slate-200/80 shadow-xs text-[8px] font-extrabold text-slate-700 flex items-center gap-0.5 whitespace-nowrap">
                      <span>🔥</span>
                      <span>{totalGroupReactions}</span>
                    </span>
                  )}
                </div>

                <span
                  className={`text-[10px] mt-1.5 truncate w-full text-center leading-tight ${
                    hasUnviewed ? 'font-bold text-slate-800' : 'font-medium text-slate-500'
                  }`}
                >
                  {firstName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          MODAL 1: FULL-SCREEN INSTAGRAM STORY VIEWER WITH EMOJI REACTIONS BELOW PHOTO
          ========================================================================= */}
      {activeViewerGroupIdx !== null && currentSlide && (
        <div
          className="fixed inset-0 z-[9500] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-between p-2 sm:p-4 select-none animate-in fade-in duration-150"
          onMouseDown={() => setIsPaused(true)}
          onMouseUp={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >
          {/* Story Container (Instagram 9:16 Mobile Frame) */}
          <div className="relative w-full max-w-md h-full flex flex-col justify-between overflow-hidden">
            {/* 1. Segmented Progress Bars + User Header */}
            <div className="pt-[max(0.5rem,env(safe-area-inset-top,12px))] px-2 z-20 space-y-2.5">
              {/* Progress Bars */}
              <div className="flex items-center gap-1.5">
                {currentViewerSlides.map((slide, idx) => {
                  const widthPct =
                    idx < activeSlideIdx
                      ? 100
                      : idx === activeSlideIdx
                      ? slideProgress
                      : 0;
                  return (
                    <div
                      key={slide.id}
                      className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden"
                    >
                      <div
                        className="h-full bg-white rounded-full transition-all duration-100 ease-linear"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* User Info Bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full p-[1.5px] bg-gradient-to-tr from-[#FEDA77] via-[#DD2A7B] to-[#8134AF] shrink-0">
                    <img
                      src={currentSlide.userAvatar}
                      alt={currentSlide.userName}
                      className="w-full h-full rounded-full object-cover border border-black"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold text-white truncate">
                        {currentSlide.userName}
                      </span>
                      <span className="text-[10px] text-white/70 font-medium shrink-0">
                        • {currentSlide.createdAt}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-teal-300 font-semibold truncate">
                      {currentSlide.storeTag && (
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5" />
                          {currentSlide.storeTag}
                        </span>
                      )}
                      <span className="text-white/50">
                        ({activeSlideIdx + 1}/{currentViewerSlides.length})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {activeViewerGroupIdx === -1 && (
                    <>
                      {remainingQuota > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            closeViewer();
                            handleOpenUploadModal();
                          }}
                          className="px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Tambah ({myTodayStories.length}/3)</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteOwnStory(currentSlide.id);
                        }}
                        className="w-8 h-8 rounded-full bg-rose-500/25 hover:bg-rose-500/40 text-rose-200 flex items-center justify-center cursor-pointer"
                        title="Hapus Story Ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeViewer();
                    }}
                    className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Story Photo Canvas (with Left/Right Tap Zones & Caption) */}
            <div className="relative flex-1 my-2 rounded-3xl overflow-hidden bg-slate-900 border border-white/10 shadow-2xl flex items-center justify-center">
              <img
                src={currentSlide.imageUrl}
                alt={currentSlide.caption}
                className="w-full h-full object-cover"
              />

              {/* Subtle Bottom Gradient Vignette for Caption */}
              <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

              {/* Left & Right Tap Navigation Zones */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevSlide();
                }}
                className="absolute inset-y-0 left-0 w-1/3 z-10 flex items-center justify-start pl-2 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                aria-label="Story Sebelumnya"
              >
                <span className="w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center">
                  <ChevronLeft className="w-5 h-5" />
                </span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextSlide();
                }}
                className="absolute inset-y-0 right-0 w-2/3 z-10 flex items-center justify-end pr-2 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                aria-label="Story Berikutnya"
              >
                <span className="w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center">
                  <ChevronRight className="w-5 h-5" />
                </span>
              </button>

              {/* Floating Emoji Bursts */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
                {floatingBursts.map((b) => (
                  <div
                    key={b.id}
                    className="absolute bottom-8 text-4xl animate-bounce"
                    style={{
                      left: `${b.left}%`,
                      animation: 'ballFloating 1.1s ease-out forwards',
                    }}
                  >
                    {b.emoji}
                  </div>
                ))}
              </div>

              {/* Story Caption Overlay */}
              {currentSlide.caption && (
                <div className="absolute bottom-3.5 inset-x-3.5 z-20 pointer-events-none">
                  <p className="text-xs sm:text-sm font-semibold text-white leading-snug drop-shadow-sm bg-black/45 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/15">
                    {currentSlide.caption}
                  </p>
                </div>
              )}
            </div>

            {/* 3. BELOW STORY PHOTO: Emoji Reactions Count Display & Quick Emoji Reaction Bar */}
            <div
              className="pb-[max(0.5rem,env(safe-area-inset-bottom,12px))] px-1 space-y-2 z-20"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Active Emoji Reactions & Counts Directly Below Story Photo */}
              <div className="flex items-center justify-between gap-2 bg-white/10 backdrop-blur-md px-3 py-2 rounded-2xl border border-white/15">
                <div className="flex items-center gap-1.5 flex-wrap min-h-[24px]">
                  {Object.entries(currentSlide.reactions).filter(
                    ([, usersList]) => usersList.length > 0
                  ).length === 0 ? (
                    <span className="text-[11px] text-white/60 font-medium flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 text-pink-400" />
                      <span>Belum ada reaksi — berikan emot pertama!</span>
                    </span>
                  ) : (
                    Object.entries(currentSlide.reactions)
                      .filter(([, usersList]) => usersList.length > 0)
                      .map(([emoji, usersList]) => {
                        const iReacted = usersList.some(
                          (u) => u.toLowerCase() === currentUserName.toLowerCase()
                        );
                        return (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleToggleReaction(emoji)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold transition-all active:scale-90 cursor-pointer ${
                              iReacted
                                ? 'bg-gradient-to-r from-pink-500/80 to-rose-500/80 text-white border border-pink-300 shadow-sm'
                                : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
                            }`}
                            title={`Direaksi oleh: ${usersList.join(', ')}`}
                          >
                            <span>{emoji}</span>
                            <span>{usersList.length}</span>
                          </button>
                        );
                      })
                  )}
                </div>

                {/* Total Reaction Counter */}
                <span className="text-[10px] font-bold text-white/80 shrink-0">
                  {Object.values(currentSlide.reactions).reduce(
                    (acc, arr) => acc + arr.length,
                    0
                  )}{' '}
                  Reaksi
                </span>
              </div>

              {/* Instagram Quick Emoji Reaction Picker Bar */}
              <div className="flex items-center justify-between bg-white/10 backdrop-blur-xl px-3 py-2 rounded-full border border-white/15">
                <span className="text-[10px] font-bold text-white/70 pl-1 pr-2 hidden sm:inline">
                  Kirim Reaksi:
                </span>
                <div className="flex items-center justify-around flex-1 gap-1">
                  {QUICK_EMOJIS.map((emoji) => {
                    const reactors = currentSlide.reactions[emoji] || [];
                    const isMine = reactors.some(
                      (u) => u.toLowerCase() === currentUserName.toLowerCase()
                    );
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleToggleReaction(emoji)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-lg transition-transform hover:scale-125 active:scale-90 cursor-pointer ${
                          isMine
                            ? 'bg-white/25 ring-2 ring-pink-400 scale-110'
                            : 'hover:bg-white/15'
                        }`}
                        title={`Reaksi ${emoji}`}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: UPLOAD STORY MODAL (MAX 3X PER DAY PER USER)
          ========================================================================= */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[9600] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#FEDA77] via-[#DD2A7B] to-[#8134AF] p-[2px]">
                  <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-[#DD2A7B]" />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Bagikan Cerita (Story)
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-500">
                    Kuota Hari Ini:{' '}
                    <span className="text-slate-900 font-extrabold">
                      {myTodayStories.length}/{MAX_STORIES_PER_DAY}
                    </span>{' '}
                    (Maks 3x/hari)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quota Progress Pills */}
            <div className="grid grid-cols-3 gap-1.5">
              {[0, 1, 2].map((slotIdx) => {
                const used = slotIdx < myTodayStories.length;
                return (
                  <div
                    key={slotIdx}
                    className={`py-1.5 px-2 rounded-xl border text-[10px] font-extrabold flex items-center justify-center gap-1 ${
                      used
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    <CheckCircle2
                      className={`w-3 h-3 ${
                        used ? 'text-emerald-600' : 'text-slate-300'
                      }`}
                    />
                    <span>Story #{slotIdx + 1}</span>
                  </div>
                );
              })}
            </div>

            {uploadError && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Hidden File Inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoFileChange}
              className="hidden"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoFileChange}
              className="hidden"
            />

            {remainingQuota > 0 ? (
              <form onSubmit={handlePublishStory} className="space-y-3.5">
                {/* Photo Preview or Camera/Gallery Picker */}
                {draftImage ? (
                  <div className="relative w-full h-56 rounded-2xl overflow-hidden bg-slate-900 border border-slate-200">
                    <img
                      src={draftImage}
                      alt="Preview Story"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setDraftImage('')}
                      className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/60 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                      <span>Ganti Foto</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={isProcessingPhoto}
                      className="flex flex-col items-center justify-center gap-2 py-7 px-3 rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50/50 hover:bg-teal-50 text-teal-800 transition cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-sm">
                        <Camera className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-extrabold">Ambil Kamera</span>
                      <span className="text-[10px] text-teal-600 font-medium">
                        Foto Langsung
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      disabled={isProcessingPhoto}
                      className="flex flex-col items-center justify-center gap-2 py-7 px-3 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 text-blue-800 transition cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-sm">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-extrabold">Pilih Galeri</span>
                      <span className="text-[10px] text-blue-600 font-medium">
                        Upload Gambar
                      </span>
                    </button>
                  </div>
                )}

                {/* Store / Location Tag & Caption */}
                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                      Lokasi / Cabang Toko
                    </label>
                    <input
                      type="text"
                      value={draftStoreTag}
                      onChange={(e) => setDraftStoreTag(e.target.value)}
                      placeholder="Contoh: FM Thamrin City"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                      Caption Story
                    </label>
                    <textarea
                      rows={2}
                      value={draftCaption}
                      onChange={(e) => setDraftCaption(e.target.value)}
                      placeholder="Tulis aktivitas visit atau update singkat..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!draftImage || isProcessingPhoto}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#DD2A7B] via-[#E1306C] to-[#F58529] hover:brightness-105 disabled:opacity-50 text-white font-black text-xs shadow-md transition active:scale-[0.98] cursor-pointer"
                >
                  {isProcessingPhoto
                    ? 'Memproses Foto...'
                    : `Bagikan ke Story (${myTodayStories.length + 1}/${MAX_STORIES_PER_DAY})`}
                </button>
              </form>
            ) : (
              <div className="space-y-3 pt-1">
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  Anda telah mengunggah <strong>3 Story</strong> hari ini. Sesuai kebijakan aplikasi, setiap karyawan maksimal mengunggah 3x story per hari.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUploadModal(false);
                      setActiveViewerGroupIdx(-1);
                      setActiveSlideIdx(0);
                      setSlideProgress(0);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
                  >
                    Lihat 3 Story Saya
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="py-2.5 px-4 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
