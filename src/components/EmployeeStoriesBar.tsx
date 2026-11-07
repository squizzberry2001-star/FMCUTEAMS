import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  X,
  Camera,
  Trash2,
  MapPin,
  AlertCircle,
  Heart,
  Eye,
  RefreshCw,
  Send,
  CalendarCheck,
  Cloud,
  ExternalLink,
} from 'lucide-react';
import { ScheduleAgenda, User } from '../types';
import {
  FMCU_GDRIVE_FOLDER_ID,
  FMCU_GDRIVE_FOLDER_URL,
  saveStoriesToIdb,
  loadStoriesFromIdb,
  uploadStoryToGasGDrive,
  fetchActiveStoriesFromGasGDrive,
  syncStoryReactionToGasGDrive,
  syncStoryViewToGasGDrive,
  deleteStoryFromGasGDrive,
} from '../utils/gdriveGasSync';
import { PageTransitionLoader } from './PageTransitionLoader';

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
  createdAtMs: number; // Epoch ms when story was created
  expiresAtMs: number; // Epoch ms when story expires (createdAtMs + 24 hours)
  driveFileId?: string;
  driveFolderId?: string;
  driveUrl?: string;
  gdriveSynced?: boolean;
  /** Map of emoji -> array of userNames who reacted (max 1 reaction per user per slide) */
  reactions: Record<string, string[]>;
  /** Array of other userNames who have viewed this story slide */
  views: string[];
}

interface EmployeeStoriesBarProps {
  currentUser?: User | null;
  agendas?: ScheduleAgenda[];
  users?: User[];
}

const MAX_STORIES_PER_DAY = 3;
const STORY_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours (Instagram standard)
const QUICK_EMOJIS = ['❤️', '🔥', '👏', '😍', '👍', '🙌', '🚀', '💯'];
const STORAGE_KEY = 'fmcu_employee_stories_v2';
const LEGACY_STORAGE_KEY = 'fmcu_employee_stories_v1';
const VIEWED_STORAGE_KEY = 'fmcu_viewed_stories_v2';

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

const isStoryActive24h = (slide: StorySlide, nowMs: number = Date.now()): boolean => {
  if (!slide || slide.id.startsWith('seed-story-')) return false;
  const expiresAt =
    typeof slide.expiresAtMs === 'number'
      ? slide.expiresAtMs
      : typeof slide.createdAtMs === 'number'
      ? slide.createdAtMs + STORY_TTL_MS
      : 0;
  return expiresAt > nowMs;
};

/**
 * Find the single most-reacted emoji across a list of story slides.
 * Returns null if there are no reactions.
 */
const getTopReactedEmoji = (slides: StorySlide[]): string | null => {
  const counts: Record<string, number> = {};
  slides.forEach((slide) => {
    Object.entries(slide.reactions || {}).forEach(([emoji, reactors]) => {
      if (Array.isArray(reactors) && reactors.length > 0) {
        counts[emoji] = (counts[emoji] || 0) + reactors.length;
      }
    });
  });

  let topEmoji: string | null = null;
  let maxCount = 0;
  Object.entries(counts).forEach(([emoji, count]) => {
    if (count > maxCount) {
      maxCount = count;
      topEmoji = emoji;
    }
  });

  return topEmoji;
};

// Compress uploaded/captured image for smooth GDrive upload & local cache
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
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
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
  agendas = [],
}) => {
  const todayKey = getTodayDateKey();
  const currentUserName = currentUser?.name || 'User FMCU';
  const currentUserRole = currentUser?.role || 'Field Staff FMCU';
  const currentUserAvatar = currentUser?.avatar || '';
  const currentUserId = currentUserName.toLowerCase().replace(/\s+/g, '-');

  // Initialize stories without any dummy seed data & purge expired (>24h) stories
  const [stories, setStories] = useState<StorySlide[]>(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const nowMs = Date.now();
          return parsed
            .filter((s: StorySlide) => isStoryActive24h(s, nowMs))
            .map((s: StorySlide) => ({
              ...s,
              reactions: s.reactions || {},
              views: Array.isArray(s.views) ? s.views : [],
            }));
        }
      }
    } catch (e) {
      console.warn(e);
    }
    return [];
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

  // Load high-res stories from IndexedDB & Google Drive GAS on mount + periodic 24h prune
  useEffect(() => {
    let mounted = true;

    const loadAndSync = async () => {
      const nowMs = Date.now();
      const idbStories = await loadStoriesFromIdb();
      if (mounted && idbStories && idbStories.length > 0) {
        const validIdb = idbStories.filter((s) => isStoryActive24h(s, nowMs));
        setStories((prev) => {
          const map = new Map<string, StorySlide>();
          [...validIdb, ...prev.filter((s) => isStoryActive24h(s, nowMs))].forEach((item) => {
            if (!map.has(item.id)) map.set(item.id, item);
          });
          return Array.from(map.values()).sort((a, b) => b.createdAtMs - a.createdAtMs);
        });
      }

      const remoteStories = await fetchActiveStoriesFromGasGDrive();
      if (mounted && remoteStories && remoteStories.length > 0) {
        const validRemote = remoteStories.filter((s) => isStoryActive24h(s, nowMs));
        setStories((prev) => {
          const map = new Map<string, StorySlide>();
          [...validRemote, ...prev.filter((s) => isStoryActive24h(s, nowMs))].forEach((item) => {
            if (!map.has(item.id)) map.set(item.id, item);
          });
          return Array.from(map.values()).sort((a, b) => b.createdAtMs - a.createdAtMs);
        });
      }
    };

    loadAndSync();

    const timer = setInterval(() => {
      const nowMs = Date.now();
      setStories((prev) => {
        const active = prev.filter((s) => isStoryActive24h(s, nowMs));
        return active.length === prev.length ? prev : active;
      });
      loadAndSync();
    }, 30000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  // Save active stories to IndexedDB & localStorage
  useEffect(() => {
    saveStoriesToIdb(stories);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stories));
    } catch (e) {
      console.warn('Story localStorage full, persisted in IndexedDB & GDrive:', e);
    }
  }, [stories]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEWED_STORAGE_KEY, JSON.stringify(viewedStoryIds));
    } catch (e) {
      console.warn(e);
    }
  }, [viewedStoryIds]);

  // Active stories (within 24h)
  const activeStories = React.useMemo(() => {
    const nowMs = Date.now();
    return stories.filter((s) => isStoryActive24h(s, nowMs));
  }, [stories]);

  // Own active stories (within last 24h) sorted chronologically (Slide 1 -> Slide 2 -> Slide 3)
  const myActiveStories = React.useMemo(
    () =>
      activeStories
        .filter(
          (s) =>
            s.userId === currentUserId ||
            s.userName.toLowerCase() === currentUserName.toLowerCase()
        )
        .sort((a, b) => a.createdAtMs - b.createdAtMs),
    [activeStories, currentUserId, currentUserName]
  );

  // Other employees' active stories grouped by userName (no dummy stories)
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

    // Sort oldest-to-newest so each user's slides play in sequence 1 -> 2 -> 3
    const chronological = [...activeStories].sort((a, b) => a.createdAtMs - b.createdAtMs);

    chronological.forEach((s) => {
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
  }, [activeStories, currentUserId, currentUserName]);

  // Compute user's Actual Agendas for today (for Auto Agenda Actual caption)
  const myTodayAgendas = React.useMemo(() => {
    const matchesUser = (a: ScheduleAgenda) =>
      !a.pic ||
      a.pic.toLowerCase().includes(currentUserName.toLowerCase()) ||
      currentUserName.toLowerCase().includes(a.pic.toLowerCase());

    const exactToday = agendas.filter((a) => a.date === todayKey && matchesUser(a));
    if (exactToday.length > 0) return exactToday;

    const anyToday = agendas.filter((a) => a.date === todayKey);
    if (anyToday.length > 0) return anyToday.slice(0, 3);

    return agendas.filter(matchesUser).slice(0, 3);
  }, [agendas, todayKey, currentUserName]);

  const buildAutoAgendaCaption = (): { caption: string; storeTag: string } => {
    if (myTodayAgendas.length > 0) {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      let bestAgenda = myTodayAgendas[0];
      let bestDiff = Infinity;

      myTodayAgendas.forEach((ag) => {
        const [hh, mm] = (ag.time || '09:00').split(':').map(Number);
        if (!isNaN(hh) && !isNaN(mm)) {
          const diff = Math.abs(hh * 60 + mm - nowMinutes);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestAgenda = ag;
          }
        }
      });

      const actualTime = getCurrentWibTime();
      const caption = `${bestAgenda.title} — ${bestAgenda.location} (${actualTime})`;
      const storeTag = bestAgenda.location || bestAgenda.category || 'FMCU Field Activity';
      return { caption, storeTag };
    }

    return {
      caption: `Agenda Kunjungan Aktual • ${currentUserName} (${getCurrentWibTime()})`,
      storeTag: 'FMCU Field Activity',
    };
  };

  // Story Viewer State
  const [activeViewerGroupIdx, setActiveViewerGroupIdx] = useState<number | null>(null); // -1 for own stories, 0..N for otherUserGroups
  const [activeSlideIdx, setActiveSlideIdx] = useState<number>(0);
  const [slideProgress, setSlideProgress] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [showViewersList, setShowViewersList] = useState<boolean>(false);

  // Gesture tracking for Story Viewer (Tap vs Hold vs Swipe)
  const gestureRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    isDown: boolean;
  }>({
    startX: 0,
    startY: 0,
    startTime: 0,
    isDown: false,
  });

  // Floating emoji burst animation in viewer
  const [floatingBursts, setFloatingBursts] = useState<
    { id: number; emoji: string; left: number }[]
  >([]);

  // Full-Screen Camera & Edit Caption Modal State
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [draftImage, setDraftImage] = useState<string>('');
  const [draftCaption, setDraftCaption] = useState<string>('');
  const [draftStoreTag, setDraftStoreTag] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState<boolean>(false);
  const [isUploadingToGDrive, setIsUploadingToGDrive] = useState<boolean>(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [isCameraStreamActive, setIsCameraStreamActive] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const captionInputRef = useRef<HTMLTextAreaElement>(null);

  // Stop active WebRTC camera stream
  const stopCameraStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraStreamActive(false);
  };

  // Start live camera stream inside the Full-Screen Story Modal
  const startLiveCamera = async (facing: 'environment' | 'user' = cameraFacingMode) => {
    stopCameraStream();
    setUploadError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      cameraInputRef.current?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1080 },
          height: { ideal: 1920 },
        },
        audio: false,
      });
      mediaStreamRef.current = stream;
      setIsCameraStreamActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn('Live camera unavailable, falling back to native camera input:', err);
      setIsCameraStreamActive(false);
      cameraInputRef.current?.click();
    }
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  // Attach stream to video element whenever it mounts
  useEffect(() => {
    if (isCameraStreamActive && videoRef.current && mediaStreamRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isCameraStreamActive, showUploadModal, draftImage]);

  // Capture photo frame from live WebRTC video feed
  const handleCaptureLiveFrame = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      cameraInputRef.current?.click();
      return;
    }
    const canvas = document.createElement('canvas');
    const maxDim = 1080;
    let w = video.videoWidth;
    let h = video.videoHeight;
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
      if (cameraFacingMode === 'user') {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      setDraftImage(dataUrl);
      stopCameraStream();
    }
  };

  const handleSwitchCameraFacing = () => {
    const nextFacing = cameraFacingMode === 'environment' ? 'user' : 'environment';
    setCameraFacingMode(nextFacing);
    startLiveCamera(nextFacing);
  };

  // Determine currently active slides in viewer
  const currentViewerSlides: StorySlide[] = React.useMemo(() => {
    if (activeViewerGroupIdx === null) return [];
    if (activeViewerGroupIdx === -1) return myActiveStories;
    return otherUserGroups[activeViewerGroupIdx]?.slides || [];
  }, [activeViewerGroupIdx, myActiveStories, otherUserGroups]);

  const currentSlide = currentViewerSlides[activeSlideIdx] || null;

  // Mark current slide as viewed & record viewer name if viewing another user's story (+ sync to GDrive GAS)
  useEffect(() => {
    if (!currentSlide) return;

    if (!viewedStoryIds.includes(currentSlide.id)) {
      setViewedStoryIds((prev) => [...prev, currentSlide.id]);
    }

    const isOwnSlide =
      currentSlide.userId === currentUserId ||
      currentSlide.userName.toLowerCase() === currentUserName.toLowerCase();

    if (!isOwnSlide) {
      const existingViews = currentSlide.views || [];
      const alreadyRecorded = existingViews.some(
        (v) => v.toLowerCase() === currentUserName.toLowerCase()
      );
      if (!alreadyRecorded) {
        setStories((prev) =>
          prev.map((s) =>
            s.id === currentSlide.id
              ? { ...s, views: [...(s.views || []), currentUserName] }
              : s
          )
        );
        syncStoryViewToGasGDrive({
          storyId: currentSlide.id,
          viewerName: currentUserName,
        });
      }
    }
  }, [currentSlide?.id, currentUserId, currentUserName]);

  // Auto-advance progress bar in viewer (6 seconds per slide)
  useEffect(() => {
    if (activeViewerGroupIdx === null || !currentSlide || isPaused || showViewersList) return;

    const interval = setInterval(() => {
      setSlideProgress((prev) => Math.min(100, prev + 2)); // 50 ticks * 120ms = 6000ms
    }, 120);

    return () => clearInterval(interval);
  }, [activeViewerGroupIdx, activeSlideIdx, currentSlide, isPaused, showViewersList]);

  // Trigger next slide when progress reaches 100% (outside state updater to prevent double firing)
  useEffect(() => {
    if (slideProgress >= 100 && activeViewerGroupIdx !== null) {
      handleNextSlide(true);
    }
  }, [slideProgress, activeViewerGroupIdx]);

  const lastNavTimeRef = useRef<number>(0);

  const openOwnStoriesOrUpload = () => {
    if (myActiveStories.length > 0) {
      setActiveViewerGroupIdx(-1);
      setActiveSlideIdx(0);
      setSlideProgress(0);
      setShowViewersList(false);
    } else {
      handleOpenCameraAndCaptionModal();
    }
  };

  // Click '+' -> Immediately Auto Open Native System Camera synchronously
  const handleOpenCameraAndCaptionModal = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setUploadError(null);

    const autoAgenda = buildAutoAgendaCaption();
    setDraftCaption(autoAgenda.caption);
    setDraftStoreTag(autoAgenda.storeTag);

    if (myActiveStories.length >= MAX_STORIES_PER_DAY) {
      setUploadError(
        `Batas harian tercapai (${MAX_STORIES_PER_DAY}/${MAX_STORIES_PER_DAY} story dalam 24 jam). Maksimal upload 3x story per hari.`
      );
      setShowUploadModal(true);
      return;
    }

    // Directly trigger the device's Native System Camera synchronously within user click gesture
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
      cameraInputRef.current.click();
    } else {
      setShowUploadModal(true);
    }
  };

  const closeUploadModal = () => {
    stopCameraStream();
    setShowUploadModal(false);
    setDraftImage('');
    setUploadError(null);
  };

  const openEmployeeStoryGroup = (index: number) => {
    const group = otherUserGroups[index];
    if (!group || group.slides.length === 0) return;
    const firstUnviewedIdx = group.slides.findIndex((s) => !viewedStoryIds.includes(s.id));
    setActiveViewerGroupIdx(index);
    setActiveSlideIdx(firstUnviewedIdx >= 0 ? firstUnviewedIdx : 0);
    setSlideProgress(0);
    setShowViewersList(false);
  };

  const closeViewer = () => {
    setActiveViewerGroupIdx(null);
    setActiveSlideIdx(0);
    setSlideProgress(0);
    setShowViewersList(false);
  };

  const handleNextSlide = (isFromAutoTimer: boolean = false) => {
    if (activeViewerGroupIdx === null) return;
    const now = Date.now();
    if (!isFromAutoTimer && now - lastNavTimeRef.current < 200) return;
    lastNavTimeRef.current = now;

    setShowViewersList(false);
    if (activeSlideIdx < currentViewerSlides.length - 1) {
      setActiveSlideIdx((prev) => prev + 1);
      setSlideProgress(0);
    } else if (activeViewerGroupIdx === -1) {
      if (otherUserGroups.length > 0) {
        setActiveViewerGroupIdx(0);
        setActiveSlideIdx(0);
        setSlideProgress(0);
      } else {
        // Auto-close when tapping right on the very last story slide
        closeViewer();
      }
    } else if (activeViewerGroupIdx < otherUserGroups.length - 1) {
      setActiveViewerGroupIdx((prev) => (prev !== null ? prev + 1 : null));
      setActiveSlideIdx(0);
      setSlideProgress(0);
    } else {
      // Auto-close when tapping right on the very last story slide
      closeViewer();
    }
  };

  const handlePrevSlide = () => {
    if (activeViewerGroupIdx === null) return;
    const now = Date.now();
    if (now - lastNavTimeRef.current < 200) return;
    lastNavTimeRef.current = now;

    setShowViewersList(false);
    if (activeSlideIdx > 0) {
      setActiveSlideIdx((prev) => prev - 1);
      setSlideProgress(0);
    } else if (activeViewerGroupIdx > 0) {
      const prevGroupIdx = activeViewerGroupIdx - 1;
      const prevSlides = otherUserGroups[prevGroupIdx]?.slides || [];
      setActiveViewerGroupIdx(prevGroupIdx);
      setActiveSlideIdx(Math.max(0, prevSlides.length - 1));
      setSlideProgress(0);
    } else if (activeViewerGroupIdx === 0 && myActiveStories.length > 0) {
      setActiveViewerGroupIdx(-1);
      setActiveSlideIdx(Math.max(0, myActiveStories.length - 1));
      setSlideProgress(0);
    } else {
      setSlideProgress(0);
    }
  };

  // Requirement 4: Instagram-style swipe & tap gesture handlers (unified Pointer Events to prevent touch+mouse double-fire)
  const handlePointerDownCanvas = (clientX: number, clientY: number) => {
    gestureRef.current = {
      startX: clientX,
      startY: clientY,
      startTime: Date.now(),
      isDown: true,
    };
    setIsPaused(true);
  };

  const handlePointerUpCanvas = (
    clientX: number,
    clientY: number,
    containerRect: DOMRect
  ) => {
    if (!gestureRef.current.isDown) return;
    gestureRef.current.isDown = false;
    setIsPaused(false);

    const deltaX = clientX - gestureRef.current.startX;
    const deltaY = clientY - gestureRef.current.startY;
    const elapsed = Date.now() - gestureRef.current.startTime;

    // 1. Horizontal swipe left/right (Instagram slide change)
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) {
        handleNextSlide(false);
      } else {
        handlePrevSlide();
      }
      return;
    }

    // 2. Vertical swipe down (Instagram close viewer)
    if (deltaY > 85 && Math.abs(deltaY) > Math.abs(deltaX)) {
      closeViewer();
      return;
    }

    // 3. Quick tap (< 300ms and minimal movement) -> Left 32% prev, Right 68% next
    if (elapsed < 300 && Math.abs(deltaX) < 18 && Math.abs(deltaY) < 18) {
      const relativeX = clientX - containerRect.left;
      if (relativeX < containerRect.width * 0.32) {
        handlePrevSlide();
      } else {
        handleNextSlide(false);
      }
    }
  };

  // Requirement 1: React max 1x per story slide, but user can switch/change emoji freely (+ sync to GDrive GAS)
  const handleSelectReaction = (emoji: string) => {
    if (!currentSlide) return;

    const burstId = Date.now() + Math.random();
    const randomLeft = 22 + Math.floor(Math.random() * 56);
    setFloatingBursts((prev) => [...prev, { id: burstId, emoji, left: randomLeft }]);
    setTimeout(() => {
      setFloatingBursts((prev) => prev.filter((b) => b.id !== burstId));
    }, 1200);

    setStories((prev) =>
      prev.map((slide) => {
        if (slide.id !== currentSlide.id) return slide;

        const existingForTarget = slide.reactions[emoji] || [];
        const alreadyPickedThisEmoji = existingForTarget.some(
          (name) => name.toLowerCase() === currentUserName.toLowerCase()
        );

        const cleanedReactions: Record<string, string[]> = {};
        Object.entries(slide.reactions || {}).forEach(([em, usersList]) => {
          const filtered = usersList.filter(
            (name) => name.toLowerCase() !== currentUserName.toLowerCase()
          );
          if (filtered.length > 0) {
            cleanedReactions[em] = filtered;
          }
        });

        if (!alreadyPickedThisEmoji) {
          cleanedReactions[emoji] = [...(cleanedReactions[emoji] || []), currentUserName];
        }

        return {
          ...slide,
          reactions: cleanedReactions,
        };
      })
    );

    syncStoryReactionToGasGDrive({
      storyId: currentSlide.id,
      emoji,
      userName: currentUserName,
    });
  };

  // Handle selecting/capturing photo from native System Camera -> Open Full-Screen Edit Caption Modal
  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingPhoto(true);
    setUploadError(null);
    const autoAgenda = buildAutoAgendaCaption();
    setDraftCaption((prev) => prev || autoAgenda.caption);
    setDraftStoreTag((prev) => prev || autoAgenda.storeTag);
    setShowUploadModal(true);
    try {
      const compressed = await compressStoryImage(file);
      setDraftImage(compressed);
      stopCameraStream();
    } catch (err) {
      console.error(err);
      setUploadError('Gagal memuat foto. Silakan ambil ulang foto.');
    } finally {
      setIsProcessingPhoto(false);
      e.target.value = '';
    }
  };

  // Publish Story & Upload to Google Drive Folder (1IjruNS9pl5llP4k1VAlRNUhAvIEGql1a) via Google Apps Script
  const handlePublishStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (myActiveStories.length >= MAX_STORIES_PER_DAY) {
      setUploadError(
        `Anda sudah mencapai batas maksimal ${MAX_STORIES_PER_DAY}x upload story dalam 24 jam!`
      );
      return;
    }
    if (!draftImage) {
      setUploadError('Ambil foto terlebih dahulu untuk dibagikan ke Story.');
      return;
    }

    setIsUploadingToGDrive(true);
    const nowMs = Date.now();
    const autoFallback = buildAutoAgendaCaption();
    const newStory: StorySlide = {
      id: `story-${nowMs}`,
      userId: currentUserId,
      userName: currentUserName,
      userRole: currentUserRole,
      userAvatar: currentUserAvatar,
      imageUrl: draftImage,
      caption: draftCaption.trim() || autoFallback.caption,
      storeTag: draftStoreTag.trim() || autoFallback.storeTag,
      createdAt: getCurrentWibTime(),
      dateKey: todayKey,
      createdAtMs: nowMs,
      expiresAtMs: nowMs + STORY_TTL_MS,
      driveFolderId: FMCU_GDRIVE_FOLDER_ID,
      driveUrl: FMCU_GDRIVE_FOLDER_URL,
      gdriveSynced: false,
      reactions: {},
      views: [],
    };

    // Optimistic insert so story appears immediately
    const newSlideIndex = myActiveStories.length;
    setStories((prev) => [newStory, ...prev]);

    // Upload to Google Drive via Google Apps Script + show loading animation
    const [gdriveRes] = await Promise.all([
      uploadStoryToGasGDrive(newStory),
      new Promise((resolve) => setTimeout(resolve, 1400)),
    ]);
    setStories((prev) =>
      prev.map((s) =>
        s.id === newStory.id
          ? {
              ...s,
              driveFileId: gdriveRes.driveFileId,
              driveUrl: gdriveRes.driveUrl,
              gdriveSynced: gdriveRes.synced,
            }
          : s
      )
    );

    setIsUploadingToGDrive(false);
    stopCameraStream();
    setDraftImage('');
    setDraftCaption('');
    setShowUploadModal(false);

    // Immediately open viewer to show the newly posted story
    setTimeout(() => {
      setActiveViewerGroupIdx(-1);
      setActiveSlideIdx(newSlideIndex);
      setSlideProgress(0);
    }, 80);
  };

  const handleDeleteOwnStory = (storyId: string) => {
    setStories((prev) => prev.filter((s) => s.id !== storyId));
    deleteStoryFromGasGDrive(storyId);
    if (currentViewerSlides.length <= 1) {
      closeViewer();
    } else {
      setActiveSlideIdx((prev) => Math.max(0, prev - 1));
    }
  };

  const remainingQuota = Math.max(0, MAX_STORIES_PER_DAY - myActiveStories.length);
  const myTopEmoji = getTopReactedEmoji(myActiveStories);

  return (
    <>
      {/* Hidden Native Camera Input Fallback */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoFileChange}
        className="hidden"
      />

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
                  myActiveStories.length > 0
                    ? 'bg-gradient-to-tr from-[#FEDA77] via-[#DD2A7B] to-[#8134AF] shadow-sm'
                    : 'bg-gradient-to-tr from-slate-200 via-slate-300 to-slate-200'
                }`}
                title="Cerita Anda (Maks 3x / 24 Jam)"
              >
                <div className="w-full h-full rounded-full bg-white p-[2px] flex items-center justify-center overflow-hidden relative">
                  {myActiveStories.length > 0 ? (
                    <img
                      src={myActiveStories[0].imageUrl}
                      alt={currentUserName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    /* Silhouette Profile Picture User when no story uploaded yet */
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

              {/* Small Top-Reacted Single Emoji Badge at Bottom-Left (if own story has reactions) */}
              {myTopEmoji && (
                <span className="absolute -bottom-1 left-0 w-5 h-5 rounded-full bg-white border border-slate-200 shadow-xs text-[11px] flex items-center justify-center pointer-events-none">
                  {myTopEmoji}
                </span>
              )}

              {/* Instagram '+' Badge at Bottom-Right -> Auto Open Camera */}
              <button
                type="button"
                onClick={handleOpenCameraAndCaptionModal}
                className={`absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full flex items-center justify-center border-2 border-[#F8F9FD] shadow-md transition-transform active:scale-90 cursor-pointer ${
                  remainingQuota > 0
                    ? 'bg-gradient-to-tr from-[#0095F6] to-[#2563EB] text-white'
                    : 'bg-slate-400 text-white'
                }`}
                title={
                  remainingQuota > 0
                    ? `Buka Kamera & Buat Story (${remainingQuota} kuota tersisa)`
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

          {/* 2. Other Employees' Active Story Circles (Only shown when real stories exist) */}
          {otherUserGroups.map((group, idx) => {
            const hasUnviewed = group.slides.some((s) => !viewedStoryIds.includes(s.id));
            const firstName = group.userName.split(' ')[0];
            // Requirement 7: Small badge below story only displays 1 most-reacted emoji
            const topGroupEmoji = getTopReactedEmoji(group.slides);

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
                    <div className="w-full h-full rounded-full bg-white p-[2px] overflow-hidden flex items-center justify-center">
                      {group.userAvatar ? (
                        <img
                          src={group.userAvatar}
                          alt={group.userName}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-gradient-to-b from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden">
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
                  </div>

                  {/* Requirement 7: Small badge at bottom center displaying ONLY the 1 most-reacted emoji */}
                  {topGroupEmoji && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white/95 backdrop-blur-xs border border-slate-200/80 shadow-xs text-[11px] flex items-center justify-center pointer-events-none">
                      {topGroupEmoji}
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
          MODAL 1: FULL-SCREEN INSTAGRAM STORY VIEWER
          ========================================================================= */}
      {activeViewerGroupIdx !== null && currentSlide && (
        <div className="fixed inset-0 z-[9500] bg-black flex flex-col items-center justify-between p-2 sm:p-4 select-none animate-in fade-in duration-150">
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
                      className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden"
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
                    {currentSlide.userAvatar ? (
                      <img
                        src={currentSlide.userAvatar}
                        alt={currentSlide.userName}
                        className="w-full h-full rounded-full object-cover border border-black"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center text-white text-xs font-bold border border-black">
                        {currentSlide.userName.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold text-white truncate">
                        {currentSlide.userName}
                      </span>
                      <span className="text-[10px] text-white/70 font-light shrink-0">
                        • {currentSlide.createdAt}
                      </span>
                    </div>
                    {currentSlide.storeTag && (
                      <div className="flex items-center gap-1 text-[10px] text-teal-300 font-medium truncate">
                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{currentSlide.storeTag}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Requirement 3: In personal story, replace '+ Tambah' button with Eye icon & view count from other users */}
                  {activeViewerGroupIdx === -1 && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowViewersList((prev) => !prev);
                        }}
                        className="px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                        title="Jumlah dilihat oleh user lain"
                      >
                        <Eye className="w-3.5 h-3.5 text-teal-300" />
                        <span>{(currentSlide.views || []).length}</span>
                      </button>

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

            {/* 2. Story Photo Canvas (Instagram Swipe & Tap Gestures — NO Navigation Arrow Buttons) */}
            <div
              className="relative flex-1 my-2 rounded-3xl overflow-hidden bg-slate-950 border border-white/10 shadow-2xl flex items-center justify-center touch-pan-y cursor-pointer"
              onPointerDown={(e) => {
                e.stopPropagation();
                handlePointerDownCanvas(e.clientX, e.clientY);
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                handlePointerUpCanvas(
                  e.clientX,
                  e.clientY,
                  e.currentTarget.getBoundingClientRect()
                );
              }}
              onPointerCancel={() => {
                gestureRef.current.isDown = false;
                setIsPaused(false);
              }}
              onPointerLeave={() => {
                gestureRef.current.isDown = false;
                setIsPaused(false);
              }}
            >
              <img
                src={currentSlide.imageUrl}
                alt={currentSlide.caption}
                draggable={false}
                className="w-full h-full object-cover pointer-events-none select-none"
              />

              {/* Subtle bottom gradient for readability (no box on caption) */}
              <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 via-black/25 to-transparent pointer-events-none" />

              {/* Viewers List Popover (when clicking Eye icon on own story) */}
              {activeViewerGroupIdx === -1 && showViewersList && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-3 right-3 z-30 w-60 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-white/15 p-3 text-white shadow-xl space-y-2"
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
                    <span className="text-[11px] font-bold flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-teal-400" />
                      <span>Dilihat oleh ({(currentSlide.views || []).length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowViewersList(false)}
                      className="text-white/60 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {(currentSlide.views || []).length === 0 ? (
                    <p className="text-[11px] text-white/60 font-light">
                      Belum ada rekan kerja lain yang melihat story ini.
                    </p>
                  ) : (
                    <ul className="space-y-1 max-h-32 overflow-y-auto">
                      {(currentSlide.views || []).map((viewerName, i) => (
                        <li
                          key={viewerName + i}
                          className="text-[11px] font-medium text-white/90 truncate"
                        >
                          • {viewerName}
                        </li>
                      ))}
                    </ul>
                  )}

                  <a
                    href={currentSlide.driveUrl || FMCU_GDRIVE_FOLDER_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px] text-teal-300 hover:underline font-medium"
                  >
                    <span className="inline-flex items-center gap-1">
                      <Cloud className="w-3 h-3" />
                      <span>Tersimpan di Google Drive</span>
                    </span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

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

              {/* Requirement 2: Caption without background, positioned bottom-left, left-aligned, thin small text */}
              {currentSlide.caption && (
                <div className="absolute bottom-3 left-3.5 right-6 z-20 pointer-events-none text-left">
                  <p className="text-[11px] font-light text-white/95 text-left leading-relaxed tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
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
                    <span className="text-[11px] text-white/60 font-light flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 text-pink-400" />
                      <span>Belum ada reaksi emot</span>
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
                            onClick={() => {
                              if (activeViewerGroupIdx !== -1) {
                                handleSelectReaction(emoji);
                              }
                            }}
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold transition-all active:scale-90 cursor-pointer ${
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

              {/* Requirement 1: When viewing ANOTHER user's story, allow reacting (1x per user, changeable) */}
              {activeViewerGroupIdx !== -1 && (
                <div className="flex items-center justify-between bg-white/10 backdrop-blur-xl px-3 py-1.5 rounded-full border border-white/15">
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
                          onClick={() => handleSelectReaction(emoji)}
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-lg transition-transform hover:scale-125 active:scale-90 cursor-pointer ${
                            isMine
                              ? 'bg-white/25 ring-2 ring-pink-400 scale-110'
                              : 'hover:bg-white/15'
                          }`}
                          title={`Pilih Reaksi ${emoji} (Bisa ganti emot)`}
                        >
                          {emoji}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading Animation when sharing story */}
      <PageTransitionLoader visible={isUploadingToGDrive} delayMs={0} />

      {/* =========================================================================
          MODAL 2: FULL-SCREEN AUTO CAMERA & EDIT CAPTION AUTO AGENDA ACTUAL PAGE
          ========================================================================= */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[9600] bg-black text-white flex flex-col justify-between select-none animate-in fade-in duration-150">
          {/* Top Bar */}
          <div className="pt-[max(0.75rem,env(safe-area-inset-top,16px))] px-4 pb-2 flex items-center justify-between z-30 bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center">
                <Camera className="w-4 h-4 text-teal-300" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-white tracking-tight">
                  Buat Story Kunjungan Aktual
                </h3>
                <p className="text-[10px] text-white/70 font-light">
                  Kuota 24 Jam: {myActiveStories.length}/{MAX_STORIES_PER_DAY} • Auto GDrive & 24 Jam
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!draftImage && remainingQuota > 0 && (
                <button
                  type="button"
                  onClick={handleSwitchCameraFacing}
                  className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-white flex items-center justify-center cursor-pointer"
                  title="Putar Kamera Depan/Belakang"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={closeUploadModal}
                className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-white flex items-center justify-center cursor-pointer"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main Full-Screen Camera Viewfinder OR Captured Photo + Auto Agenda Caption Editor */}
          {remainingQuota <= 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center px-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="space-y-1 max-w-xs">
                <h4 className="text-base font-black text-white">
                  Kuota 3x Story Hari Ini Terpenuhi
                </h4>
                <p className="text-xs text-white/70 font-light leading-relaxed">
                  Setiap karyawan maksimal mengunggah 3 story dalam 24 jam. Story lama akan otomatis hilang setelah 24 jam.
                </p>
              </div>
              <button
                type="button"
                onClick={closeUploadModal}
                className="px-6 py-2.5 rounded-full bg-white text-slate-950 text-xs font-extrabold cursor-pointer"
              >
                Kembali
              </button>
            </div>
          ) : (
            <form
              onSubmit={handlePublishStory}
              className="flex-1 flex flex-col justify-between relative overflow-hidden"
            >
              {/* Full-Screen Viewport */}
              <div className="relative flex-1 mx-2 my-1 rounded-3xl overflow-hidden bg-slate-950 border border-white/15 flex items-center justify-center">
                {draftImage ? (
                  <>
                    <img
                      src={draftImage}
                      alt="Preview Story"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (cameraInputRef.current) {
                          cameraInputRef.current.value = '';
                          cameraInputRef.current.click();
                        }
                      }}
                      className="absolute top-3 right-3 z-30 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-teal-300" />
                      <span>Foto Ulang</span>
                    </button>
                  </>
                ) : isCameraStreamActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${
                      cameraFacingMode === 'user' ? 'scale-x-[-1]' : ''
                    }`}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#FEDA77] via-[#DD2A7B] to-[#8134AF] p-[3px] shadow-xl cursor-pointer"
                    >
                      <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
                        <Camera className="w-8 h-8 text-white" />
                      </div>
                    </button>
                    <p className="text-xs font-bold text-white">
                      Ketuk untuk Membuka Kamera Perangkat
                    </p>
                    <p className="text-[11px] font-light text-white/60 max-w-xs">
                      Foto otomatis tersimpan ke Google Drive Folder FMCU & hilang otomatis setelah 24 jam.
                    </p>
                  </div>
                )}

                {uploadError && (
                  <div className="absolute top-3 left-3 right-3 z-30 p-2.5 rounded-2xl bg-rose-600/90 backdrop-blur-md text-white text-[11px] font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* Bottom-Left Thin Small Caption Overlay & Auto Agenda Actual Editor */}
                <div className="absolute inset-x-0 bottom-0 pt-14 pb-3.5 px-3.5 bg-gradient-to-t from-black/85 via-black/45 to-transparent z-20 flex flex-col items-start text-left space-y-2">
                  {/* Quick Selector Pills if User Has Multiple Agendas Today */}
                  {myTodayAgendas.length > 0 && (
                    <div className="w-full flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-teal-300 shrink-0">
                        <CalendarCheck className="w-3 h-3" />
                        <span>Auto Agenda:</span>
                      </span>
                      {myTodayAgendas.slice(0, 4).map((ag) => {
                        const agText = `${ag.title} — ${ag.location} (${getCurrentWibTime()})`;
                        const isSelected = draftCaption.startsWith(`${ag.title} — ${ag.location}`);
                        return (
                          <button
                            key={ag.id}
                            type="button"
                            onClick={() => {
                              setDraftCaption(agText);
                              setDraftStoreTag(ag.location || ag.category);
                            }}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 transition cursor-pointer ${
                              isSelected
                                ? 'bg-teal-500 text-slate-950 font-bold'
                                : 'bg-white/15 text-white/85 hover:bg-white/25'
                            }`}
                          >
                            {ag.title}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Editable Thin Small Left-Aligned Caption (No Heavy Box) */}
                  <div className="w-full text-left">
                    <label className="block text-[9px] font-light uppercase tracking-wider text-white/60 mb-0.5">
                      Caption Story (Ketuk untuk edit agenda aktual):
                    </label>
                    <textarea
                      ref={captionInputRef}
                      rows={2}
                      value={draftCaption}
                      onChange={(e) => setDraftCaption(e.target.value)}
                      placeholder="Tulis caption agenda aktual..."
                      className="w-full bg-transparent text-[11px] font-light text-white/95 placeholder:text-white/40 text-left leading-relaxed tracking-wide focus:outline-none border-b border-white/20 focus:border-teal-400 resize-none py-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]"
                    />
                  </div>
                </div>
              </div>

              {/* Bottom Camera Shutter OR Publish Bar */}
              <div className="pb-[max(1rem,env(safe-area-inset-bottom,20px))] pt-2 px-5 flex items-center justify-between gap-3 z-30">
                {!draftImage ? (
                  <div className="w-full flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white text-[11px] font-semibold cursor-pointer"
                    >
                      Kamera Sistem
                    </button>

                    {/* Instagram-Style Shutter Button */}
                    <button
                      type="button"
                      onClick={handleCaptureLiveFrame}
                      disabled={isProcessingPhoto}
                      className="w-18 h-18 rounded-full p-1 border-4 border-white flex items-center justify-center active:scale-90 transition cursor-pointer"
                      title="Ambil Foto"
                    >
                      <span className="w-14 h-14 rounded-full bg-white block" />
                    </button>

                    <button
                      type="button"
                      onClick={() => captionInputRef.current?.focus()}
                      className="px-3.5 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white text-[11px] font-semibold cursor-pointer"
                    >
                      Edit Caption
                    </button>
                  </div>
                ) : (
                  <div className="w-full flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => captionInputRef.current?.focus()}
                      className="px-4 py-3 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-bold cursor-pointer"
                    >
                      Edit Caption
                    </button>

                    <button
                      type="submit"
                      disabled={isProcessingPhoto || isUploadingToGDrive}
                      className="flex-1 py-3 px-5 rounded-full bg-gradient-to-r from-[#DD2A7B] via-[#E1306C] to-[#F58529] hover:brightness-110 disabled:opacity-60 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {`Bagikan Story (${myActiveStories.length + 1}/${MAX_STORIES_PER_DAY})`}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
};
