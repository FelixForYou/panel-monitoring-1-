'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Server = {
  id: number; name: string; identifier: string; uuid: string; user: number; node: number;
  suspended: boolean; status?: string | null; power_state: string;
  limits?: { memory?: number; disk?: number; cpu?: number };
};
type User = { id: number; username: string; email: string; root_admin: boolean; server_count: number; protected: boolean; created_at?: string };
type Node = { id: number; name: string; fqdn: string; scheme?: string; maintenance_mode?: boolean; memory?: number; disk?: number };
type Payload = {
  panelUrl: string; latency: number; fetchedAt: string; servers: Server[]; users: User[]; nodes: Node[];
  stats: { totalServers: number; totalUsers: number; admins: number; nodes: number; suspended: number; orphanUsers: number; explicitOffline: number; powerKnown: number; allocatedMemoryMb: number; allocatedDiskMb: number };
  capability: { runtimePowerReliable: boolean; message: string };
};

type View = 'overview' | 'servers' | 'users' | 'cleanup' | 'nodes' | 'activity';
type Activity = { at: string; text: string; ok: boolean };

const nav: Array<[View, string, string]> = [
  ['overview', 'Overview', '⌂'], ['servers', 'Servers', '▣'], ['users', 'Users', '◎'],
  ['cleanup', 'Cleanup', '⌁'], ['nodes', 'Nodes', '◇'], ['activity', 'Activity', '≡'],
];

function fmtMb(v = 0) {
  if (v >= 1024 * 1024) return `${(v / 1024 / 1024).toFixed(1)} TB`;
  if (v >= 1024) return `${(v / 1024).toFixed(1)} GB`;
  return `${Math.round(v)} MB`;
}
function dateFmt(v?: string) {
  if (!v) return '—';
  try { return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)); } catch { return v; }
}

export default function Home() {
  const [auth, setAuth] = useState<'loading' | 'in' | 'out'>('loading');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [view, setView] = useState<View>('overview');
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState('');
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem('fxhl_activity');
    if (raw) try { setActivities(JSON.parse(raw)); } catch {}
    fetch('/api/auth/status').then(r => r.json()).then(x => setAuth(x.authenticated ? 'in' : 'out')).catch(() => setAuth('out'));
  }, []);

  const addActivity = useCallback((text: string, ok: boolean) => {
    setActivities(prev => {
      const next = [{ at: new Date().toISOString(), text, ok }, ...prev].slice(0, 100);
      localStorage.setItem('fxhl_activity', JSON.stringify(next));
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/dashboard', { cache: 'no-store' });
      const x = await r.json();
      if (r.status === 401) { setAuth('out'); return; }
      if (!r.ok) throw new Error(x.error || 'Gagal memuat data panel.');
      setData(x);
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal memuat data.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (auth === 'in') load(); }, [auth, load]);

  async function login(e: FormEvent) {
    e.preventDefault(); setLoginError('');
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    const x = await r.json();
    if (!r.ok) return setLoginError(x.error || 'Login gagal.');
    setPassword(''); setAuth('in');
  }

  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); setAuth('out'); setData(null); }

  async function action(type: string, id?: number, label?: string, dangerous?: boolean) {
    if (dangerous) {
      const text = type === 'cleanup-orphan-users'
        ? `Hapus semua ${data?.stats.orphanUsers || 0} user tanpa server? Admin panel tetap dilindungi.`
        : type === 'cleanup-offline-servers'
          ? `Hapus semua server yang status OFF-nya benar-benar terverifikasi oleh API? Server unknown tidak disentuh.`
          : `Hapus ${label || 'item ini'} secara permanen?`;
      if (!window.confirm(text)) return;
    }
    const key = `${type}:${id || 'all'}`; setBusy(key); setError('');
    try {
      const r = await fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, id, force: false }) });
      const x = await r.json();
      if (!r.ok) throw new Error(x.error || 'Action gagal.');
      const message = label || type;
      addActivity(`${message}${x.deleted ? ` — ${x.deleted.length} item dihapus` : ''}`, true);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Action gagal.';
      addActivity(`${label || type}: ${msg}`, false); setError(msg);
    } finally { setBusy(''); }
  }

  const servers = useMemo(() => (data?.servers || []).filter(s => `${s.name} ${s.identifier} ${s.id}`.toLowerCase().includes(search.toLowerCase())), [data, search]);
  const users = useMemo(() => (data?.users || []).filter(u => `${u.username} ${u.email} ${u.id}`.toLowerCase().includes(search.toLowerCase())), [data, search]);
  const orphanUsers = useMemo(() => (data?.users || []).filter(u => !u.protected && u.server_count === 0), [data]);

  if (auth === 'loading') return <div className="splash"><div className="spinner"/><b>FXHL Ptero Monitor</b></div>;

  if (auth === 'out') return (
    <main className="loginPage">
      <div className="loginGlow" />
      <section className="loginCard">
        <div className="brand"><span className="brandMark">F</span><div><b>FXHL</b><small>PTERO MONITOR</small></div></div>
        <div className="loginCopy"><span className="eyebrow">PRIVATE CONTROL</span><h1>Panel monitoring tanpa agent.</h1><p>Hubungkan dashboard ke Pterodactyl hanya lewat domain panel + PTLA. API key tetap berada di server.</p></div>
        <form onSubmit={login}>
          <label>Password dashboard</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Masukkan password" autoFocus />
          {loginError && <div className="errorBox">{loginError}</div>}
          <button className="primary full" type="submit">Masuk dashboard <span>→</span></button>
        </form>
        <div className="loginFoot"><span className="dot green"/> PTLA server-side only</div>
      </section>
    </main>
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand side"><span className="brandMark">F</span><div><b>FXHL</b><small>PTERO MONITOR</small></div></div>
        <div className="sideLabel">WORKSPACE</div>
        <nav>{nav.map(([k, label, icon]) => <button key={k} className={view === k ? 'active' : ''} onClick={() => setView(k)}><span>{icon}</span>{label}{k === 'cleanup' && data && data.stats.orphanUsers > 0 && <i>{data.stats.orphanUsers}</i>}</button>)}</nav>
        <div className="sideBottom"><div className="connection"><span className="dot green"/><div><b>Connected</b><small>{data?.panelUrl?.replace(/^https?:\/\//, '') || 'Pterodactyl'}</small></div></div><button className="logout" onClick={logout}>Log out</button></div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><span className="mobileBrand">FXHL</span><h2>{nav.find(n => n[0] === view)?.[1]}</h2></div>
          <div className="topActions"><span className="health"><span className="dot green"/>{data ? `${data.latency} ms` : '...'}</span><button className="refresh" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : '↻ Refresh'}</button></div>
        </header>

        <div className="content">
          {error && <div className="errorBanner"><b>Request gagal</b><span>{error}</span><button onClick={() => setError('')}>×</button></div>}

          {view === 'overview' && <>
            <section className="hero"><div><span className="eyebrow">PTERODACTYL CONTROL CENTER</span><h1>Monitor panel. Bersihkan yang tidak terpakai.</h1><p>Semua kontrol menggunakan Application API (PTLA) dari backend dashboard.</p></div><div className="heroMeta"><small>Last sync</small><b>{data ? dateFmt(data.fetchedAt) : '—'}</b><small>{data?.panelUrl || '—'}</small></div></section>
            <section className="statsGrid">
              <Stat label="Total servers" value={data?.stats.totalServers || 0} sub={`${data?.stats.suspended || 0} suspended`} />
              <Stat label="Total users" value={data?.stats.totalUsers || 0} sub={`${data?.stats.admins || 0} admin protected`} />
              <Stat label="Nodes" value={data?.stats.nodes || 0} sub="registered nodes" />
              <Stat label="Cleanup" value={data?.stats.orphanUsers || 0} sub="users without server" accent />
            </section>
            <section className="twoCol">
              <div className="card"><CardHead title="Panel allocation" desc="Total limits dari seluruh server"/><div className="resourceRows"><Resource label="Memory allocated" value={fmtMb(data?.stats.allocatedMemoryMb || 0)} /><Resource label="Disk allocated" value={fmtMb(data?.stats.allocatedDiskMb || 0)} /><Resource label="Known power state" value={`${data?.stats.powerKnown || 0} / ${data?.stats.totalServers || 0}`} /></div></div>
              <div className="card"><CardHead title="Quick cleanup" desc="Aksi aman dengan proteksi admin"/><div className="quickList"><Quick title="User tanpa server" desc={`${data?.stats.orphanUsers || 0} kandidat, admin dikecualikan`} action="Review" onClick={() => setView('cleanup')} /><Quick title="Server suspended" desc={`${data?.stats.suspended || 0} server`} action="Open" onClick={() => setView('servers')} /><Quick title="Server OFF" desc={`${data?.stats.explicitOffline || 0} status OFF terverifikasi`} action="Review" onClick={() => setView('cleanup')} /></div></div>
            </section>
            <section className="card notice"><div className="noticeIcon">i</div><div><b>Mode PTLA-only</b><p>{data?.capability.message}</p></div></section>
          </>}

          {view === 'servers' && <section className="card tableCard"><TableTop title="Servers" desc={`${data?.stats.totalServers || 0} server terdaftar`} search={search} setSearch={setSearch}/><div className="tableWrap"><table><thead><tr><th>SERVER</th><th>OWNER ID</th><th>NODE</th><th>RESOURCE</th><th>STATE</th><th></th></tr></thead><tbody>{servers.map(s => <tr key={s.id}><td><div className="mainCell"><span className="serverIcon">▣</span><div><b>{s.name}</b><small>#{s.id} · {s.identifier}</small></div></div></td><td>#{s.user}</td><td>#{s.node}</td><td><div className="resourceMini"><span>{fmtMb(s.limits?.memory || 0)} RAM</span><small>{fmtMb(s.limits?.disk || 0)} disk · {s.limits?.cpu || 0}% CPU</small></div></td><td><StateBadge server={s}/></td><td><div className="rowActions">{s.suspended ? <button onClick={() => action('unsuspend-server', s.id, `Unsuspend ${s.name}`)} disabled={busy !== ''}>Unsuspend</button> : <button onClick={() => action('suspend-server', s.id, `Suspend ${s.name}`)} disabled={busy !== ''}>Suspend</button>}<button className="dangerText" onClick={() => action('delete-server', s.id, `server ${s.name}`, true)} disabled={busy !== ''}>Delete</button></div></td></tr>)}{!servers.length && <Empty col={6} text="Server tidak ditemukan."/>}</tbody></table></div></section>}

          {view === 'users' && <section className="card tableCard"><TableTop title="Users" desc="Admin panel otomatis dilindungi" search={search} setSearch={setSearch}/><div className="tableWrap"><table><thead><tr><th>USER</th><th>ID</th><th>SERVERS</th><th>ROLE</th><th>CREATED</th><th></th></tr></thead><tbody>{users.map(u => <tr key={u.id}><td><div className="mainCell"><span className="avatar">{u.username.slice(0,1).toUpperCase()}</span><div><b>{u.username}</b><small>{u.email}</small></div></div></td><td>#{u.id}</td><td><span className={u.server_count === 0 ? 'countWarn' : ''}>{u.server_count}</span></td><td>{u.protected ? <span className="badge protected">Protected admin</span> : <span className="badge">User</span>}</td><td>{dateFmt(u.created_at)}</td><td>{!u.protected && u.server_count === 0 ? <button className="dangerText" onClick={() => action('delete-user', u.id, `user ${u.username}`, true)}>Delete</button> : <span className="muted">—</span>}</td></tr>)}{!users.length && <Empty col={6} text="User tidak ditemukan."/>}</tbody></table></div></section>}

          {view === 'cleanup' && <>
            <section className="pageIntro"><div><span className="eyebrow">SAFE CLEANUP</span><h1>Review sebelum hapus.</h1><p>Bulk action hanya menyentuh kandidat yang memenuhi syarat. Admin panel dan data berstatus unknown tidak dihapus.</p></div></section>
            <section className="cleanupGrid">
              <div className="cleanupCard"><div className="cleanupTop"><span className="cleanupIcon">◎</span><span className="badge warn">{orphanUsers.length} candidate</span></div><h3>User tanpa server</h3><p>User non-admin yang tidak memiliki server sebagai owner.</p><div className="candidateList">{orphanUsers.slice(0,5).map(u => <div key={u.id}><span>{u.username}<small>{u.email}</small></span><b>#{u.id}</b></div>)}{orphanUsers.length > 5 && <small>+ {orphanUsers.length - 5} user lainnya</small>}{!orphanUsers.length && <small>Tidak ada kandidat.</small>}</div><button className="danger full" disabled={!orphanUsers.length || busy !== ''} onClick={() => action('cleanup-orphan-users', undefined, 'Cleanup orphan users', true)}>{busy === 'cleanup-orphan-users:all' ? 'Deleting…' : `Delete ${orphanUsers.length} orphan users`}</button></div>
              <div className="cleanupCard"><div className="cleanupTop"><span className="cleanupIcon">▣</span><span className="badge warn">{data?.stats.explicitOffline || 0} verified OFF</span></div><h3>Server OFF</h3><p>Hanya server dengan field power state eksplisit <b>offline</b>. <code>unknown</code> selalu dilewati.</p><div className="capBox"><b>PTLA limitation</b><span>{data?.capability.message}</span></div><button className="danger full" disabled={!data?.stats.explicitOffline || busy !== ''} onClick={() => action('cleanup-offline-servers', undefined, 'Cleanup OFF servers', true)}>{busy === 'cleanup-offline-servers:all' ? 'Deleting…' : `Delete ${data?.stats.explicitOffline || 0} verified OFF servers`}</button></div>
            </section>
          </>}

          {view === 'nodes' && <section className="nodesGrid">{(data?.nodes || []).map(n => <div className="nodeCard" key={n.id}><div className="nodeHead"><span className="nodeIcon">◇</span><span className={`badge ${n.maintenance_mode ? 'warn' : 'ok'}`}>{n.maintenance_mode ? 'Maintenance' : 'Registered'}</span></div><h3>{n.name}</h3><p>{n.scheme || 'https'}://{n.fqdn}</p><div className="nodeFacts"><div><small>Memory capacity</small><b>{fmtMb(n.memory || 0)}</b></div><div><small>Disk capacity</small><b>{fmtMb(n.disk || 0)}</b></div><div><small>Node ID</small><b>#{n.id}</b></div></div></div>)}{!data?.nodes?.length && <div className="card emptyStandalone">Node tidak ditemukan.</div>}</section>}

          {view === 'activity' && <section className="card"><CardHead title="Local activity" desc="Riwayat aksi dashboard ini disimpan di browser perangkat ini"/><div className="activityList">{activities.map((a,i) => <div key={`${a.at}-${i}`}><span className={`activityDot ${a.ok ? 'ok' : 'bad'}`}/><div><b>{a.text}</b><small>{dateFmt(a.at)}</small></div></div>)}{!activities.length && <div className="emptyActivity">Belum ada aksi yang dijalankan.</div>}</div></section>}
        </div>

        <nav className="mobileNav">{nav.slice(0,5).map(([k,label,icon]) => <button key={k} className={view === k ? 'active' : ''} onClick={() => setView(k)}><span>{icon}</span><small>{label}</small></button>)}</nav>
      </main>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: number; sub: string; accent?: boolean }) { return <div className={`stat ${accent ? 'accent' : ''}`}><div className="statTop"><span>{label}</span><i>↗</i></div><strong>{value}</strong><small>{sub}</small></div> }
function CardHead({ title, desc }: { title: string; desc: string }) { return <div className="cardHead"><div><h3>{title}</h3><p>{desc}</p></div></div> }
function Resource({ label, value }: { label: string; value: string }) { return <div className="resourceRow"><span>{label}</span><b>{value}</b></div> }
function Quick({ title, desc, action, onClick }: { title: string; desc: string; action: string; onClick: () => void }) { return <div className="quick"><div><b>{title}</b><small>{desc}</small></div><button onClick={onClick}>{action} →</button></div> }
function TableTop({ title, desc, search, setSearch }: { title: string; desc: string; search: string; setSearch: (v: string) => void }) { return <div className="tableTop"><div><h3>{title}</h3><p>{desc}</p></div><div className="search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..."/></div></div> }
function Empty({ col, text }: { col: number; text: string }) { return <tr><td colSpan={col}><div className="empty">{text}</div></td></tr> }
function StateBadge({ server }: { server: Server }) { if (server.suspended) return <span className="badge warn">Suspended</span>; if (server.power_state === 'offline') return <span className="badge off">Offline</span>; if (server.power_state !== 'unknown') return <span className="badge ok">{server.power_state}</span>; return <span className="badge unknown">Power unknown</span> }
