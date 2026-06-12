import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useState, useEffect } from "react";

// Fix for default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      onLocationSelect({ latitude: lat, longitude: lng });
    },
  });
  return null;
}

// Geocode postal code and block number to coordinates
const geocodePostalCode = async (postalCode, blockNumber) => {
  if (!postalCode || postalCode.trim().length < 5) return null;
  
  try {
    // Format: search for postal code + block number in Singapore
    const blockPart = blockNumber ? `Block ${blockNumber}` : "";
    const query = `${blockPart} ${postalCode.trim()}, Singapore`.trim();
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&countrycodes=sg&limit=1&zoom=17`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await response.json();
    if (data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        displayName: data[0].display_name,
      };
    }
  } catch (error) {
    console.error("Geocoding error:", error);
  }
  return null;
};

// Custom hook to handle map center updates
function MapCenterUpdater({ postalCode, blockNumber, mapInstance, onLocationFound }) {
  useEffect(() => {
    if (!postalCode || !postalCode.trim() || !mapInstance) return;

    // Only search if it's 5-6 digits (Singapore postal code format)
    if (!/^\d{5,6}$/.test(postalCode.trim())) return;

    const debounceTimer = setTimeout(async () => {
      const result = await geocodePostalCode(postalCode.trim(), blockNumber);
      if (result) {
        mapInstance.flyTo([result.latitude, result.longitude], 18, {
          duration: 1.2,
        });
        onLocationFound({
          latitude: result.latitude,
          longitude: result.longitude,
        });
      }
    }, 300); // 300ms debounce for faster response

    return () => clearTimeout(debounceTimer);
  }, [postalCode, blockNumber, mapInstance, onLocationFound]);

  return null;
}

function InteractiveMapDisplay({ onLocationSelect, locationInput = "", blockNumber = "" }) {
  const defaultCenter = [1.383, 103.836]; // Nee Soon area
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const trimmedInput = locationInput ? locationInput.trim() : "";
  const trimmedBlock = blockNumber ? blockNumber.trim() : "";
  const isValidPostalCode = /^\d{5,6}$/.test(trimmedInput);

  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
    onLocationSelect(location);
  };

  const handleLocationFound = (location) => {
    setSelectedLocation(location);
    onLocationSelect(location);
    setIsSearching(false);
  };

  useEffect(() => {
    setIsSearching(isValidPostalCode && trimmedInput.length > 0);
  }, [trimmedInput, isValidPostalCode]);

  return (
    <div style={{ borderRadius: "8px", overflow: "hidden", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
      <MapContainer
        center={defaultCenter}
        zoom={15}
        style={{ width: "100%", height: "400px" }}
        whenCreated={setMapInstance}
        key={`map-${Date.now()}`}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {mapInstance && (
          <MapCenterUpdater
            postalCode={trimmedInput}
            blockNumber={trimmedBlock}
            mapInstance={mapInstance}
            onLocationFound={handleLocationFound}
          />
        )}
        <MapClickHandler onLocationSelect={handleLocationSelect} />
        {selectedLocation && (
          <Marker position={[selectedLocation.latitude, selectedLocation.longitude]}>
            <Popup>
              Bicycle Location<br />
              {trimmedBlock && `Block ${trimmedBlock}<br />`}
              Postal: {trimmedInput}<br />
              Lat: {selectedLocation.latitude.toFixed(6)}<br />
              Lng: {selectedLocation.longitude.toFixed(6)}
            </Popup>
          </Marker>
        )}
      </MapContainer>
      <div className="p-2 bg-light text-muted small text-center">
        {isSearching ? (
          <span>📍 Pinning Block {trimmedBlock} at {trimmedInput}...</span>
        ) : trimmedInput && !isValidPostalCode ? (
          <span>⚠️ Enter a valid Singapore postal code (5-6 digits)</span>
        ) : (
          <span>📍 Enter postal code & block number to drop pin</span>
        )}
      </div>
    </div>
  );
}

function MapDisplay({ latitude, longitude }) {
  if (!latitude || !longitude) {
    return (
      <div className="alert alert-info">
        No GPS coordinates available.
      </div>
    );
  }

  const position = [parseFloat(latitude), parseFloat(longitude)];

  return (
    <div style={{ borderRadius: "8px", overflow: "hidden", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
      <MapContainer center={position} zoom={17} style={{ width: "100%", height: "400px" }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <Marker position={position}>
          <Popup>
            Bicycle Location<br />
            Lat: {latitude.toFixed(6)}<br />
            Lng: {longitude.toFixed(6)}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}

export { InteractiveMapDisplay };
export default MapDisplay;
