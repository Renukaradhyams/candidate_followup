import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, WifiOff, X, CheckCircle2, Laptop } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function PWAController() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [hasUpdate, setHasUpdate] = useState<boolean>(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [checkingConnection, setCheckingConnection] = useState<boolean>(false);

  useEffect(() => {
    // 1. Detect Standalone Mode (Already installed as PWA app)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };
    checkStandalone();
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
    try {
      mediaQuery.addEventListener('change', handleMediaChange);
    } catch (e) {
      mediaQuery.addListener(handleMediaChange);
    }

    // 2. Listen for Chrome Install Prompt (beforeinstallprompt)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Only show install banner if not already installed and user hasn't explicitly dismissed this session
      const dismissed = sessionStorage.getItem('bsc_pwa_prompt_dismissed');
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
      setIsStandalone(true);
      console.log('[PWA] BSC Candidate CRM successfully installed.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // 3. Network Connectivity Listeners (Offline / Online)
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => {
      setIsOffline(false);
      // Auto-reconnect live data on network return
      console.log('[PWA] Network reconnected. Restoring live data connection.');
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    // 4. Service Worker Registration & Version Update Listener
    if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'development') {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('[PWA] Service Worker registered with scope:', registration.scope);

          // Check if there is already a waiting worker
          if (registration.waiting) {
            setWaitingWorker(registration.waiting);
            setHasUpdate(true);
          }

          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    console.log('[PWA] New version available.');
                    setWaitingWorker(installingWorker);
                    setHasUpdate(true);
                  }
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });

      // Handle controller change (SW update complete)
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Handle native install click
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] User accepted the install prompt');
        setShowInstallBanner(false);
      } else {
        console.log('[PWA] User dismissed the install prompt');
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.error('[PWA] Install prompt error:', err);
    }
  };

  // Handle SW Update Apply
  const handleUpdateRefresh = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  };

  // Manual Retry Connection handler
  const handleRetryConnection = async () => {
    setCheckingConnection(true);
    try {
      const res = await fetch('/health?ts=' + Date.now(), { method: 'GET', cache: 'no-store' });
      if (res.ok) {
        setIsOffline(false);
        window.location.reload();
      } else {
        setIsOffline(true);
      }
    } catch (e) {
      setIsOffline(true);
    } finally {
      setCheckingConnection(false);
    }
  };

  const handleDismissBanner = () => {
    setShowInstallBanner(false);
    sessionStorage.setItem('bsc_pwa_prompt_dismissed', 'true');
  };

  return (
    <>
      {/* ── 1. Chrome App Installation Banner (Shown if installable and not in standalone) ── */}
      {!isStandalone && showInstallBanner && deferredPrompt && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md bg-[#1E2D4E] text-white p-4 rounded-2xl shadow-2xl border border-[#C9952A]/40 z-[9999] animate-slide-up">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white p-1 flex-shrink-0 flex items-center justify-center shadow-md">
              <img src="/logo.png" alt="BSC Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                Install BSC Candidate CRM
                <span className="text-[10px] bg-[#C9952A] text-white px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                  Desktop App
                </span>
              </h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Install as a standalone desktop application for faster launch, full window experience, and quick desktop access.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleInstallClick}
                  className="px-4 py-2 bg-[#C9952A] hover:bg-[#b08120] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Install App
                </button>
                <button
                  onClick={handleDismissBanner}
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white font-medium text-xs rounded-xl transition-all"
                >
                  Not now
                </button>
              </div>
            </div>
            <button
              onClick={handleDismissBanner}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              aria-label="Close banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── 2. Service Worker Controlled Update Notification ── */}
      {hasUpdate && (
        <div className="fixed top-4 right-4 z-[99999] max-w-sm bg-emerald-950 text-emerald-100 p-4 rounded-2xl shadow-2xl border border-emerald-500/50 backdrop-blur-md animate-bounce-short">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-600/20 text-emerald-400 rounded-xl flex-shrink-0">
              <RefreshCw className="w-5 h-5 animate-spin" />
            </div>
            <div className="flex-1">
              <h5 className="text-xs font-black uppercase text-emerald-400 tracking-wider">New Version Available</h5>
              <p className="text-xs text-slate-200 mt-0.5">
                An updated version of BSC Candidate CRM has been deployed.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={handleUpdateRefresh}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg shadow transition-all flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh to update
                </button>
                <button
                  onClick={() => setHasUpdate(false)}
                  className="px-2 py-1.5 text-xs text-slate-300 hover:text-white font-medium"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. Offline Overlay / Screen Fallback (Requirement #6) ── */}
      {isOffline && (
        <div className="fixed inset-0 bg-[#1E2D4E]/85 backdrop-blur-md z-[999999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#e2dfd7] text-center animate-scale-in">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-inner">
              <WifiOff className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-[#1E2D4E] tracking-tight mb-2">
              You're offline
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6 font-medium">
              BSC Candidate CRM requires an internet connection to access live employee and candidate data.
            </p>
            <div className="space-y-3">
              <button
                onClick={handleRetryConnection}
                disabled={checkingConnection}
                className="w-full py-3 px-4 bg-[#1E2D4E] hover:bg-[#152038] text-white font-bold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${checkingConnection ? 'animate-spin' : ''}`} />
                {checkingConnection ? 'Checking network connection...' : 'Retry Connection'}
              </button>
              <p className="text-[11px] text-slate-400 font-semibold">
                Will automatically reconnect as soon as connectivity returns.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
