'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Plus, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

    if (isStandalone) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      const hasSeenPrompt = localStorage.getItem('pwa-prompt-seen');
      if (!hasSeenPrompt) {
        setTimeout(() => setShowPrompt(true), 5000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (isIOSDevice) {
      const hasSeenPrompt = localStorage.getItem('pwa-prompt-seen');
      if (!hasSeenPrompt) {
        setTimeout(() => setShowPrompt(true), 5000);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      setShowTutorial(true);
      setShowPrompt(false);
      return;
    }

    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      localStorage.setItem('pwa-prompt-seen', 'true');
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const dismissPrompt = () => {
    localStorage.setItem('pwa-prompt-seen', 'true');
    setShowPrompt(false);
  };

  return (
    <>
      <AnimatePresence>
        {showPrompt && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm"
          >
            <Card className="p-4 shadow-xl border-primary/20 bg-background/95 backdrop-blur-sm">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Download className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">Install SplitFare</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add SplitFare to your home screen for a better experience.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={handleInstall} className="flex-1 h-8 text-xs">
                      Install
                    </Button>
                    <Button size="sm" variant="ghost" onClick={dismissPrompt} className="h-8 w-8 p-0">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {showTutorial && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end justify-center p-6"
            onClick={() => setShowTutorial(false)}
          >
            <motion.div
              initial={{ y: 50 }}
              animate={{ y: 0 }}
              className="bg-background rounded-2xl p-6 w-full max-w-md relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-4">
                <div className="text-center">
                  <h2 className="text-xl font-bold">Add to Home Screen</h2>
                  <p className="text-muted-foreground mt-1">Follow these steps to install SplitFare on your iPhone:</p>
                </div>
                
                <div className="space-y-4 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold">1</div>
                    <div className="flex-1 text-sm">
                      Tap the <Share className="w-4 h-4 inline mx-1" /> Share button in the browser toolbar.
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold">2</div>
                    <div className="flex-1 text-sm">
                      Scroll down and tap <Plus className="w-4 h-4 inline mx-1" /> &quot;Add to Home Screen&quot;.
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold">3</div>
                    <div className="flex-1 text-sm">
                      Tap &quot;Add&quot; in the top right corner.
                    </div>
                  </div>
                </div>

                <Button onClick={() => setShowTutorial(false)} className="w-full">
                  Got it
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
