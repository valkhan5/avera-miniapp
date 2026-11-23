// Small cache so Done / OrderDetail render instantly after create_order or my_orders.
const cache = new Map<string, any>();
export const cacheOrders = (list: any[]) => { for (const o of list) cache.set(o.id, o); };
export const cachedOrder = (id: string) => cache.get(id) ?? null;
