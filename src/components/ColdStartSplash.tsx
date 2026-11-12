import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import SplashWave from './SplashWave';
let completed = false;
export default function ColdStartSplash() {
  const [visible, setVisible] = useState(!completed);
  useEffect(() => { if (visible && Capacitor.isNativePlatform()) void SplashScreen.hide().catch(() => {}); }, [visible]);
  return visible ? <SplashWave onDone={() => { completed = true; setVisible(false); }}/> : null;
}