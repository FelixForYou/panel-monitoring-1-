import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { explicitPowerState, getSnapshot } from '@/lib/ptero';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const snap = await getSnapshot();
    const serverCountByOwner = new Map<number, number>();
    for (const server of snap.servers) serverCountByOwner.set(server.user, (serverCountByOwner.get(server.user) || 0) + 1);

    const users = snap.users.map((u) => ({
      ...u,
      server_count: serverCountByOwner.get(u.id) || 0,
      protected: Boolean(u.root_admin || u.id === 1),
    }));

    const servers = snap.servers.map((s) => ({
      ...s,
      power_state: explicitPowerState(s) || 'unknown',
    }));

    const totalMemory = servers.reduce((n, s) => n + Number(s.limits?.memory || 0), 0);
    const totalDisk = servers.reduce((n, s) => n + Number(s.limits?.disk || 0), 0);
    const suspended = servers.filter((s) => s.suspended).length;
    const orphanUsers = users.filter((u) => !u.protected && u.server_count === 0).length;
    const explicitOffline = servers.filter((s) => s.power_state === 'offline').length;
    const powerKnown = servers.filter((s) => s.power_state !== 'unknown').length;

    return NextResponse.json({
      ...snap,
      users,
      servers,
      stats: {
        totalServers: servers.length,
        totalUsers: users.length,
        admins: users.filter((u) => u.root_admin).length,
        nodes: snap.nodes.length,
        suspended,
        orphanUsers,
        explicitOffline,
        powerKnown,
        allocatedMemoryMb: totalMemory,
        allocatedDiskMb: totalDisk,
      },
      capability: {
        ptlaOnly: true,
        runtimePowerReliable: powerKnown === servers.length && servers.length > 0,
        message: powerKnown === 0
          ? 'PTLA standar tidak menyediakan status power OFF/ON runtime. Bulk delete OFF hanya aktif bila panel/fork mengirim field power_state/current_state/state secara eksplisit.'
          : 'Sebagian status power terdeteksi dari respons API. Server berstatus unknown tidak pernah ikut bulk delete OFF.',
      },
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Gagal membaca panel.' }, { status: 502 });
  }
}
