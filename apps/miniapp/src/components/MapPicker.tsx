import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TASHKENT_CENTER } from '@core';

type Point = { lat: number; lng: number };

const pinIcon = L.divIcon({ className: 'pin-wrap', html: '<div class="pin"></div>', iconSize: [30, 40], iconAnchor: [15, 38] });

export default function MapPicker({ value, onChange }: { value: Point | null; onChange: (p: Point) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView(value ?? TASHKENT_CENTER, value ? 16 : 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => cb.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
    map.current = m;
    return () => { m.remove(); map.current = null; marker.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !value) return;
    if (!marker.current) {
      marker.current = L.marker(value, { icon: pinIcon, draggable: true }).addTo(m);
      marker.current.on('dragend', () => { const p = marker.current!.getLatLng(); cb.current({ lat: p.lat, lng: p.lng }); });
    } else {
      marker.current.setLatLng(value);
    }
    if (m.getZoom() < 15) m.setView(value, 16);
  }, [value?.lat, value?.lng]);

  return <div className="map" data-test="map"><div ref={el} className="map-inner" /></div>;
}
