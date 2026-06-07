import { useEffect, useRef } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { fromLonLat } from "ol/proj";
import { Style, Circle as CircleStyle, Fill, Stroke, Text } from "ol/style";
import { congestionColor, theme } from "../theme";

// Real Khon Kaen major intersections — fallback if the backend is offline.
export const KHON_KAEN_JUNCTIONS = [
  { id: "MITR-01", name: "ถ.มิตรภาพ x ศรีจันทร์", lon: 102.8333, lat: 16.436, mode: "auto" },
  { id: "MITR-02", name: "ถ.มิตรภาพ x ประชาสโมสร", lon: 102.8295, lat: 16.448, mode: "auto" },
  { id: "SRIC-01", name: "ถ.ศรีจันทร์ x กลางเมือง", lon: 102.836, lat: 16.4419, mode: "manual" },
  { id: "PRAC-01", name: "ถ.ประชาสโมสร x หน้า มข.", lon: 102.824, lat: 16.473, mode: "manual" },
  { id: "LAKE-01", name: "บึงแก่นนคร", lon: 102.847, lat: 16.429, mode: "manual" },
];

const KK_CENTER = fromLonLat([102.836, 16.4419]);

export default function LiveMap({ junctions = [], onSelect }: { junctions?: any[]; onSelect?: (id: string) => void }) {
  const ref = useRef(null);
  const sourceRef = useRef(new VectorSource());
  const mapRef = useRef(null);

  useEffect(() => {
    const map = new Map({
      target: ref.current,
      layers: [
        new TileLayer({ source: new OSM() }),
        new VectorLayer({ source: sourceRef.current }),
      ],
      view: new View({ center: KK_CENTER, zoom: 13 }),
      controls: [],
    });
    mapRef.current = map;
    if (onSelect) {
      map.on("singleclick", (e) => {
        map.forEachFeatureAtPixel(e.pixel, (f) => onSelect(f.get("jid")));
      });
    }

    // OpenLayers needs an explicit size refresh once the fl/grid layout settles,
    // otherwise the tile canvas can paint blank until the first window resize.
    const fix = () => map.updateSize();
    const t1 = setTimeout(fix, 100);
    const t2 = setTimeout(fix, 600);
    const ro = new ResizeObserver(fix);
    if (ref.current) ro.observe(ref.current);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      ro.disconnect();
      map.setTarget(undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const list = junctions.length ? junctions : KHON_KAEN_JUNCTIONS;
    const src = sourceRef.current;
    src.clear();
    list.forEach((j) => {
      const score = j.congestion_score ?? 0;
      const f = new Feature({ geometry: new Point(fromLonLat([j.lon, j.lat])) });
      f.set("jid", j.id);
      // Outer ring colour encodes control mode: gold = Smart PLC, green = manual/officer.
      const ring = j.mode === "auto" ? theme.gold : theme.flow;
      f.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 9 + score * 9,
            fill: new Fill({ color: congestionColor(score) }),
            stroke: new Stroke({ color: ring, width: 3 }),
          }),
          text: new Text({
            text: j.name,
            offsetY: -22,
            font: "12px Sarabun, sans-serif",
            fill: new Fill({ color: theme.cream }),
            stroke: new Stroke({ color: theme.greenDark, width: 3 }),
          }),
        })
      );
      src.addFeature(f);
    });
  }, [junctions]);

  return (
    <div className="map-wrap">
      <div id="map" ref={ref} />
      <div className="map-legend">
        <span><i className="dot" style={{ background: theme.flow }} /> คล่องตัว</span>
        <span><i className="dot" style={{ background: theme.amber }} /> ปานกลาง</span>
        <span><i className="dot" style={{ background: theme.red }} /> หนาแน่น</span>
        <span><i className="ring" style={{ borderColor: theme.gold }} /> Auto/PLC</span>
        <span><i className="ring" style={{ borderColor: theme.flow }} /> Manual</span>
      </div>
    </div>
  );
}
