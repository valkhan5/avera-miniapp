import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { buildTag, formatSum, miniAppLink } from '@core';
import { sb } from '../supabase';
import { BOT_USERNAME } from '../config';
import { PageHead } from '../components/ui';

const SOURCES = [['ig', 'Instagram'], ['tg', 'Telegram'], ['qr', 'QR-код'], ['other', 'Другое']];
const CHANNELS = [['dm', 'Директ'], ['bio', 'Шапка профиля'], ['story', 'Сторис'], ['ret', 'Ретаргет'], ['ad', 'Реклама'], ['channel', 'Канал'], ['store', 'Шоурум'], ['box', 'Вкладыш в боксе']];

export function Tags() {
  const [src, setSrc] = useState('ig');
  const [ch, setCh] = useState('dm');
  const [detail, setDetail] = useState('boks');
  const [qr, setQr] = useState('');
  const [stats, setStats] = useState<any[]>([]);
  const [attr, setAttr] = useState<'last' | 'first'>('last');
  const tag = useMemo(() => buildTag([src, ch, detail]), [src, ch, detail]);
  const link = miniAppLink(BOT_USERNAME, tag);
  useEffect(() => { void QRCode.toDataURL(link, { width: 480, margin: 1, color: { dark: '#39271D', light: '#FFFFFF' } }).then(setQr); }, [link]);
  useEffect(() => {
    void sb.rpc('dashboard', { p_from: '2026-11-01T00:00:00+05:00', p_to: new Date(Date.now() + 86400000).toISOString(), p_attr: attr }).then(({ data }) => setStats((data as any)?.by_tag ?? []));
  }, [attr]);
  return (
    <div>
      <PageHead eyebrow="05 · МЕТКИ" title="Метки и ссылки" />
      <div className="tag-gen">
        <div className="form">
          <div className="grid3">
            <label className="field"><span>Источник</span><select className="input" value={src} onChange={(e) => setSrc(e.target.value)}>{SOURCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label className="field"><span>Канал</span><select className="input" value={ch} onChange={(e) => setCh(e.target.value)}>{CHANNELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label className="field"><span>Детали</span><input className="input" value={detail} placeholder="boks, 1207, car1…" onChange={(e) => setDetail(e.target.value)} /></label>
          </div>
          <div className="link-box"><small>Метка</small><b>{tag}</b><small>Ссылка</small><code>{link}</code></div>
          <div className="form-actions">
            <button className="btn primary" onClick={() => void navigator.clipboard.writeText(link)}>Скопировать ссылку</button>
            {qr && <a className="btn" href={qr} download={`qr-${tag}.png`}>Скачать QR</a>}
          </div>
        </div>
        {qr && <img className="qr" src={qr} alt={`QR ${tag}`} />}
      </div>
      <div className="page-head small">
        <h3 className="sub">Статистика по меткам</h3>
        <div className="seg"><button className={attr === 'last' ? 'on' : ''} onClick={() => setAttr('last')}>Последняя метка</button><button className={attr === 'first' ? 'on' : ''} onClick={() => setAttr('first')}>Первая метка</button></div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Метка</th><th className="num">Лиды</th><th className="num">Заявки</th><th className="num">Продажи</th><th className="num">Выручка</th></tr></thead>
          <tbody>{stats.map((r) => <tr key={r.tag}><td>{r.tag}</td><td className="num">{r.leads}</td><td className="num">{r.requests}</td><td className="num">{r.sales}</td><td className="num">{formatSum(r.revenue, 'ru')}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
