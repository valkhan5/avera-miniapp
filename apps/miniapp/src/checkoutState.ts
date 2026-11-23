import { useCallback, useEffect, useState } from 'react';
import type { Fulfillment } from '@core';

export interface CheckoutForm {
  fulfillment: Fulfillment; promoCode: string; name: string; phone: string; recipient: string; cardText: string;
  address: string; landmark: string; point: { lat: number; lng: number } | null; date: string; slot: string; comment: string; clientToken: string;
}

const KEY = 'avera_checkout_v1';
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`.replace(/\./g, ''));
const blank = (): CheckoutForm => ({ fulfillment: 'delivery', promoCode: '', name: '', phone: '', recipient: '', cardText: '', address: '', landmark: '',
  point: null, date: '', slot: '', comment: '', clientToken: uuid() });

function load(): CheckoutForm {
  try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return blank(); }
}

export function useCheckout() {
  const [form, setForm] = useState<CheckoutForm>(load);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(form)); } catch { /* ignore */ } }, [form]);
  const set = useCallback(<K extends keyof CheckoutForm>(k: K, v: CheckoutForm[K]) => setForm((f) => ({ ...f, [k]: v })), []);
  /** After a successful order: keep contact details, start a fresh order. */
  const reset = useCallback(() => setForm((f) => ({ ...blank(), name: f.name, phone: f.phone, address: f.address, landmark: f.landmark, point: f.point })), []);
  return { form, set, setForm, reset };
}
