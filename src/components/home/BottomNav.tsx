// ============= Full file contents =============

import { House, Mic, BarChart3, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
export type HomeTab = 'home' | 'practice' | 'stats';
export function BottomNav({ active, onChange, onSettings }: { active: HomeTab; onChange: (tab: HomeTab) => void; onSettings: () => void }) {
  const { t } = useTranslation();
  const tabs = [{ id: 'home', icon: House, label: t('nav.home') }, { id: 'practice', icon: Mic, label: t('nav.practice') }, { id: 'stats', icon: BarChart3, label: t('playful.stats') }, { id: 'settings', icon: Settings, label: t('nav.settingsShort') }] as const;
  return <nav className="bottom-nav" aria-label={t('nav.menu')}>{tabs.map(tab => <Button variant="ghost" key={tab.id} className={`bottom-nav__item ${active === tab.id ? 'is-active' : ''}`} aria-current={active === tab.id ? 'page' : undefined} onClick={() => tab.id === 'settings' ? onSettings() : onChange(tab.id)}><tab.icon /><span>{tab.label}</span></Button>)}</nav>;
}
