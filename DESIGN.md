# DESIGN.md

Arah desain cycling-panel. Ditulis dari jawaban pemilik (Fasha) pada sesi
tanya-jawab arah desain, 26 Oktober 2026, lalu direvisi di hari yang sama
(gelap, terinspirasi Strava, mobile saja). Pemilik adalah penulisnya; file ini
hanya merapikan jawaban.

Dial: ENERGY 3 / RHYTHM 3 / MOTION 2

---

## Identitas

Panel pribadi untuk satu pesepeda pemula. Tujuannya satu: tahu kondisi
sekarang dan mau gowes apa berikutnya.

## Karakter

**Logbook pribadi.** Jujur, sederhana, terasa seperti catatan sendiri, bukan
produk yang sedang jualan.

## Mood dan dial

Hidup di layout, tenang di gerak.

| Dial | Nilai | Artinya di panel ini |
|---|---|---|
| ENERGY | 3 | Komposisi berani: ada elemen yang benar-benar dominan per layar |
| RHYTHM | 3 | Section saling kontras, bukan card seragam berulang |
| MOTION | 2 | Hanya transisi dan count-up yang punya alasan. Tanpa animasi masuk terkoreografi, tanpa loop. Hormati `prefers-reduced-motion` |

## Platform dan layout

**Mobile saja.** Seluruh layout dibatasi lebar layar HP (maks sekitar 430px)
dan diletakkan di tengah, juga saat dibuka di desktop. Tidak ada layout desktop
terpisah. Navigasi utama berupa bottom nav.

## Tema

**Gelap saja.** Tidak ada mode terang.

> Catatan antislop (R-21): tema gelap tetap tanpa toggle adalah pilihan pemilik,
> dicatat sebagai override yang disengaja.

## Warna

**Terinspirasi Strava, bukan meniru.** Nuansa gelap dan energik; aksen oranye
digeser sedikit dari oranye Strava (`#FC4C02`) supaya tidak terlihat seperti
brand Strava.

Token di bawah dipakai di app (`app/globals.css`). Di kode, oranye bernama
`brand`:

```
bg        #121212   latar aplikasi
surface   #1C1C1E   panel
raised    #262629   elemen di atas panel
line      #303034   pembatas
text      #F2F2F2   teks utama
muted     #A3A3A8   teks sekunder
accent    #FF6B2C   oranye: aksi, minggu ini, momen penting
ok        #3ECF8E   status aman
caution   #F5B83D   status hati-hati
rest      #F47272   status rehat dan peringatan
```

Status tidak pernah hanya lewat warna: selalu ada label teks.

## Tipografi

Font tetap, penggunaannya dibatasi.

| Peran | Font | Aturan |
|---|---|---|
| Display / heading | Space Grotesk | — |
| Body / UI | Hanken Grotesk | — |
| Angka | JetBrains Mono, tabular | **Hanya untuk angka hero**, bukan semua angka |
| Label | — | Label uppercase dengan tracking lebar **dikurangi** |

## Bahasa dan nada

**Bahasa Indonesia santai** di seluruh UI.

## Coaching

Saran pelatih **selalu tampil**. Saran adalah inti tab Hari ini.

Info penting di saran (jarak, RPE, batas aman, lonjakan volume) ditampilkan
sebagai **angka yang di-highlight**, bukan teks bebas. Kalimat hanya untuk
konteks.

## Struktur per layar

| Layar | Arah |
|---|---|
| Hari ini (`/`) | **B: Catatan pelatih.** Kalimat sebagai hero, angka jadi pendukung |
| Rides (`/activities`) | Daftar per minggu dengan header sticky; detail ride sebagai halaman |
| Progres (`/trends`) | Total, rekor, jarak 12 minggu, dan grafik kecepatan yang langsung kasih jawaban |
| Garasi (`/gear`) | Odometer + perawatan diurutkan dari paling mendesak |

Disetujui pemilik dari prototype `prototypes/redesign-mobile-dark.html`.

## Belum diputuskan

- Set ikon: nav pakai glyph buatan sendiri (ujung kotak); ikon lain belum ada
- Motif identitas: meter "kaset" bertingkat baru dipakai di RPE, belum dikembangkan
