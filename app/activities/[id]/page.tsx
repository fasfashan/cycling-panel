import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CassetteMeter, SectionTitle } from "@/components/panel";
import { getActivityById } from "@/lib/stats/activities";
import { effortTime, ridePrs, stickerUrl } from "@/lib/stats/prs";
import { getActivityPhotos, photoUrl } from "@/lib/strava/photos";
import {
  durationFromSeconds,
  fmtNum,
  kmFromMeters,
  kmhFromMs,
  localDateLabel,
  localTimeLabel,
  metersRounded,
  weekdayLabel,
} from "@/lib/format";

export const dynamic = "force-dynamic";

type Params = { id: string };

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-md bg-surface p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-heading text-xl font-semibold tabular-nums">
        {value}
        {unit ? <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span> : null}
      </dd>
    </div>
  );
}

export default async function RideDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const idNum = parseInt(id, 10);
  if (isNaN(idNum)) notFound();

  const ride = await getActivityById(idNum);
  if (!ride) notFound();

  // Photos can be added after the first sync, so always ask Strava.
  const photos = await getActivityPhotos(idNum, 2000);
  const stoppedS = ride.elapsedTimeS - ride.movingTimeS;
  const prs = ridePrs(ride);

  return (
    <AppShell>
      <Link
        href="/activities"
        className="-ml-2 inline-flex h-11 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" aria-hidden>
          <path d="M10 4L6 8l4 4" />
        </svg>
        Rides
      </Link>

      <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight">{ride.name}</h1>
      <p className="mt-1 text-sm tabular-nums text-muted-foreground">
        {weekdayLabel(ride.startLocal)}, {localDateLabel(ride.startLocal)} · {localTimeLabel(ride.startLocal)}
        {ride.gear ? ` · ${ride.gear.name}` : ""}
      </p>

      <p className="mt-5 flex items-baseline gap-2">
        <span className="num-hero text-5xl font-semibold text-brand">{kmFromMeters(ride.distanceM)}</span>
        <span className="text-muted-foreground">km</span>
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-2">
        <Stat label="Waktu gerak" value={durationFromSeconds(ride.movingTimeS)} />
        <Stat label="Kecepatan rata-rata" value={kmhFromMs(ride.avgSpeedMs)} unit="km/j" />
        <Stat label="Elevasi naik" value={metersRounded(ride.elevationGainM)} unit="m" />
        <Stat label="Kecepatan maks" value={kmhFromMs(ride.maxSpeedMs)} unit="km/j" />
        {stoppedS > 60 ? (
          <Stat label="Berhenti" value={durationFromSeconds(stoppedS)} />
        ) : null}
      </dl>

      <section aria-labelledby="rpe" className="mt-3 rounded-md bg-surface p-3">
        <h2 id="rpe" className="font-sans text-xs font-normal text-muted-foreground">
          Perceived Exertion
        </h2>
        {ride.rpe !== null ? (
          <div className="mt-2 flex items-center gap-3">
            <span className="num-hero text-2xl font-semibold">
              {ride.rpe}
              <span className="text-sm text-muted-foreground">/10</span>
            </span>
            <CassetteMeter value={ride.rpe} />
          </div>
        ) : (
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Belum diisi. Buka ride ini di Strava, edit, isi Perceived Exertion. Kalau ride-nya udah lama,
            ubah judulnya sedikit juga biar panel ini langsung dapat kabar.
          </p>
        )}
      </section>

      {prs.length > 0 ? (
        <section aria-label="PR di ride ini">
          <SectionTitle title="PR di ride ini" aside={`${prs.length} segmen`} />
          <p className="-mt-1 mb-3 text-sm text-muted-foreground">
            Stiker PNG transparan, tinggal tempel di story. Pakai versi kartu kalau fotonya terang.
          </p>
          <ul className="space-y-2">
            {prs.map((pr) => (
              <li key={pr.index} className="rounded-lg bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-[15px] font-medium leading-snug">{pr.segmentName}</p>
                  <p className="shrink-0 font-heading text-xl font-semibold tabular-nums text-brand">
                    {effortTime(pr.elapsedS)}
                  </p>
                </div>
                <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                  {kmFromMeters(pr.distanceM, 2)} km · {fmtNum(pr.avgKmh)} km/j · grade{" "}
                  {pr.gradePct < 0 ? "−" : ""}
                  {fmtNum(Math.abs(pr.gradePct))}%
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <a
                    href={stickerUrl(pr, { download: true })}
                    download
                    className="flex h-11 items-center justify-center rounded-md bg-brand text-sm font-semibold text-background"
                  >
                    Unduh stiker
                  </a>
                  <a
                    href={stickerUrl(pr, { panel: true, download: true })}
                    download
                    className="flex h-11 items-center justify-center rounded-md border border-line text-sm font-medium hover:bg-raised"
                  >
                    Versi kartu
                  </a>
                </div>
                <details className="group mt-2">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                    Lihat pratinjau
                  </summary>
                  {/* loading="lazy" inside a closed <details> defers rendering the PNGs until opened. */}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={stickerUrl(pr)}
                      alt={`Stiker PR ${pr.segmentName}`}
                      loading="lazy"
                      className="w-full rounded-md bg-[conic-gradient(#2a2a2d_25%,#1f1f22_0_50%,#2a2a2d_0_75%,#1f1f22_0)] bg-[length:16px_16px]"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={stickerUrl(pr, { panel: true })}
                      alt={`Stiker PR ${pr.segmentName}, versi kartu`}
                      loading="lazy"
                      className="w-full rounded-md bg-[conic-gradient(#2a2a2d_25%,#1f1f22_0_50%,#2a2a2d_0_75%,#1f1f22_0)] bg-[length:16px_16px]"
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {photos.length > 0 ? (
        <section aria-label="Foto ride" className={photos.length === 1 ? "mt-6" : "mt-6 grid grid-cols-2 gap-2"}>
          {photos.map((photo) => {
            const url = photoUrl(photo);
            if (!url) return null;
            return (
              <a
                key={photo.unique_id}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-lg"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={photo.caption || ride.name}
                  loading="lazy"
                  className={photos.length === 1 ? "max-h-[60vh] w-full object-cover" : "aspect-square w-full object-cover"}
                />
              </a>
            );
          })}
        </section>
      ) : null}

      <a
        href={`https://www.strava.com/activities/${ride.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 flex h-11 items-center justify-center rounded-md border border-line text-sm font-medium hover:bg-raised"
      >
        Buka di Strava
      </a>
    </AppShell>
  );
}
