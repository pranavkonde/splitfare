'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Zap, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function WelcomeScreen() {
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    const hasSeenWelcome = localStorage.getItem('pwa-welcome-seen');

    if (isStandalone && !hasSeenWelcome) {
      setShowWelcome(true);
    }
  }, []);

  const handleGetStarted = () => {
    localStorage.setItem('pwa-welcome-seen', 'true');
    setShowWelcome(false);
  };

  const features = [
    {
      icon: <Zap className="w-5 h-5 text-yellow-500" />,
      title: "Fast & Smooth",
      description: "Optimized for your mobile device."
    },
    {
      icon: <Shield className="w-5 h-5 text-blue-500" />,
      title: "Secure",
      description: "Built-in protection for your data."
    },
    {
      icon: <Users className="w-5 h-5 text-green-500" />,
      title: "Collaborative",
      description: "Easy to share with friends and family."
    }
  ];

  return (
    <AnimatePresence>
      {showWelcome && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-8 text-center"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-6"
          >
            <CheckCircle className="w-10 h-10 text-primary" />
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="space-y-4 max-w-sm"
          >
            <h1 className="text-3xl font-bold tracking-tight">Welcome to SplitFare</h1>
            <p className="text-muted-foreground">
              You&apos;ve successfully installed SplitFare as an app on your home screen.
            </p>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="grid gap-6 my-10 w-full max-w-sm"
          >
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-4 text-left p-4 rounded-xl border bg-card/50">
                <div className="mt-1">{feature.icon}</div>
                <div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-snug">{feature.description}</p>
                </div>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="w-full max-w-sm"
          >
            <Button onClick={handleGetStarted} size="lg" className="w-full h-14 text-lg font-semibold rounded-2xl shadow-lg shadow-primary/20">
              Get Started
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
