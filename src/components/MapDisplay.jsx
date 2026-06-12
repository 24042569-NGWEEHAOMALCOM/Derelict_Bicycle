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
  if (!postalCode || postalCode.trim().length < 5) {
    console.log("Invalid postal code:", postalCode);
    return null;
  }
  
  try {
    // Format: search for postal code + block number in Singapore
    let query;
    if (blockNumber && blockNumber.trim()) {
      query = `Block ${blockNumber.trim()} ${postalCode.trim()}, Singapore`;
    } else {
      query = `${postalCode.trim()}, Singapore`;
    }
    
    console.log("Geocoding query:", query);
    
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=sg&limit=1`;
    const response = await fetch(url, { 
      headers: { "Accept-Language": "en" },
      timeout: 5000 
    });
    
    const data = await response.json();
    console.log("Geocoding result:", data);
    
    if (data && data.length > 0) {
      const result = {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        displayName: data[0].display_name,
      };
      console.log("Found location:", result);
      return result;
    } else {
      console.log("No results found for query:", query);
    }
  } catch (error) {
    console.error("Geocoding error:", error);
  }
  return null;
};

function InteractiveMapDisplay({ onLocationSelect, locationInput = "", blockNumber = "" }) {
  const defaultCenter = [1.383, 103.836]; // Nee Soon area
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const trimmedInput = locationInput ? locationInput.trim() : "";
  const trimmedBlock = blockNumber ? blockNumber.trim() : "";
  const isValidPostalCode = /^\d{5,6}$/.test(trimmedInput);

  // Handle automatic search when postal code changes
  useEffect(() => {
    if (!mapInstance || !isValidPostalCode || !trimmedInput) {
      return;
    }

    console.log("Triggering search for postal code:", trimmedInput, "block:", trimmedBlock);
    setIsSearching(true);

    const searchTimer = setTimeout(async () => {
      const result = await geocodePostalCode(trimmedInput, trimmedBlock);
      if (result) {
        console.log("Moving map to:", result);
        mapInstance.flyTo([result.latitude, result.longitude], 18, {
          duration: 1,
        });
        setSelectedLocation(result);
        onLocationSelect(result);
        setIsSearching(false);
      } else {
        console.log("Search returned no results");
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(searchTimer);
  }, [trimmedInput, trimmedBlock, mapInstance, isValidPostalCode, onLocationSelect]);

  const handleLocationSelect = (location) => {
    console.log("Map clicked, selecting location:", location);
    setSelectedLocation(location);
    onLocationSelect(location);
  };

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
        <MapClickHandler onLocationSelect={handleLocationSelect} />
        {selectedLocation && (
          <Marker position={[selectedLocation.latitude, selectedLocation.longitude]}>
            <Popup>
              Bicycle Location<br />
              {trimmedBlock && `Block ${trimmedBlock}<br />`}
              {trimmedInput && `Postal: ${trimmedInput}<br />`}
              Lat: {selectedLocation.latitude.toFixed(6)}<br />
              Lng: {selectedLocation.longitude.toFixed(6)}
            </Popup>
          </Marker>
        )}
      </MapContainer>
      <div className="p-2 bg-light text-muted small text-center">
        {isSearching ? (
          <span>📍 Pinning {trimmedBlock ? `Block ${trimmedBlock}` : "location"} at {trimmedInput}...</span>
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
