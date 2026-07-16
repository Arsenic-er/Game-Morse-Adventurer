import { getAntenna } from "./antennaCatalog.js";
import { isNightAtLocation } from "./locations.js";

const WATER_BANDS = {
  "japan-nagano-suwa": [52, 66],
  "usa-pacific-northwest": [48, 65],
  "usa-new-england": [50, 60],
  "china-guilin": [52, 70],
  "europe-swiss-lake": [53, 78],
  "europe-rhine-valley": [51, 73],
  "europe-finland-lake": [47, 86],
};

export function LocationArtwork({ location, antennaId = "none", className = "", clock = new Date(), animated = false }) {
  const antenna = getAntenna(antennaId);
  const isNight = isNightAtLocation(location, clock);
  const waterBand = WATER_BANDS[location.id];
  const motionStyle = {
    "--scene-image": `url(${location.scene})`,
    "--water-top": `${waterBand?.[0] ?? 50}%`,
    "--water-bottom": `${waterBand?.[1] ?? 50}%`,
  };
  return (
    <div className={`location-artwork ${isNight ? "is-night" : "is-day"} ${animated ? "has-motion" : ""} ${className}`.trim()} style={motionStyle}>
      <img className="location-scene-image" src={location.scene} alt="" />
      {animated && <span className="location-cloud-motion" aria-hidden="true" />}
      {animated && waterBand && <span className="location-water-motion" aria-hidden="true" />}
      {antenna.image && <img className={`outdoor-antenna antenna-${antenna.id}`} src={antenna.image} alt="" />}
      <span className="location-time-filter" aria-hidden="true" />
    </div>
  );
}
