import icon from '@brand/logos/avera-icon.svg';
import { BOT_USERNAME } from '../config';
import { translate } from '../i18n';
import { useStore } from '../store';

export function Loading() {
  return <div className="center-screen"><img className="pulse" src={icon} alt="AVERA" width={56} /></div>;
}

export function ErrorScreen() {
  const { t, reload } = useStore();
  return (
    <div className="center-screen">
      <img src={icon} alt="" width={48} />
      <h2>{t('error_title')}</h2>
      <p>{t('error_text')}</p>
      <button className="btn-secondary" onClick={() => void reload()}>{t('retry')}</button>
    </div>
  );
}

export function OpenInTelegram() {
  return (
    <div className="center-screen" data-test="open-in-telegram">
      <img src={icon} alt="AVERA" width={56} />
      <h2>{translate('uz', 'open_in_tg_title')}</h2>
      <p>{translate('uz', 'open_in_tg_text')}</p>
      <h2 className="second">{translate('ru', 'open_in_tg_title')}</h2>
      <p>{translate('ru', 'open_in_tg_text')}</p>
      <a className="btn-primary link" href={`https://t.me/${BOT_USERNAME}?startapp`}>{translate('uz', 'open_in_tg_button')} · {translate('ru', 'open_in_tg_button')}</a>
    </div>
  );
}
