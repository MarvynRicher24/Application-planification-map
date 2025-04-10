import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import MapView from './components/MapView';

function App() {
  const [baseAddress, setBaseAddress] = useState(null);
  const [followingAddresses, setFollowingAddresses] = useState([]);
  const [vehicle, setVehicle] = useState('chooseYourVehicle');
  // 'route' contiendra la géométrie renvoyée par OSRM et la liste optimisée des points.
  const [route, setRoute] = useState(null);
  const [totalDistance, setTotalDistance] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [carbonFootprint, setCarbonFootprint] = useState(0);

  // Données véhicule : la vitesse (km/h) utilisée pour recalculer la durée et le facteur d'émission en g CO2/km.
  const vehicleData = useMemo(() => ({
    chooseYourVehicle: { speed: 0, emission: 0 },
    bike: { speed: 15, emission: 6 },
    car: { speed: 60, emission: 218 },
    electricCar: { speed: 60, emission: 103 },
    utility: { speed: 60, emission: 218 },
    electricUtility: { speed: 60, emission: 103 },
    byFoot: { speed: 5, emission: 0 }
  }), []);

  useEffect(() => {
    const fetchRouteData = async () => {
      if (!baseAddress) {
        setRoute(null);
        setTotalDistance(0);
        setTotalTime(0);
        setCarbonFootprint(0);
        return;
      }

      // Vérification : si au moins une following address est renseignée et que le véhicule n'est pas choisi
      if (followingAddresses.length > 0 && vehicle === "chooseYourVehicle") {
        setTotalTime(0);
        setCarbonFootprint(0);
        return;
      }

      // Combiner la base address et les adresses suivantes
      const points = [baseAddress, ...followingAddresses];
      if (points.length === 1) {
        // Si seule la base address est renseignée, afficher son marker seul
        setRoute({ optimizedPoints: [baseAddress], geometry: null });
        setTotalDistance(0);
        setTotalTime(0);
        setCarbonFootprint(0);
        return;
      }

      // --- Optimisation TSP à l'aide de l'API OSRM table service ---
      const coordsStr = points.map(pt => `${pt.lon},${pt.lat}`).join(';');
      const tableUrl = `https://router.project-osrm.org/table/v1/driving/${coordsStr}?annotations=distance,duration`;
      const tableResponse = await fetch(tableUrl);
      const tableData = await tableResponse.json();
      if (!tableData || tableData.code !== "Ok") {
        console.error("Error fetching routing table.");
        return;
      }
      const distanceMatrix = tableData.distances; // distances en mètres

      // Pour le TSP, la base (index 0) est fixe et on permute les adresses suivantes (indices 1..n)
      let bestOrder = null;
      let bestDistance = Infinity;
      const followingIndices = followingAddresses.map((_, i) => i + 1);

      const permutations = (arr) => {
        if (arr.length === 0) return [[]];
        let result = [];
        for (let i = 0; i < arr.length; i++) {
          const current = arr[i];
          const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
          const remainingPerms = permutations(remaining);
          for (let perm of remainingPerms) {
            result.push([current, ...perm]);
          }
        }
        return result;
      };

      const allPermutations = permutations(followingIndices);
      allPermutations.forEach(order => {
        let dist = 0;
        let currentIndex = 0; // départ de la base address (index 0)
        order.forEach(idx => {
          dist += distanceMatrix[currentIndex][idx];
          currentIndex = idx;
        });
        if (dist < bestDistance) {
          bestDistance = dist;
          bestOrder = order;
        }
      });

      // Réordonner les adresses suivantes d'après le meilleur ordre
      const optimizedFollowing = bestOrder ? bestOrder.map(idx => points[idx]) : [];
      // Mise à jour de l'ordre dans l'état si nécessaire
      if (JSON.stringify(optimizedFollowing) !== JSON.stringify(followingAddresses)) {
        setFollowingAddresses(optimizedFollowing);
      }
      // Construire l'itinéraire complet optimisé : base address + adresses dans l'ordre optimisé
      const optimizedPoints = [baseAddress, ...optimizedFollowing];

      // Calcul du meilleur itinéraire pour un vélo grâce à GraphHopper
      if (vehicle === 'bike') {
        let ghUrl = `https://graphhopper.com/api/1/route?vehicle=bike&locale=fr&points_encoded=false&elevation=false&weighting=fastest&key=b3864d95-c9b8-4d53-b078-d3a77e2e6e13`;
        optimizedPoints.forEach(pt => {
          ghUrl += `&point=${pt.lat},${pt.lon}`;
        });
        try {
          const ghResponse = await fetch(ghUrl);
          const ghData = await ghResponse.json();
          if (ghData.paths && ghData.paths.length > 0) {
            const ghRoute = ghData.paths[0];
            // Mise à jour de la distance (en km) et du temps (en minutes)
            setTotalDistance((ghRoute.distance / 1000).toFixed(2));
            setTotalTime(Math.floor(ghRoute.time / 60000));
            // Pour le vélo, l'empreinte carbone est mise à zéro (ou pourrait être un très faible coefficient)
            setCarbonFootprint(6 * (ghRoute.distance / 1000).toFixed(2));
            // Pour l'affichage du tracé, la géométrie retournée (ici ghRoute.points) est directement utilisée
            // La structure de ghRoute.points dépend du paramètre points_encoded=false qui renvoie un GeoJSON
            setRoute({
              geometry: ghRoute.points,
              optimizedPoints,
            });
          } else {
            console.error("Error retrieving bike route via GraphHopper");
          }
        } catch (error) {
          console.error("Error when calling GraphHopper :", error);
        }
      } else if (vehicle === 'byFoot') {
        // Utilisation de GraphHopper avec le profil "foot" pour le mode piéton
        let ghUrl = `https://graphhopper.com/api/1/route?vehicle=foot&locale=fr&points_encoded=false&elevation=false&weighting=fastest&key=3ec658db-0296-4257-9b4c-fa78c36e55a2`;
        optimizedPoints.forEach(pt => {
          ghUrl += `&point=${pt.lat},${pt.lon}`;
        });
        try {
          const ghResponse = await fetch(ghUrl);
          const ghData = await ghResponse.json();
          if (ghData.paths && ghData.paths.length > 0) {
            const ghRoute = ghData.paths[0];
            setTotalDistance((ghRoute.distance / 1000).toFixed(2));
            setTotalTime(Math.floor(ghRoute.time / 60000));
            // Pour la marche, l'empreinte carbone est nulle (ou pratiquement nulle)
            setCarbonFootprint(0);
            setRoute({
              geometry: ghRoute.points,
              optimizedPoints,
            });
          } else {
            console.error("Erreur lors de la récupération du trajet piéton via GraphHopper");
          }
        } catch (error) {
          console.error("Erreur lors de l'appel à GraphHopper (byFoot) :", error);
        }
      } else {

        // --- Récupérer l'itinéraire complet depuis l'API OSRM route service ---
        const routeCoordsStr = optimizedPoints.map(pt => `${pt.lon},${pt.lat}`).join(';');
        // La requête est toujours faite en mode "driving" car OSRM public ne supporte que ce profil,
        // mais la durée affichée sera recalculée en fonction de la vitesse du véhicule sélectionné.
        const routeUrl = `https://router.project-osrm.org/route/v1/driving/${routeCoordsStr}?overview=full&geometries=geojson`;
        const routeResponse = await fetch(routeUrl);
        const routeData = await routeResponse.json();
        if (!routeData || routeData.code !== "Ok") {
          alert("Error fetching route.");
          return;
        }
        const routeInfo = routeData.routes[0];
        // routeInfo.distance en mètres, routeInfo.duration en secondes, geometry au format GeoJSON

        setTotalDistance((routeInfo.distance / 1000).toFixed(2));
        const footprint = (routeInfo.distance / 1000) * vehicleData[vehicle].emission;
        setCarbonFootprint(footprint.toFixed(2));

        // --- Nouveau calcul du "Total Time" via OpenRouteService ---
        try {
          // Sélection du profil ORS en fonction du véhicule choisi
          const profileMapping = {
            car: "driving-car",
            electricCar: "driving-car",
            utility: "driving-car",
            electricUtility: "driving-car",
            bike: "cycling-regular",
            byFoot: "foot-walking"
          };
          const profile = profileMapping[vehicle] || "driving-car";

          const orsUrl = `https://api.openrouteservice.org/v2/directions/${profile}/geojson`;
          const orsBody = JSON.stringify({
            coordinates: optimizedPoints.map(pt => [pt.lon, pt.lat])
          });

          const orsResponse = await fetch(orsUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': '5b3ce3597851110001cf62482990c084e35f41e1b1cdafe113a39b59'
            },
            body: orsBody
          });

          const orsData = await orsResponse.json();

          if (
            orsData &&
            orsData.features &&
            orsData.features.length > 0 &&
            orsData.features[0].properties &&
            orsData.features[0].properties.segments &&
            orsData.features[0].properties.segments.length > 0
          ) {
            // On somme la durée de tous les segments
            const totalDurationSec = orsData.features[0].properties.segments.reduce(
              (sum, segment) => sum + segment.duration, 0
            );
            setTotalTime(Math.floor(totalDurationSec / 60));
          } else {
            // Fallback : utiliser le calcul initial
            setTotalTime(Math.floor((routeInfo.distance / 1000) / vehicleData[vehicle].speed * 60));
          }
        } catch (error) {
          console.error("Error when retrieving time via ORS :", error);
          setTotalTime(Math.floor((routeInfo.distance / 1000) / vehicleData[vehicle].speed * 60));
        }
        setRoute({
          geometry: routeInfo.geometry,
          optimizedPoints,
        });
      }
    };

    fetchRouteData();
  }, [baseAddress, followingAddresses, vehicle, vehicleData]);

  return (
    <div className="app-container">
      <Sidebar
        vehicle={vehicle}
        setVehicle={setVehicle}
        baseAddress={baseAddress}
        setBaseAddress={setBaseAddress}
        followingAddresses={followingAddresses}
        setFollowingAddresses={setFollowingAddresses}
        totalEntries={baseAddress ? 1 + followingAddresses.length : 0}
        totalDistance={totalDistance}
        totalTime={totalTime}
        carbonFootprint={carbonFootprint}
      />
      <MapView route={route} />
    </div>
  );
}

export default App;
