# DESIGN.md

Arah desain cycling-panel. Ditulis dari jawaban pemilik (Fasha) pada sesi
tanya-jawab arah desain, 26 Oktober 2026. Pemilik adalah penulisnya; file ini
hanya merapikan jawaban. Token warna dan font diambil dari CLAUDE.md §14 yang
sudah ada.

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

## Tema

**Terang saja.** Tidak ada dark mode.

## Warna

Tetap dari token yang sudah ada. Aksen tetap **deep pine**.

```
ink     #1A1C1E   teks utama
paper   #F4F5F6   latar aplikasi
surface #FFFFFF   panel
line    #E3E5E8   garis tipis, pembatas
muted   #6B7177   teks sekunder
accent  #0E5C4A   deep pine: hanya di momen penting
warn    #B4541E   hanya untuk peringatan overreach
```

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

## Struktur per layar

| Layar | Arah |
|---|---|
| Hari ini | **B: Catatan pelatih.** Kalimat sebagai hero, angka jadi pendukung |
| Rides | Belum diputuskan |
| Progres | Belum diputuskan |
| Garasi | Belum diputuskan |

## Belum diputuskan

- Arah visual untuk Rides, Progres, dan Garasi
- Set ikon: tetap Lucide atau ganti
- Motif identitas yang menghubungkan visual ke dunia sepeda
