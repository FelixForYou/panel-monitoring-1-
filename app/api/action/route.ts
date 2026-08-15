import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { deleteServer, deleteUser, explicitPowerState, getSnapshot, serverAction } from '@/lib/ptero';

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const type = String(body?.type || '');
  const id = Number(body?.id || 0);

  try {
    if (['suspend-server', 'unsuspend-server', 'reinstall-server'].includes(type)) {
      if (!id) throw new Error('ID server tidak valid.');
      const action = type.replace('-server', '') as 'suspend' | 'unsuspend' | 'reinstall';
      await serverAction(id, action);
      return NextResponse.json({ ok: true });
    }

    if (type === 'delete-server') {
      if (!id) throw new Error('ID server tidak valid.');
      await deleteServer(id, Boolean(body?.force));
      return NextResponse.json({ ok: true });
    }

    if (type === 'delete-user') {
      if (!id) throw new Error('ID user tidak valid.');
      const snap = await getSnapshot();
      const user = snap.users.find((u) => u.id === id);
      if (!user) throw new Error('User tidak ditemukan.');
      if (user.root_admin || user.id === 1) throw new Error('Admin panel dilindungi dan tidak boleh dihapus.');
      const ownsServer = snap.servers.some((s) => s.user === id);
      if (ownsServer) throw new Error('User masih memiliki server. Hapus/pindahkan server terlebih dahulu.');
      await deleteUser(id);
      return NextResponse.json({ ok: true });
    }

    if (type === 'cleanup-orphan-users') {
      const snap = await getSnapshot();
      const ownerIds = new Set(snap.servers.map((s) => s.user));
      const targets = snap.users.filter((u) => !u.root_admin && u.id !== 1 && !ownerIds.has(u.id));
      const deleted: number[] = [];
      const failed: Array<{ id: number; error: string }> = [];
      for (const user of targets) {
        try {
          await deleteUser(user.id);
          deleted.push(user.id);
        } catch (e) {
          failed.push({ id: user.id, error: e instanceof Error ? e.message : 'unknown' });
        }
      }
      return NextResponse.json({ ok: true, deleted, failed });
    }

    if (type === 'cleanup-offline-servers') {
      const snap = await getSnapshot();
      const targets = snap.servers.filter((s) => explicitPowerState(s) === 'offline');
      if (!targets.length) {
        return NextResponse.json({
          ok: false,
          error: 'Tidak ada server dengan status power OFF yang dapat diverifikasi dari PTLA. Server berstatus unknown tidak disentuh.',
        }, { status: 409 });
      }
      const deleted: number[] = [];
      const failed: Array<{ id: number; error: string }> = [];
      for (const server of targets) {
        try {
          await deleteServer(server.id, Boolean(body?.force));
          deleted.push(server.id);
        } catch (e) {
          failed.push({ id: server.id, error: e instanceof Error ? e.message : 'unknown' });
        }
      }
      return NextResponse.json({ ok: true, deleted, failed });
    }

    throw new Error('Action tidak dikenali.');
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Action gagal.' }, { status: 400 });
  }
}
