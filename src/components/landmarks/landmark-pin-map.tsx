"use client";

import React, { useEffect, useRef } from "react";
import Map, { Marker, NavigationControl, type MapRef } from "react-map-gl/mapbox";
import { useTheme } from "next-themes";
import { MapPinIcon } from "lucide-react";
import { MAPBOX_TOKEN } from "@/lib/supabase/config";
import "mapbox-gl/dist/mapbox-gl.css";

export function LandmarkPinMap({
  lat,
  lng,
  onChange,
}: {
  lat: number;
  lng: number;
  onChange: (nextLat: number, nextLng: number) => void;
}) {
  const { resolvedTheme } = useTheme();
  const mapRef = useRef<MapRef | null>(null);

  useEffect(() => {
    mapRef.current?.flyTo({
      center: [lng, lat],
      duration: 500,
    });
  }, [lat, lng]);

  const mapStyle =
    resolvedTheme === "dark"
      ? "mapbox://styles/mapbox/dark-v11"
      : "mapbox://styles/mapbox/streets-v12";

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-border bg-muted text-sm text-muted-foreground">
        Falta configurar NEXT_PUBLIC_MAPBOX_TOKEN para ajustar el pin.
      </div>
    );
  }

  return (
    <div className="h-72 w-full overflow-hidden rounded-lg border border-border">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          latitude: lat,
          longitude: lng,
          zoom: 15,
        }}
        mapStyle={mapStyle}
        style={{ width: "100%", height: "100%" }}
        onClick={(e) => {
          onChange(e.lngLat.lat, e.lngLat.lng);
        }}
      >
        <NavigationControl position="top-right" />
        <Marker
          latitude={lat}
          longitude={lng}
          anchor="bottom"
          draggable
          onDragEnd={(e) => {
            onChange(e.lngLat.lat, e.lngLat.lng);
          }}
        >
          <div className="flex flex-col items-center">
            <div className="flex size-9 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-lg cursor-grab active:cursor-grabbing">
              <MapPinIcon className="size-5" />
            </div>
          </div>
        </Marker>
      </Map>
    </div>
  );
}
