import { FileText, Moon, RotateCcw, Smartphone } from 'lucide-react';
import { api } from '../api';
import { config } from '../config';
import { SCHOOL } from '../domain/catalog';
import { useApp } from '../store/app';
import { useNav } from '../store/nav';
import { toast } from '../store/toast';
import { confirmDialog, haptic, isTelegram } from '../telegram/webapp';

export function SettingsSheet() {
  const haptics = useApp((s) => s.haptics);
  const setHaptics = useApp((s) => s.setHaptics);
  const scheme = useApp((s) => s.scheme);
  const backend = useApp((s) => s.backend);
  const resetDemo = useApp((s) => s.resetDemo);
  const { openSheet, closeSheet } = useNav();

  const onReset = async () => {
    if (!(await confirmDialog('Сбросить демо-прогресс? Баланс, покупки и результаты теста будут удалены.'))) return;
    await resetDemo();
    haptic.warning();
    toast('Прогресс сброшен');
    closeSheet();
  };

  return (
    <>
      <h2 className="sheet-title">Настройки</h2>
      <div className="card list settings-list">
        <button className="row" onClick={() => setHaptics(!haptics)} role="switch" aria-checked={haptics}>
          <div className="row-icon">
            <Smartphone size={18} />
          </div>
          <div className="row-main">
            <div className="row-title">Вибро-отклик</div>
            <div className="row-sub">Тактильная отдача при касаниях</div>
          </div>
          <span className={`switch ${haptics ? 'on' : ''}`} />
        </button>
        <div className="row">
          <div className="row-icon">
            <Moon size={18} />
          </div>
          <div className="row-main">
            <div className="row-title">Тема</div>
            <div className="row-sub">Как в Telegram · сейчас {scheme === 'dark' ? 'тёмная' : 'светлая'}</div>
          </div>
        </div>
        <button className="row" onClick={() => openSheet({ name: 'policy' })}>
          <div className="row-icon">
            <FileText size={18} />
          </div>
          <div className="row-main">
            <div className="row-title">Политика конфиденциальности</div>
          </div>
        </button>
        {api.canResetDemo && (
          <button className="row" onClick={onReset}>
            <div className="row-icon danger">
              <RotateCcw size={18} />
            </div>
            <div className="row-main">
              <div className="row-title">Сбросить демо-прогресс</div>
            </div>
          </button>
        )}
      </div>
      <p className="sheet-note subtle">
        {SCHOOL.fullName} · v{config.version}
        <br />
        {backend ? 'Сервер подключён' : 'Автономный режим: прогресс хранится в облаке Telegram'}
        {!isTelegram && ' · открыто в браузере'}
      </p>
    </>
  );
}

export function PolicySheet() {
  return (
    <div className="policy">
      <h2 className="sheet-title">Конфиденциальность</h2>
      <p className="muted">Коротко и честно о том, какие данные мы используем и зачем.</p>
      <h3>Что мы получаем</h3>
      <p>
        От Telegram — ваш ID, имя, username, язык и фото профиля. В приложении — имя для обращения, выбранную цель и ответы на
        тест «Карта внутреннего состояния». Мы не получаем номер телефона и не видим ваши переписки.
      </p>
      <h3>Зачем</h3>
      <p>
        Чтобы отправить гайд, сохранить прогресс и покупки, а также — с вашего согласия — чтобы куратор школы мог предложить
        подходящую программу. Ответы теста используются только для подбора рекомендаций.
      </p>
      <h3>Где хранится</h3>
      <p>
        Прогресс хранится в облачном хранилище Telegram и на защищённом сервере школы. Подлинность данных проверяется по
        криптографической подписи Telegram.
      </p>
      <h3>Ваши права</h3>
      <p>
        Вы можете в любой момент запросить выгрузку или удаление данных, написав куратору школы или боту команду /delete. Отозвать
        согласие на рассылку можно командой /stop.
      </p>
      <p className="subtle policy-note">Тест не является медицинской диагностикой и не заменяет консультацию специалиста.</p>
    </div>
  );
}
