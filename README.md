# BUILDPRO - Modul 1-5

Monorepo:
- `packages/shared` : skema Zod & tipe bersama
- `apps/api`        : NestJS + Prisma + PostgreSQL (port 3000)
- `apps/web`        : Next.js dashboard admin/owner (port 3001)
- `apps/mobile`     : Expo (React Native) untuk mandor. Berdiri sendiri, TIDAK termasuk npm workspaces.

## Setup backend + web
```bash
npm install                                   # dari root
npm run db:up                                 # PostgreSQL via Docker (atau Postgres lokal)

# macOS/Linux:
cp apps/api/.env.example apps/api/.env        # isi JWT_SECRET
cp apps/web/.env.example apps/web/.env.local

# Windows CMD (WAJIB backslash):
#   copy apps\api\.env.example apps\api\.env
#   copy apps\web\.env.example apps\web\.env.local

npm run build:shared                          # wajib; ulangi bila apps/shared berubah
cd apps/api
npx prisma validate                            # cek schema dulu
npx prisma generate
npx prisma migrate dev --name modul_5          # skema bertambah (sewa alat, SPK & opname)
npm run prisma:seed                           # owner@demo.com & mandor@demo.com / password123
npm run start:dev                             # API -> http://localhost:3000/api

cd ../web && npm run dev                      # Web -> http://localhost:3001
```
Jika database sudah berisi data Modul 1-2 dan Anda tidak butuh datanya, paling mudah `npx prisma migrate reset`.

## Setup mobile (Expo)
```bash
cd apps/mobile
npm install
npm run setup                  # memasang paket Expo dengan versi yang cocok dengan SDK (wajib)
cp .env.example .env           # EXPO_PUBLIC_API_URL=http://IP-KOMPUTER-ANDA:3000/api
npx expo install expo@~57.0.0 --fix
npx expo start

#INSTAL
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview
- Ponsel dan komputer harus satu Wi-Fi. Jangan pakai `localhost` di ponsel, pakai IP LAN (mis. 192.168.1.50).
- app.json memakai SDK 57. Jika Expo Go di ponsel Anda sudah mendukung SDK 58, jalankan `npx expo install expo@^58.0.0 --fix`.
- Login mandor demo: mandor@demo.com / password123 (sudah ditugaskan ke proyek demo).

## Modul 3 - Stok Material Gudang Proyek
- Daftar material per proyek dengan stok minimum. Status Aman / Menipis / Habis.
- Material masuk (Owner/Admin): otomatis menjadi realisasi biaya RAB (sumber STOK) dalam satu transaksi, lengkap dengan alert anggaran.
- Pemakaian material (Mandor/Admin): stok dikurangi secara atomik dan tidak bisa minus walau dua orang input bersamaan. Alert saat stok menipis/habis.
- Hitung fisik / penyesuaian stok dengan alasan wajib. Transaksi tidak diedit, hanya dibatalkan (void), dan pembatalan barang masuk ikut menghapus biaya RAB-nya.
- Mandor tidak melihat harga/biaya.

## Modul 4 - Progress Lapangan
- Mandor melapor lewat mobile: persentase kumulatif, catatan, 1-5 foto (wajib), koordinat GPS (wajib, mock location ditolak di Android).
- Server memeriksa isi file benar-benar gambar, dan persentase tidak boleh turun dari laporan sebelumnya.
- Admin memverifikasi/menolak (alasan wajib) di web. Kurva progres di web.
- Foto disimpan di folder `apps/api/uploads` (dev). URL foto bertanda tangan, berlaku 2 jam.
- Penugasan mandor ke proyek (tab Tim). Mandor hanya melihat proyek yang ditugaskan dan tidak bisa membuka data RAB/keuangan.
- Kartu proyek menampilkan progres fisik dan peringatan bila biaya terpakai jauh di atas progres.

## Modul 5a - Sewa Alat Berat
- Data sewa: alat, vendor, tarif per jam/hari, biaya operator, rencana total pemakaian, masa berlaku sewa, item RAB yang dibebani.
- Mandor mencatat jam/hari kerja (web atau mobile). Biaya = jumlah x (tarif + operator) + biaya tambahan (BBM/mobilisasi, hanya admin), otomatis menjadi realisasi RAB (sumber SEWA_ALAT) dalam satu transaksi, dengan alert anggaran.
- Peringatan pembengkakan durasi: masa sewa berakhir <= 3 hari, masa sewa terlewat tapi belum dikembalikan, pemakaian >= 80% dan > 100% dari rencana.
- Perpanjang masa sewa, kembalikan alat (setelah itu tidak bisa dicatat), batalkan catatan pemakaian (biaya RAB ikut dihapus).
- Mandor tidak melihat tarif dan biaya. Hari dihitung dengan zona waktu WIB.

## Modul 5b - Opname Mandor
- SPK per mandor/subkontraktor: item pekerjaan (volume kontrak x harga satuan), persen retensi, item RAB (upah) yang dibebani.
- Opname bertermin: isi VOLUME KUMULATIF yang sudah selesai; sistem menghitung selisih dari termin yang sudah disetujui, nilai bruto, retensi, potongan/kasbon, dan nilai bersih yang dibayarkan.
- Validasi: volume tidak boleh turun, tidak boleh melebihi volume kontrak (butuh addendum), minimal ada pekerjaan baru, hanya satu draft per SPK.
- Alur: Draft (Admin) -> Disetujui (Owner; nilai bruto otomatis menjadi realisasi RAB sumber OPNAME) -> Dibayar (Admin). Pembatalan opname yang sudah disetujui hanya oleh Owner, hanya untuk termin terakhir yang belum dibayar.
- Seluruh fitur opname hanya untuk Owner dan Admin.

## Endpoint baru
| Method | Path | Role |
|---|---|---|
| GET/POST | /projects/:id/members, DELETE .../members/:userId | OWNER, ADMIN |
| GET | /projects/:id/stock/items, /stock/movements | semua (mandor: tanpa harga) |
| POST/PATCH | /projects/:id/stock/items[/:id] | OWNER, ADMIN |
| POST | /projects/:id/stock/in, /stock/adjust, /stock/movements/:id/void | OWNER, ADMIN |
| POST | /projects/:id/stock/out | semua |
| GET/POST | /projects/:id/progress (POST = multipart, field `photos`) | semua |
| PATCH | /projects/:id/progress/:id/verify | OWNER, ADMIN |
| DELETE | /projects/:id/progress/:id | OWNER, ADMIN |
| GET | /files/:photoId?sig=... | tanda tangan URL |
| GET | /projects/:id/equipment, /equipment/:rid/usage | semua (mandor: tanpa biaya) |
| POST | /projects/:id/equipment/:rid/usage | semua |
| POST/PATCH | /projects/:id/equipment[/:rid], /equipment/:rid/return, /equipment/usage/:uid/void | OWNER, ADMIN |
| GET/POST | /projects/:id/work-orders, DELETE .../:wid, POST .../:wid/close | OWNER, ADMIN |
| POST | /projects/:id/work-orders/:wid/opnames | OWNER, ADMIN |
| GET/PUT | /projects/:id/opnames[/:oid] | OWNER, ADMIN |
| POST | /projects/:id/opnames/:oid/approve | OWNER |
| POST | /projects/:id/opnames/:oid/pay, /cancel | OWNER, ADMIN (cancel disetujui: OWNER) |

## Catatan teknis
- Penyimpanan foto lewat `StorageService`; ganti isinya ke S3/Cloudflare R2 untuk produksi.
- Build standalone Android ke server `http://` memerlukan konfigurasi cleartext traffic; di Expo Go tidak masalah.
- Belum ada: mode offline, real-time Socket.io, notifikasi push, multi-tenant onboarding penuh (tahap 6).
