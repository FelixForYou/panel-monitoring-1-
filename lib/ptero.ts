import type { ApiItem, PteroLocation, PteroNode, PteroServer, PteroUser } from './types';

function config() {
  const url = (process.env.PTERO_URL || '').trim().replace(/\/+$/, '');
  const key = (process.env.PTERO_API_KEY || '').trim();
  if (!url) throw new Error('PTERO_URL belum diisi.');
  if (!key) throw new Error('PTERO_API_KEY belum diisi.');
  if (!/^https?:\/\//i.test(url)) throw new Error('PTERO_URL harus diawali http:// atau https://');
  return { url, key };
}

async function request(path: string, init?: RequestInit) {
  const { url, key } = config();
  const started = Date.now();
  const res = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      Accept: 'Application/vnd.pterodactyl.v1+json',
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  const latency = Date.now() - started;
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      detail = body?.errors?.[0]?.detail || body?.message || detail;
    } catch {}
    throw new Error(detail);
  }

  if (res.status === 204) return { data: null, latency };
  const data = await res.json();
  return { data, latency };
}

async function fetchAll<T>(path: string): Promise<ApiItem<T>[]> {
  const separator = path.includes('?') ? '&' : '?';
  let page = 1;
  const all: ApiItem<T>[] = [];
  while (page <= 100) {
    const { data } = await request(`${path}${separator}per_page=100&page=${page}`);
    const items = Array.isArray(data?.data) ? data.data : [];
    all.push(...items);
    const totalPages = Number(data?.meta?.pagination?.total_pages || 1);
    if (page >= totalPages) break;
    page++;
  }
  return all;
}

export async function getSnapshot() {
  const started = Date.now();
  const [serversRaw, usersRaw, nodesRaw, locationsRaw] = await Promise.all([
    fetchAll<PteroServer>('/api/application/servers'),
    fetchAll<PteroUser>('/api/application/users'),
    fetchAll<PteroNode>('/api/application/nodes'),
    fetchAll<PteroLocation>('/api/application/locations'),
  ]);

  const servers = serversRaw.map((x) => x.attributes);
  const users = usersRaw.map((x) => x.attributes);
  const nodes = nodesRaw.map((x) => x.attributes);
  const locations = locationsRaw.map((x) => x.attributes);

  return {
    servers,
    users,
    nodes,
    locations,
    latency: Date.now() - started,
    panelUrl: config().url,
  };
}

export async function serverAction(id: number, action: 'suspend' | 'unsuspend' | 'reinstall') {
  return request(`/api/application/servers/${id}/${action}`, { method: 'POST' });
}

export async function deleteServer(id: number, force = false) {
  return request(`/api/application/servers/${id}${force ? '/force' : ''}`, { method: 'DELETE' });
}

export async function deleteUser(id: number) {
  return request(`/api/application/users/${id}`, { method: 'DELETE' });
}

export function explicitPowerState(server: PteroServer): string | null {
  // PTLA resmi tidak menjamin power-state runtime. Hanya percaya field eksplisit
  // bila panel/fork memang mengembalikannya. Jangan gunakan `status` karena itu
  // status lifecycle (installing/suspended/etc), bukan status power.
  const candidates = [server.power_state, server.current_state, server.state];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim().toLowerCase();
  }
  return null;
}
