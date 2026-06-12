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

// Geocode address to coordinates
const geocodeAddress = async (address) => {
  if (!address || address.trim().length < 2) return null;
  
  try {
    const query = `${address}, Singapore`;
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&countrycodes=sg&limit=1`,
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
function MapCenterUpdater({ location, mapInstance, onLocationFound }) {
  useEffect(() => {
    if (!location || !location.trim() || !mapInstance) return;

    const debounceTimer = setTimeout(async () => {
      const result = await geocodeAddress(location);
      if (result) {
        mapInstance.flyTo([result.latitude, result.longitude], 17, {
          duration: 1.5,
        });
        onLocationFound({
          latitude: result.latitude,
          longitude: result.longitude,
        });
      }
    }, 800); // 800ms debounce

    return () => clearTimeout(debounceTimer);
  }, [location, mapInstance, onLocationFound]);

  return null;
}

function InteractiveMapDisplay({ onLocationSelect, locationInput = "" }) {
  const defaultCenter = [1.383, 103.836]; // Nee Soon area
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

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
    if (locationInput && locationInput.trim().length > 2) {
      setIsSearching(true);
    }
  }, [locationInput]);

  return (
    <div style={{ borderRadius: "8px", overflow: "hidden", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
      <MapContainer
        center={defaultCenter}
        zoom={15}
        style={{ width: "100%", height: "400px" }}
        whenCreated={setMapInstance}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {mapInstance && (
          <MapCenterUpdater
            location={locationInput}
            mapInstance={mapInstance}
            onLocationFound={handleLocationFound}
          />
        )}
        <MapClickHandler onLocationSelect={handleLocationSelect} />
        {selectedLocation && (
          <Marker position={[selectedLocation.latitude, selectedLocation.longitude]}>
            <Popup>
              Bicycle Location<br />
              Lat: {selectedLocation.latitude.toFixed(6)}<br />
              Lng: {selectedLocation.longitude.toFixed(6)}
            </Popup>
          </Marker>
        )}
      </MapContainer>
      <div className="p-2 bg-light text-muted small text-center">
        {isSearching ? (
          <span>🔍 Searching for location...</span>
        ) : (
          <span>📍 Type location above or click map to set bicycle location</span>
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
