import { CloudOff } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { MainButtonHost } from './components/MainButton';
import { HOME_TOUR, OnboardingSlides, Tour } from './components/Onboarding';
import { StateView } from './components/StateView';
import { TabBar } from './components/TabBar';
import { TelegramChrome } from './components/TelegramChrome';
import { Toasts } from './components/Toasts';
import { Checkout } from './screens/Checkout';
import { Guide } from './screens/Guide';
import { JourneyMap } from './screens/JourneyMap';
import { BrandMark, Home } from './screens/Home';
import { Practice } from './screens/Practice';
import { PracticePlayer } from './screens/PracticePlayer';
import { Profile } from './screens/Profile';
import { Purchases } from './screens/Purchases';
import { Quiz } from './screens/Quiz';
import { Shop } from './screens/Shop';
import { SheetHost } from './sheets/SheetHost';
import { useApp } from './store/app';
import { useNav, type Route, type Tab } from './store/nav';
import { tg } from './telegram/webapp';

const TAB_SCREENS: Record<Tab, (p: { active: boolean }) => React.ReactNode> = {
  home: () => <Home />,
  practice: ({ active }) => <Practice active={active} />,
  shop: () => <Shop />,
  profile: () => <Profile />,
};

function RouteScreen({ route }: { route: Route }) {
  switch (route.name) {
    case 'quiz':
      return <Quiz />;
    case 'guide':
      return <Guide />;
    case 'practice':
      return <PracticePlayer id={route.id} />;
    case 'purchases':
      return <Purchases />;
    case 'map':
      return <JourneyMap />;
    case 'checkout':
      return <Checkout courseId={route.courseId} />;
  }
}

export function App() {
  const status = useApp((s) => s.status);
  const error = useApp((s) => s.error);
  const boot = useApp((s) => s.boot);

  useEffect(() => {
    void boot();
  }, [boot]);

  if (status === 'loading') return <Splash />;
  if (status === 'error')
    return (
      <div className="fullscreen-center">
        <StateView
          icon={<CloudOff size={24} />}
          title="Не удалось загрузить"
          text={error ?? 'Проверьте соединение и попробуйте ещё раз.'}
          action={{ label: 'Повторить', onClick: () => void boot() }}
        />
      </div>
    );
  return <Shell />;
}

type Intro = 'none' | 'slides' | 'tour';

/** Онбординг не показываем поверх диплинка (например, рекламной ссылки на тест). */
const DEEP_ROUTES = new Set(['quiz', 'guide']);

function Shell() {
  const onboarded = useApp((s) => s.onboarded);
  const setOnboarded = useApp((s) => s.setOnboarded);
  const [intro, setIntro] = useState<Intro>(() =>
    !useApp.getState().onboarded && !DEEP_ROUTES.has(useApp.getState().startParam ?? '') ? 'slides' : 'none',
  );

  // «Пройти обучение заново» из настроек
  useEffect(() => {
    if (!onboarded && intro === 'none' && useApp.getState().startParamConsumed) {
      useNav.getState().reset();
      setIntro('slides');
    }
  }, [onboarded]);

  const finishIntro = useCallback(() => {
    setOnboarded(true);
    setIntro('none');
  }, [setOnboarded]);

  const tab = useNav((s) => s.tab);
  const stack = useNav((s) => s.stack);
  const flushTaps = useApp((s) => s.flushTaps);

  // батчинг тапов: отправляем раз в 1.5 с и при сворачивании приложения
  useEffect(() => {
    const id = setInterval(() => void flushTaps(), 1500);
    const onHide = () => document.visibilityState === 'hidden' && void flushTaps();
    const onDeactivate = () => void flushTaps();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onDeactivate);
    tg?.onEvent('deactivated', onDeactivate);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onDeactivate);
      tg?.offEvent('deactivated', onDeactivate);
    };
  }, [flushTaps]);

  // диплинки: t.me/<bot>/<app>?startapp=quiz | guide | shop | practice | profile
  useEffect(() => {
    const param = useApp.getState().consumeStartParam();
    const nav = useNav.getState();
    if (param === 'quiz') nav.push({ name: 'quiz' });
    else if (param === 'guide') nav.push({ name: 'guide' });
    else if (param === 'shop' || param === 'practice' || param === 'profile') nav.setTab(param);
  }, []);

  return (
    <div className="app">
      {(Object.keys(TAB_SCREENS) as Tab[]).map((t) => (
        <div key={t} className="tab-layer" hidden={t !== tab}>
          {TAB_SCREENS[t]({ active: t === tab && stack.length === 0 })}
        </div>
      ))}
      {stack.map((r, i) => (
        <div key={i} className="route-layer" style={{ zIndex: 100 + i }}>
          <RouteScreen route={r} />
        </div>
      ))}
      <TabBar hidden={stack.length > 0} />
      {intro === 'slides' && (
        <OnboardingSlides
          onDone={() => {
            useNav.getState().reset();
            setIntro('tour');
          }}
          onSkip={finishIntro}
        />
      )}
      {intro === 'tour' && <Tour steps={HOME_TOUR} onDone={finishIntro} />}
      <SheetHost />
      <MainButtonHost />
      <Toasts />
      <TelegramChrome />
    </div>
  );
}

function Splash() {
  return (
    <div className="splash">
      <BrandMark size={64} />
      <div className="splash-name display">Атлас</div>
      <div className="splash-sub eyebrow">школа психологии</div>
      <div className="splash-line">
        <i />
      </div>
    </div>
  );
}
