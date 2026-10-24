import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

const MapView = lazy(() => import("@/components/MapView").then((m) => ({ default: m.MapView })));

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Building Status Map — Detroit Permit Navigator" },
      {
        name: "description",
        content:
          "Map of Detroit parcels by building status: land bank availability, sales, and pending or retired buildings, from city open data.",
      },
      { property: "og:title", content: "Building Status Map — Detroit Permit Navigator" },
      {
        property: "og:description",
        content: "Detroit parcels by building status, drawn from the city's open data portal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapPage,
});

function MapFallback() {
  return <div className="h-[65vh] w-full animate-pulse rounded-xl border bg-muted" aria-label="Loading map" />;
}

function MapPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <p className="eyebrow">Building status map</p>
      <h1 className="mt-2 text-4xl font-bold">Detroit parcels by status</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Pins come from the city's open data portal and refresh when an admin runs a sync. The open data has no explicit
        private for-sale flag, so privately listed properties appear only when an administrator adds them by hand.
      </p>
      <div className="mt-6">
        <ClientOnly fallback={<MapFallback />}>
          <Suspense fallback={<MapFallback />}>
            <MapView />
          </Suspense>
        </ClientOnly>
      </div>
    </div>
  );
}
