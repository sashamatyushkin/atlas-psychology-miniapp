import { useCallback, useEffect, useState } from 'react';
import { MainButtonSuppressed } from '../components/MainButton';
import { Sheet } from '../components/Sheet';
import { useNav, type Sheet as SheetRoute } from '../store/nav';
import { CourseCover, CourseSheetContent } from './CourseSheet';
import { BoostsSheet, DailySheet, TasksSheet } from './GameSheets';
import { PolicySheet, SettingsSheet } from './InfoSheets';
import { ProductCover, ProductSheetContent } from './ProductSheet';
import './sheets.css';

const LABELS: Record<SheetRoute['name'], string> = {
  product: 'Товар',
  course: 'Программа',
  boosts: 'Бусты',
  tasks: 'Задания',
  daily: 'Награда дня',
  settings: 'Настройки',
  policy: 'Конфиденциальность',
};

/** Рендерит текущий шит и держит его на экране во время анимации закрытия. */
export function SheetHost() {
  const sheet = useNav((s) => s.sheet);
  const closeSheet = useNav((s) => s.closeSheet);
  const [rendered, setRendered] = useState<SheetRoute | null>(sheet);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (sheet) {
      setRendered(sheet);
      setClosing(false);
      return;
    }
    if (!rendered) return;
    setClosing(true);
    const t = setTimeout(() => {
      setRendered(null);
      setClosing(false);
    }, 260);
    return () => clearTimeout(t);
  }, [sheet]);

  const onClose = useCallback(() => closeSheet(), [closeSheet]);

  if (!rendered) return null;

  const key = 'id' in rendered ? `${rendered.name}-${rendered.id}` : rendered.name;
  let cover = null;
  let content = null;
  switch (rendered.name) {
    case 'product':
      cover = <ProductCover id={rendered.id} />;
      content = <ProductSheetContent id={rendered.id} />;
      break;
    case 'course':
      cover = <CourseCover id={rendered.id} />;
      content = <CourseSheetContent id={rendered.id} />;
      break;
    case 'boosts':
      content = <BoostsSheet />;
      break;
    case 'tasks':
      content = <TasksSheet />;
      break;
    case 'daily':
      content = <DailySheet />;
      break;
    case 'settings':
      content = <SettingsSheet />;
      break;
    case 'policy':
      content = <PolicySheet />;
      break;
  }

  return (
    <Sheet key={key} label={LABELS[rendered.name]} onClose={onClose} closing={closing} cover={cover}>
      {/* во время анимации закрытия шит не должен управлять MainButton */}
      <MainButtonSuppressed.Provider value={closing}>{content}</MainButtonSuppressed.Provider>
    </Sheet>
  );
}
