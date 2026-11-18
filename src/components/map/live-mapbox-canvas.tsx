"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Popup,
  Source,
  type MapRef,
} from "react-map-gl/mapbox";
import { useTheme } from "next-themes";
import { AlertTriangleIcon, CarTaxiFrontIcon, NavigationIcon } from "lucide-react";
import { MAPBOX_TOKEN } from "@/lib/supabase/config";
import { getLocalityViewport, parsePostGISPoint } from "@/lib/postgis";
import { formatDateTimeAR, formatTicketStatus, formatTripStatus } from "@/lib/format";
import { DriverBadgePill } from "@/components/badges/badge-medal";
import { Badge } from "@/components/ui/badge";
import type {
  DriverWithProfile,
  Locality,
  SupportTicket,
  Trip,
} from "@/types/taxiya";
import "mapbox-gl/dist/mapbox-gl.css";

interface SelectedPin {
  type: "driver" | "trip" | "emergency";
  lat: number;
  lng: number;
  driver?: DriverWithProfile;
  trip?: Trip;
  ticket?: SupportTicket;
}

export function LiveMapboxCanvas({
  drivers,
  trips,
  emergencies,
  selectedLocality,
}: {
  drivers: DriverWithProfile[];
  trips: Trip[];
  emergencies: SupportTicket[];
  selectedLocality: Locality | null;
}) {
  const { resolvedTheme } = useTheme();
  const mapRef = useRef<MapRef | null>(null);
  const [selectedPin, setSelectedPin] = useState<SelectedPin | null>(null);
  const [nowMs, setNowMs] = useState<number>(0);

  useEffect(() => {
    const t = setTimeout(() => setNowMs(Date.now()), 0);
    const id = setInterval(() => setNowMs(Date.now()), 5000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, []);

  const initialViewport = useMemo(
    () => getLocalityViewport(selectedLocality?.name),
    [selectedLocality?.name]
  );

  useEffect(() => {
    const target = selectedLocality
      ? parsePostGISPoint(selectedLocality.center_location) ??
        getLocalityViewport(selectedLocality.name)
      : getLocalityViewport(null);

    const lat = "latitude" in target ? target.latitude : target.lat;
    const lng = "longitude" in target ? target.longitude : target.lng;
    const zoom = "zoom" in target ? target.zoom : 13.5;

    mapRef.current?.flyTo({
      center: [lng, lat],
      zoom,
      duration: 900,
    });
  }, [selectedLocality]);

  const driverMarkers = useMemo(() => {
    return drivers
      .map((d) => {
        const coords = parsePostGISPoint(d.current_location);
        if (!coords) return null;
        const lastUpdateMs =
          nowMs > 0 && d.last_location_at
            ? nowMs - new Date(d.last_location_at).getTime()
            : 0;
        const isStale = nowMs > 0 && (!d.last_location_at || lastUpdateMs > 15_000);
        return { driver: d, coords, isStale };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [drivers, nowMs]);

  const tripMarkers = useMemo(() => {
    return trips
      .map((t) => {
        const origin = parsePostGISPoint(t.origin_point);
        const dest = parsePostGISPoint(t.dest_point);
        if (!origin && !dest) return null;
        return { trip: t, origin, dest };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [trips]);

  const tripRoutesGeoJson = useMemo(() => {
    const features = tripMarkers
      .filter((t) => t.origin && t.dest)
      .map((t) => ({
        type: "Feature" as const,
        properties: { id: t.trip.id, status: t.trip.status },
        geometry: {
          type: "LineString" as const,
          coordinates: [
            [t.origin!.lng, t.origin!.lat],
            [t.dest!.lng, t.dest!.lat],
          ],
        },
      }));
    return {
      type: "FeatureCollection" as const,
      features,
    };
  }, [tripMarkers]);

  const emergencyMarkers = useMemo(() => {
    const tripById = new globalThis.Map(trips.map((t) => [t.id, t]));
    const driverById = new globalThis.Map(drivers.map((d) => [d.user_id, d]));

    return emergencies
      .map((ticket) => {
        const linkedDriver = driverById.get(ticket.user_id);
        const linkedTrip = ticket.trip_id ? tripById.get(ticket.trip_id) : undefined;
        const coords =
          parsePostGISPoint(linkedDriver?.current_location) ??
          parsePostGISPoint(linkedTrip?.origin_point) ??
          (ticket.locality_id && selectedLocality?.id === ticket.locality_id
            ? parsePostGISPoint(selectedLocality.center_location)
            : null);
        if (!coords) return null;
        return { ticket, coords };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [emergencies, trips, drivers, selectedLocality]);

  const mapStyle =
    resolvedTheme === "dark"
      ? "mapbox://styles/mapbox/dark-v11"
      : "mapbox://styles/mapbox/streets-v12";

  const operationalStatusByDriver = useMemo(() => {
    const map = new globalThis.Map<string, string>();
    for (const trip of trips) {
      if (!trip.driver_id) continue;
      if (trip.status === "accepted" || trip.status === "arriving") {
        map.set(trip.driver_id, "En camino al pasajero");
      } else if (trip.status === "in_door") {
        map.set(trip.driver_id, "En puerta");
      } else if (
        trip.status === "in_progress" ||
        trip.status === "waiting" ||
        trip.status === "waiting_return"
      ) {
        map.set(trip.driver_id, "En viaje activo");
      }
    }
    return map;
  }, [trips]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full min-h-[460px] items-center justify-center rounded-lg border border-border bg-muted p-6 text-center text-sm text-muted-foreground">
        Falta configurar NEXT_PUBLIC_MAPBOX_TOKEN en el entorno para mostrar el mapa.
      </div>
    );
  }

  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-lg border border-border">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          latitude: initialViewport.latitude,
          longitude: initialViewport.longitude,
          zoom: initialViewport.zoom,
        }}
        mapStyle={mapStyle}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" />

        {tripRoutesGeoJson.features.length > 0 ? (
          <Source id="active-trip-routes" type="geojson" data={tripRoutesGeoJson}>
            <Layer
              id="active-trip-lines"
              type="line"
              paint={{
                "line-color": resolvedTheme === "dark" ? "#38BDF8" : "#0284C7",
                "line-width": 3,
                "line-dasharray": [2, 1.5],
              }}
            />
          </Source>
        ) : null}

        {/* Marcadores de viajes en curso (origen) */}
        {tripMarkers.map(({ trip, origin }) =>
          origin ? (
            <Marker
              key={`trip-${trip.id}`}
              latitude={origin.lat}
              longitude={origin.lng}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelectedPin({
                  type: "trip",
                  lat: origin.lat,
                  lng: origin.lng,
                  trip,
                });
              }}
            >
              <button
                type="button"
                aria-label={`Viaje ${formatTripStatus(trip.status)}`}
                className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-secondary text-secondary-foreground shadow-md transition-transform hover:scale-110"
              >
                <NavigationIcon className="size-3.5" />
              </button>
            </Marker>
          ) : null
        )}

        {/* Marcadores de taxis en línea */}
        {driverMarkers.map(({ driver, coords, isStale }) => {
          const isCompany = Boolean(driver.company_id && driver.company);
          const color = isStale
            ? "#64748B"
            : isCompany
              ? driver.company!.badge_color || "#0284C7"
              : "#F59E0B";

          return (
            <Marker
              key={`driver-${driver.user_id}`}
              latitude={coords.lat}
              longitude={coords.lng}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelectedPin({
                  type: "driver",
                  lat: coords.lat,
                  lng: coords.lng,
                  driver,
                });
              }}
            >
              <button
                type="button"
                aria-label={`Taxi ${driver.profile?.full_name || driver.plate_number || "en línea"}`}
                className="flex items-center gap-1.5 rounded-full border-2 border-background px-2.5 py-1 text-[11px] font-semibold text-white shadow-md transition-transform hover:scale-105"
                style={{ backgroundColor: color }}
              >
                <CarTaxiFrontIcon className="size-3.5 shrink-0" />
                <span className="max-w-28 truncate">
                  {driver.profile?.full_name || "Chofer TaxiYa"}
                </span>
              </button>
            </Marker>
          );
        })}

        {/* Marcadores de emergencia */}
        {emergencyMarkers.map(({ ticket, coords }) => (
          <Marker
            key={`emergency-${ticket.id}`}
            latitude={coords.lat}
            longitude={coords.lng}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelectedPin({
                type: "emergency",
                lat: coords.lat,
                lng: coords.lng,
                ticket,
              });
            }}
          >
            <button
              type="button"
              aria-label="Emergencia activa"
              className="flex size-9 animate-pulse items-center justify-center rounded-full border-2 border-background bg-destructive text-destructive-foreground shadow-lg"
            >
              <AlertTriangleIcon className="size-4" />
            </button>
          </Marker>
        ))}

        {selectedPin ? (
          <Popup
            latitude={selectedPin.lat}
            longitude={selectedPin.lng}
            anchor="top"
            closeOnClick={false}
            onClose={() => setSelectedPin(null)}
          >
            <div className="flex min-w-56 max-w-72 flex-col gap-1.5 text-card-foreground">
              {selectedPin.type === "driver" && selectedPin.driver ? (
                <>
                  <div className="flex items-center justify-between gap-2 pr-4">
                    <span className="font-semibold text-sm">
                      {selectedPin.driver.profile?.full_name || "Chofer sin nombre"}
                    </span>
                    <Badge variant={selectedPin.driver.company ? "secondary" : "default"}>
                      {selectedPin.driver.company
                        ? selectedPin.driver.company.name
                        : "Independiente"}
                    </Badge>
                  </div>
                  <p className="text-xs font-medium text-foreground">
                    {[
                      selectedPin.driver.car_brand,
                      selectedPin.driver.car_model,
                      selectedPin.driver.car_color,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Vehículo sin datos"}
                  </p>
                  <p className="text-xs font-mono text-muted-foreground">
                    Patente: {selectedPin.driver.plate_number || "Sin patente"}
                  </p>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <Badge variant="outline">
                      {operationalStatusByDriver.get(selectedPin.driver.user_id) ??
                        "Disponible en línea"}
                    </Badge>
                  </div>
                  {selectedPin.driver.badges && selectedPin.driver.badges.length > 0 ? (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {selectedPin.driver.badges.slice(0, 3).map((b) => (
                        <DriverBadgePill key={b.id} badge={b} compact />
                      ))}
                    </div>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Último GPS: {formatDateTimeAR(selectedPin.driver.last_location_at)}
                  </p>
                </>
              ) : null}

              {selectedPin.type === "trip" && selectedPin.trip ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm">Viaje en curso</span>
                    <Badge variant="secondary">
                      {formatTripStatus(selectedPin.trip.status)}
                    </Badge>
                  </div>
                  <p className="text-xs">
                    Origen: {selectedPin.trip.origin_address || "Pin en mapa"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Destino: {selectedPin.trip.dest_address || "A confirmar"}
                  </p>
                </>
              ) : null}

              {selectedPin.type === "emergency" && selectedPin.ticket ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-destructive">
                      Alerta de emergencia
                    </span>
                    <Badge variant="destructive">
                      {formatTicketStatus(selectedPin.ticket.status)}
                    </Badge>
                  </div>
                  <p className="text-xs">
                    {selectedPin.ticket.description || "Sin detalle adicional."}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Recibida: {formatDateTimeAR(selectedPin.ticket.created_at)}
                  </p>
                </>
              ) : null}
            </div>
          </Popup>
        ) : null}
      </Map>
    </div>
  );
}
