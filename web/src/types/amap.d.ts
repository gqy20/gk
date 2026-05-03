declare namespace AMap {
  class Map {
    constructor(container: string | HTMLElement, options?: MapOptions);
    destroy(): void;
    setCenter(lnglat: LngLat | number[]): void;
    setZoom(zoom: number): void;
    clearMap(): void;
    add(overlay: Overlay): void;
    remove(overlay: Overlay): void;
  }

  interface MapOptions {
    zoom?: number;
    center?: LngLat | number[];
    mapStyle?: string;
    viewMode?: "2D" | "3D";
  }

  class LngLat {
    constructor(lng: number, lat: number);
    getLng(): number;
    getLat(): number;
  }

  class Pixel {
    constructor(x: number, y: number);
  }

  class Marker {
    constructor(options?: MarkerOptions);
    setPosition(position: LngLat | number[]): void;
    getPosition(): LngLat;
    setMap(map: Map | null): void;
    on(event: string, handler: (...args: unknown[]) => void): void;
    off(event: string, handler?: (...args: unknown[]) => void): void;
  }

  interface MarkerOptions {
    position?: LngLat | number[];
    title?: string;
    content?: string;
    offset?: Pixel;
    zIndex?: number;
    map?: Map | null;
  }

  class InfoWindow {
    constructor(options?: InfoWindowOptions);
    setContent(content: string): void;
    open(map: Map, position?: LngLat): void;
    close(): void;
  }

  interface InfoWindowOptions {
    isCustom?: boolean;
    offset?: Pixel;
    closeWhenClickMap?: boolean;
  }

  interface Poi {
    name: string;
    address: string;
    distance: number;
    location: { lng: number; lat: number };
    type: string;
  }

  interface PoiList {
    pois: Poi[];
  }

  class PlaceSearch {
    constructor(options?: PlaceSearchOptions);
    searchNearBy(
      keyword: string,
      center: LngLat | number[],
      radius: number,
      callback: (status: string, result: { poiList?: PoiList }) => void,
    ): void;
  }

  interface PlaceSearchOptions {
    type?: string;
    pageSize?: number;
    pageIndex?: number;
    map?: Map | null;
  }

  interface Overlay {}
}

interface Window {
  AMap: typeof AMap;
}
