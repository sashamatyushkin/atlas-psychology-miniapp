import { Home, ShoppingBag, Sparkles, User } from 'lucide-react';
import { haptic } from '../telegram/webapp';
import { useNav, type Tab } from '../store/nav';

const TABS: { id: Tab; label: string; Icon: typeof Home }[] = [
  { id: 'home', label: 'Главная', Icon: Home },
  { id: 'practice', label: 'Практика', Icon: Sparkles },
  { id: 'shop', label: 'Лавка', Icon: ShoppingBag },
  { id: 'profile', label: 'Профиль', Icon: User },
];

/** Плавающий стеклянный таббар (референс Panora). */
export function TabBar({ hidden }: { hidden: boolean }) {
  const tab = useNav((s) => s.tab);
  const setTab = useNav((s) => s.setTab);
  return (
    <nav className={`tabbar glass ${hidden ? 'hidden' : ''}`} aria-label="Навигация">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`tab ${tab === id ? 'active' : ''}`}
          onClick={() => {
            if (tab !== id) haptic.select();
            setTab(id);
          }}
          aria-current={tab === id ? 'page' : undefined}
        >
          <Icon size={20} strokeWidth={tab === id ? 2.2 : 1.8} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
