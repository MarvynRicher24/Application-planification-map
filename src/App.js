import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import MapView from './components/MapView';

function App() {
  const [baseAddress, setBaseAddress] = useState(null);
  const [followingAddresses, setFollowingAddresses] = useState([]);
  const [vehicle, setVehicle] = useState('chooseYourVehicle');
  // 'route' will contain the geometry returned by OSRM and the optimized list of points.
  const [route, setRoute] = useState(null);
  const [totalDistance, setTotalDistance] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [carbonFootprint, setCarbonFootprint] = useState(0);

  // Vehicle data: speed (km/h) used to recalculate duration and emission factor in g CO2/km.
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

      // Check : if at least one following address is entered and the vehicle is not selected
      if (followingAddresses.length > 0 && vehicle === "chooseYourVehicle") {
        setTotalTime(0);
        setCarbonFootprint(0);
        return;
      }

      // Combine the address base and the following addresses
      const points = [baseAddress, ...followingAddresses];
      if (points.length === 1) {
        // If only the address base is filled in, display its marker only
        setRoute({ optimizedPoints: [baseAddress], geometry: null });
        setTotalDistance(0);
        setTotalTime(0);
        setCarbonFootprint(0);
        return;
      }

      // --- TSP optimization using the OSRM table service API ---
      const coordsStr = points.map(pt => `${pt.lon},${pt.lat}`).join(';');
      const tableUrl = `https://router.project-osrm.org/table/v1/driving/${coordsStr}?annotations=distance,duration`;
      const tableResponse = await fetch(tableUrl);
      const tableData = await tableResponse.json();
      if (!tableData || tableData.code !== "Ok") {
        console.error("Error fetching routing table.");
        return;
      }
      const distanceMatrix = tableData.distances; // distances in meters

      // For the TSP, the base (index 0) is fixed and the following addresses (indices 1..n) are permuted
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
        let currentIndex = 0; // start of address base (index 0)
        order.forEach(idx => {
          dist += distanceMatrix[currentIndex][idx];
          currentIndex = idx;
        });
        if (dist < bestDistance) {
          bestDistance = dist;
          bestOrder = order;
        }
      });

      // Arrange the following addresses in the best possible order
      const optimizedFollowing = bestOrder ? bestOrder.map(idx => points[idx]) : [];
      // Update order in report if necessary
      if (JSON.stringify(optimizedFollowing) !== JSON.stringify(followingAddresses)) {
        setFollowingAddresses(optimizedFollowing);
      }
      // Build complete optimized itinerary: base address + addresses in optimized order
      const optimizedPoints = [baseAddress, ...optimizedFollowing];

      // GraphHopper calculates the best route for a bicycle
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
            // Update distance (in km) and time (in minutes)
            setTotalDistance((ghRoute.distance / 1000).toFixed(2));
            setTotalTime(Math.floor(ghRoute.time / 60000));
            // For bicycles, the carbon footprint is set at zero (or could be a very low coefficient).
            setCarbonFootprint(6 * (ghRoute.distance / 1000).toFixed(2));
            // The returned geometry (in this case ghRoute.points) is used directly to display the route.
            // The structure of ghRoute.points depends on the parameter points_encoded=false, which returns a GeoJSON
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
        // Using GraphHopper with the “foot” profile for pedestrian mode
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
            // For walking, the carbon footprint is zero (or practically zero).
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

        // --- Retrieve the complete route from the OSRM route service API ---
        const routeCoordsStr = optimizedPoints.map(pt => `${pt.lon},${pt.lat}`).join(';');
        // The request is always made in “driving” mode, as OSRM public only supports this profile,
        // but the time displayed will be recalculated according to the speed of the selected vehicle.
        const routeUrl = `https://router.project-osrm.org/route/v1/driving/${routeCoordsStr}?overview=full&geometries=geojson`;
        const routeResponse = await fetch(routeUrl);
        const routeData = await routeResponse.json();
        if (!routeData || routeData.code !== "Ok") {
          alert("Error fetching route.");
          return;
        }
        const routeInfo = routeData.routes[0];
        // routeInfo.distance in meters, routeInfo.duration in seconds, geometry in GeoJSON format

        setTotalDistance((routeInfo.distance / 1000).toFixed(2));
        const footprint = (routeInfo.distance / 1000) * vehicleData[vehicle].emission;
        setCarbonFootprint(footprint.toFixed(2));

        // --- New “Total Time” calculation via OpenRouteService ---
        try {
          // Selecting the ORS profile for your vehicle
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
            // We sum the duration of all segments
            const totalDurationSec = orsData.features[0].properties.segments.reduce(
              (sum, segment) => sum + segment.duration, 0
            );
            setTotalTime(Math.floor(totalDurationSec / 60));
          } else {
            // Fallback : use the initial calculation
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
