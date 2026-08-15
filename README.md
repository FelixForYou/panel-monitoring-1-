# FXHL Ptero Monitor

Dashboard monitoring & cleanup Pterodactyl yang hanya membutuhkan **domain panel + Application API key (PTLA)**. Cocok untuk Vercel karena semua request ke PTLA dilakukan dari route server-side Next.js; key tidak dikirim ke browser.

## Fitur

- Dashboard statistik server, user, node, alokasi RAM/disk, suspended server.
- Daftar server + search.
- Suspend / unsuspend server.
- Delete server manual dengan konfirmasi.
- Daftar user + proteksi admin panel.
- Deteksi user tanpa server.
- Bulk delete user tanpa server, otomatis mengecualikan `root_admin` dan User ID `1`.
- Daftar node dan kapasitas terdaftar.
- Health/latency API.
- Activity log lokal di browser.
- UI responsive desktop/mobile.
- PTLA disimpan server-side, tidak memakai `NEXT_PUBLIC_`.

## Penting: status server OFF

Application API (PTLA) Pterodactyl menyediakan route admin untuk server/user/node dan aksi suspend/delete, tetapi **tidak menjamin status power runtime ON/OFF** pada daftar server. Karena itu dashboard ini tidak menebak status OFF dari field `status`.

Fitur **Delete Server OFF** hanya akan aktif jika panel/fork kamu benar-benar mengembalikan field runtime eksplisit seperti `power_state`, `current_state`, atau `state` dengan nilai `offline`. Server dengan state `unknown` tidak akan dihapus oleh bulk cleanup.

Ini sengaja dibuat aman agar server aktif tidak terhapus karena salah interpretasi.

## Deploy ke Vercel

1. Upload folder ini ke GitHub.
2. Import repository ke Vercel.
3. Tambahkan Environment Variables:

```env
PTERO_URL=https://panel.example.com
PTERO_API_KEY=ptla_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ADMIN_PASSWORD=password-dashboard-kamu
SESSION_SECRET=random-string-panjang-minimal-32-karakter
```

4. Deploy.

## Menjalankan lokal

```bash
cp .env.example .env.local
npm install
npm run dev
```

Buka `http://localhost:3000`.

## API key

Gunakan Application API key dari akun admin Pterodactyl. Jangan menaruh PTLA di frontend, source publik, screenshot, atau variable bernama `NEXT_PUBLIC_*`.

## Proteksi penghapusan user

Backend memeriksa ulang kondisi sebelum delete:

- `root_admin === true` => tidak boleh dihapus.
- User ID `1` => tidak boleh dihapus.
- User masih menjadi owner server => tidak boleh dihapus.

Jadi proteksi tidak hanya bergantung pada tombol UI.
