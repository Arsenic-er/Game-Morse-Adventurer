import { getAntenna } from "./antennaCatalog.js";
import { isNightAtLocation } from "./locations.js";

export function LocationArtwork({ location, antennaId = "none", className = "", clock = new Date() }) {
  const antenna = getAntenna(antennaId);
  const isNight = isNightAtLocation(location, clock);
  return (
    <div className={`location-artwork ${isNight ? "is-night" : "is-day"} ${className}`.trim()}>
      <img className="location-scene-image" src={location.scene} alt="" />
      {antenna.image && <img className={`outdoor-antenna antenna-${antenna.id}`} src={antenna.image} alt="" />}
      <span className="location-time-filter" aria-hidden="true" />
    </div>
  );
}
