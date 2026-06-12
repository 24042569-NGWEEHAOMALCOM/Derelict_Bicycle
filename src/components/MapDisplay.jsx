import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useState, useEffect, useRef } from "react";

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
  const trimmedPostal = postalCode?.trim();
  const trimmedBlock = blockNumber?.trim();

  if (!trimmedPostal || trimmedPostal.length < 5) {
    console.log("Invalid postal code:", postalCode);
    return null;
  }

  const query = `${trimmedPostal} Singapore`;
  const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=10&countrycode=sg`;

  try {
    console.log("Photon geocoding URL:", photonUrl);
    const response = await fetch(photonUrl, {
      headers: { "Accept-Language": "en" },
    });

    if (response.ok) {
      const data = await response.json();
      console.log("Photon geocoding result:", data);

      if (Array.isArray(data?.features) && data.features.length > 0) {
        const exactPostcode = data.features.find(
          (feature) =>
            feature.properties?.osm_key === "place" &&
            feature.properties?.osm_value === "postcode" &&
            feature.properties?.name === trimmedPostal
        );

        const bestMatch = exactPostcode || data.features.find(
          (feature) => feature.properties?.countrycode === "SG"
        ) || data.features[0];

        const [lon, lat] = bestMatch.geometry?.coordinates || [];
        if (lat != null && lon != null) {
          return {
            latitude: parseFloat(lat),
            longitude: parseFloat(lon),
            displayName: `${trimmedBlock ? `Block ${trimmedBlock}, ` : ""}${trimmedPostal}, Singapore`,
          };
        }
      }
    } else {
      console.warn("Photon response not ok:", response.status);
    }
  } catch (error) {
    console.warn("Photon geocoding failed:", error);
  }

  // Fallback to Nominatim postal / Singapore search if Photon fails
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
      format: "json",
      q: `${trimmedPostal} Singapore`,
      limit: "3",
      addressdetails: "1",
    }).toString()}`;

    console.log("Nominatim fallback URL:", nominatimUrl);
    const response = await fetch(nominatimUrl, {
      headers: { "Accept-Language": "en" },
    });

    if (!response.ok) {
      console.error("Nominatim fallback response error:", response.status);
      return null;
    }

    const data = await response.json();
    console.log("Nominatim fallback result:", data);

    if (Array.isArray(data) && data.length > 0) {
      const locationItem = data.find((item) => item.type === "postcode") || data[0];
      return {
        latitude: parseFloat(locationItem.lat),
        longitude: parseFloat(locationItem.lon),
        displayName: locationItem.display_name,
      };
    }
  } catch (error) {
    console.error("Nominatim fallback error:", error);
  }

  console.log("No results found for postal code:", postalCode, "block:", blockNumber);
  return null;
};

function MapUpdater({ location }) {
  const map = useMap();

  useEffect(() => {
    if (location && map) {
      map.flyTo([location.latitude, location.longitude], 18, {
        duration: 1,
      });
    }
  }, [location, map]);

  return null;
}

function InteractiveMapDisplay({ onLocationSelect, locationInput = "", blockNumber = "" }) {
  const defaultCenter = [1.383, 103.836]; // Nee Soon area
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);
  
  const trimmedInput = locationInput ? locationInput.trim() : "";
  const trimmedBlock = blockNumber ? blockNumber.trim() : "";
  const isValidPostalCode = /^\d{5,6}$/.test(trimmedInput);

  // Handle automatic search when postal code changes
  useEffect(() => {
    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Only proceed if we have a valid postal code and map instance
    if (!mapInstance || !isValidPostalCode) {
      console.log("Skipping search - mapInstance:", !!mapInstance, "isValid:", isValidPostalCode);
      return;
    }

    console.log("Setting up search timer for:", trimmedInput, trimmedBlock);
    setIsSearching(true);

    // Use ref to store timeout for cleanup
    searchTimeoutRef.current = setTimeout(async () => {
      console.log("Search timer triggered");
      try {
        const result = await geocodePostalCode(trimmedInput, trimmedBlock);
        if (result) {
          console.log("Moving map to:", result);
          setSelectedLocation(result);
          onLocationSelect(result);
          setIsSearching(false);
        } else {
          console.log("No location found");
          setIsSearching(false);
        }
      } catch (err) {
        console.error("Search error:", err);
        setIsSearching(false);
      }
    }, 400);

    // Cleanup function
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
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
        <MapUpdater location={selectedLocation} />
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
