import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';

const MapView = ({ route }) => {
  // Component for adjusting the map view to suit the route
  const MapUpdater = ({ route }) => {
    const map = useMap();
    useEffect(() => {
      if (route && route.optimizedPoints.length > 0) {
        const bounds = route.optimizedPoints.map(pt => [pt.lat, pt.lon]);
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }, [route, map]);
    return null;
  };

  return (
    <MapContainer center={[48.8566, 2.3522]} zoom={13} className="map-container">
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {route && route.optimizedPoints.map((pt, index) => (
        <Marker key={index} position={[pt.lat, pt.lon]}>
          <Popup>{pt.address}</Popup>
        </Marker>
      ))}
      {route && route.geometry && (
        <Polyline 
          positions={route.geometry.coordinates.map(coord => [coord[1], coord[0]])} 
          color="blue" 
        />
      )}
      {route && <MapUpdater route={route} />}
    </MapContainer>
  );
};

export default MapView;
