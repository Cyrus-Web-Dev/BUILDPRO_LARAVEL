# Catatan Audit & Perbaikan

## Penyebab error (P1012)
Prisma tidak mendukung enum satu baris (`enum Role { A B C }`). Semua 11 enum di `schema.prisma` diubah menjadi multi-baris.
Error `@prisma/client did not initialize` pada seed hanyalah akibat `prisma generate` gagal.

## Perbaikan kode
1. [Keamanan] JwtStrategy menerima token URL-foto (typ:'file') sebagai token login. Sekarang ditolak.
2. [Bug] Email tidak dinormalisasi (Owner@x.com != owner@x.com). Kini trim + lowercase.
3. [Bug] Raw SQL pengurangan stok diberi cast ::numeric agar aman terhadap tipe parameter.
4. [Bug] Ubah kode item RAB ke kode yang sudah ada -> sebelumnya error 500; kini pesan 400.
5. [Integritas] Item RAB yang dipakai sewa alat/SPK/material gudang tidak bisa dihapus.
6. [Bug] Tanggal default memakai UTC (salah hari pukul 00-07 WIB). Diganti todayISO() lokal (web & mobile).
7. [Bug] Mobile: keyboard Indonesia memberi koma desimal ("45,5") -> sebelumnya tidak valid. Kini dikonversi.
8. Seed idempoten (aman dijalankan ulang). PrismaService menutup koneksi saat shutdown.
9. README: perintah copy Windows memakai backslash.

## Catatan / risiko yang belum diubah (perlu keputusan Anda)
- next 14.2.15 punya kerentanan: `npm install next@14 -w @buildpro/web`.
- Ganti JWT_SECRET di apps/api/.env dengan string acak panjang.
- Belum ada rate limit pada /auth/login (pertimbangkan @nestjs/throttler).
- Token JWT tetap berlaku sampai kedaluwarsa walau role/akun diubah.
- Nomor opname bisa bentrok bila dua admin membuat bersamaan (kena unique -> 500).
- Uang disimpan sebagai Decimal di DB tapi dikirim klien sebagai number (float); aman untuk skala Rupiah normal.
- Foto disimpan di disk lokal; ganti ke S3/R2 untuk produksi.
- Mobile memakai Expo SDK 57: pastikan cocok dengan Expo Go Anda.
- Belum ada tes otomatis; kode belum dikompilasi/dijalankan di sini (tanpa akses internet untuk npm install).
