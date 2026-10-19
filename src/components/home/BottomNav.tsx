// ============= Full file contents =============

import { House, ListMusic, BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
export type HomeTab = 'home' | 'speeches' | 'stats';
export function BottomNav({ active, onChange }: { active: HomeTab; onChange: (tab: HomeTab) => void }) {
  const { t } = useTranslation();
  const tabs = [{ id: 'home', icon: House, label: t('nav.home') }, { id: 'speeches', icon: ListMusic, label: t('playful.mySpeeches') }, { id: 'stats', icon: BarChart3, label: t('playful.progress') }] as const;
  return <nav className="bottom-nav" aria-label={t('nav.menu')}>{tabs.map(tab => <Button variant="ghost" key={tab.id} className={`bottom-nav__item ${active === tab.id ? 'is-active' : ''}`} aria-current={active === tab.id ? 'page' : undefined} onClick={() => onChange(tab.id)}><tab.icon /><span>{tab.label}</span></Button>)}</nav>;
}
