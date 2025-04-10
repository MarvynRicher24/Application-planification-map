import React, { useState } from 'react';
import AddressAutocomplete from './AddressAutocomplete';
import CustomSelect from './CustomSelect';

const Sidebar = ({
  vehicle,
  setVehicle,
  baseAddress,
  setBaseAddress,
  followingAddresses,
  setFollowingAddresses,
  totalEntries,
  totalDistance,
  totalTime,
  carbonFootprint,
}) => {

  const handleBaseSelect = (selected) => {
    setBaseAddress(selected);
  };

  const handleFollowingSelect = (selected) => {
    setFollowingAddresses([...followingAddresses, selected]);
  };

  const handleDeleteFollowing = (index) => {
    const updated = followingAddresses.filter((_, i) => i !== index);
    setFollowingAddresses(updated);
  };

  const handleDeleteBase = () => {
    setBaseAddress(null);
    setGpsUsed(false);
  };

  const [gpsUsed, setGpsUsed] = useState(false);

  // Nouveaux états pour le message d'erreur et le succès lors de l'import de fichier
  const [fileError, setFileError] = useState('');
  const [importedFileName, setImportedFileName] = useState('');

  // Fonction pour utiliser les coordonnées GPS de l'utilisateur et géocoder l'adresse via Nominatim
  const handleUseGpsCoordinates = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
          const data = await response.json();
          if (data && data.display_name) {
            setBaseAddress({
              address: data.display_name,
              lat: latitude,
              lon: longitude,
            });
            setGpsUsed(true);
          } else {
          }
        } catch (error) {
          console.error("Reverse geocoding error :", error);
        }
      }, (error) => {
        console.error("Geolocation error :", error);
      });
    };
  };

  // Fonction pour géocoder une adresse via l'API Nominatim
  const geocodeAddress = async (query) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`
      );
      const data = await response.json();
      if (data && data.length > 0) {
        const result = data[0];
        return {
          address: result.display_name,
          lat: parseFloat(result.lat),
          lon: parseFloat(result.lon),
        };
      }
      console.warn("Address not found : ", query);
      return null;
    } catch (error) {
      console.error("Error during geocoding : ", error);
      return null;
    }
  };

  // Fonction de traitement de l'import de fichier
  const handleFileImport = (e) => {
    // Réinitialiser les messages de retour
    setFileError('');
    setImportedFileName('');

    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      let importedAddresses = [];
      // Détection de l'extension du fichier
      if (file.name.toLowerCase().endsWith('.json')) {
        try {
          const data = JSON.parse(text);
          // On suppose que le fichier JSON contient un tableau d'objets
          // avec des clés pouvant être "address" ou des coordonnées "lat" et "lon"
          importedAddresses = data.map(item => {
            if (item.lat && item.lon) {
              return {
                address: item.address || `${item.lat}, ${item.lon}`,
                lat: parseFloat(item.lat),
                lon: parseFloat(item.lon),
              };
            }
            // Sinon, on peut effectuer une concaténation d'éventuels champs d'adresse
            return {
              address: item.address || `${item.street || ''} ${item.city || ''} ${item.postalCode || ''} ${item.country || ''}`.trim(),
              lat: item.lat ? parseFloat(item.lat) : null,
              lon: item.lon ? parseFloat(item.lon) : null,
            };
          });
        } catch (error) {
          console.error("JSON parsing error ::", error);
          setFileError("File format not supported. Please import a JSON or CSV file.");
          return;
        }
      } else if (file.name.toLowerCase().endsWith('.csv')) {
        // Simple parser CSV : on suppose une première ligne d'entêtes
        try {
          const lines = text.split(/\r?\n/);
          if (lines.length < 2) throw new Error("Empty or badly formatted CSV");
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
          importedAddresses = lines.slice(1).reduce((acc, line) => {
            if (line.trim() === "") return acc;
            const values = line.split(',');
            let item = {};
            headers.forEach((header, index) => {
              item[header] = values[index] ? values[index].trim() : "";
            });
            // Construction de l'objet adresse
            acc.push({
              address: item.address || `${item.street || ''} ${item.city || ''} ${item.postalCode || ''} ${item.country || ''}`.trim(),
              lat: item.lat ? parseFloat(item.lat) : null,
              lon: item.lon ? parseFloat(item.lon) : null,
            });
            return acc;
          }, []);
        } catch (error) {
          console.error("CSV parsing error :", error);
          setFileError("File format not supported. Please import a JSON or CSV file.");
          return;
        }};

      // Validation des adresses : géocoder celles qui n'ont pas de coordonnées
      const validatedAddresses = await Promise.all(
        importedAddresses.map(async (addr) => {
          if (addr.lat && addr.lon) return addr;
          // Utiliser la chaîne d'adresse pour géocoder
          return await geocodeAddress(addr.address);
        })
      );
      // Filtrer les adresses non validées (null)
      const validAddresses = validatedAddresses.filter(a => a !== null);
      if (validAddresses.length > 0) {
        setFollowingAddresses([...followingAddresses, ...validAddresses]);
        setImportedFileName(file.name);
      } else {
        setFileError("Please import a correct JSON or CSV file.");
      }
    };

    reader.readAsText(file);
  };

  // Formatage du temps (en minutes) en h et min
  const formatTime = (time) => {
    const minutes = parseInt(time, 10);
    if (minutes < 60) return `${minutes}`;
    const hours = Math.floor(minutes / 60);
    const min = minutes % 60;
    return `${hours} h ${min}`;
  };

  // Formatage de l'empreinte carbone (en grammes) en kg et g
  const formatCarbon = (carbon) => {
    const grams = parseFloat(carbon);
    if (grams < 1000) return `${grams}`;
    const kg = Math.floor(grams / 1000);
    const remainder = Math.round(grams % 1000);
    return `${kg} kg ${remainder}`;
  };

  // Options pour le CustomSelect
  const vehicleOptions = [
    { value: 'car', label: 'Car' },
    { value: 'electricCar', label: 'Electric Car' },
    { value: 'utility', label: 'Utility' },
    { value: 'electricUtility', label: 'Electric Utility' },
    { value: 'bike', label: 'Bike' },
    { value: 'byFoot', label: 'By Foot' }
  ];

  const vehicleSelectStyle =
    baseAddress && followingAddresses.length > 0 && vehicle === "chooseYourVehicle"
      ? { border: '2px solid red', borderRadius: '10px', padding: '4px' }
      : { border: '1px solid #ccc', borderRadius: '10px', padding: '4px' };

  return (
    <div className="sidebar">

      <div className='zoneTitle'>
        <h1 id="title">FastPlaneco</h1>
      </div>

      <div className='zoneChooseYourVehicle'>
        <CustomSelect
          value={vehicle}
          onChange={setVehicle}
          options={vehicleOptions}
          placeholder="Choose your vehicle"
          style={vehicleSelectStyle}
        />
      </div>

      <div className='zoneBaseAddress'>
        <AddressAutocomplete
          placeholder="Enter your base address"
          onSelect={handleBaseSelect}
        />
        {/* Bouton "Use GPS Coordinates" ajouté ici */}
        <div className="gpsCoordinates">
          <button className="gpsCoordinatesButton"
            onClick={handleUseGpsCoordinates}
            style={gpsUsed ? { border: '2px solid green' } : {}}>
            Use GPS Coordinates
          </button>
        </div>
        <h2 className='yourbaseAddress'>Your base address :</h2>
        {baseAddress && (
          <div className='entryBaseAddress'>
            <span style={{ width: "90%", fontSize: "14px" }}>{baseAddress.address}</span>
            <button className='deleteButton' onClick={handleDeleteBase}>×</button>
          </div>
        )}
      </div>

      <div className='zoneSecondAddress'>
        <AddressAutocomplete
          placeholder="Enter following address"
          onSelect={handleFollowingSelect}
        />

        {/* Ajout de l'input d'import de fichier */}
        <div className='fileImport'>
          <label htmlFor="fileImport" className="fileImportButton">
            Import file
            <input
              id="fileImport"
              type="file"
              accept=".json, .csv"
              onChange={handleFileImport}
              style={{ display: 'none' }}
            />
          </label>
          {/* Affichage du nom du fichier en cas de succès ou d'un message d'erreur */}
          {importedFileName && (
            <span style={{ color: 'green', marginLeft: '10px', fontSize: '12px' }}>
              {importedFileName}
            </span>
          )}
          {fileError && (
            <span style={{ color: 'red', marginLeft: '10px', fontSize: '12px' }}>
              {fileError}
            </span>
          )}
        </div>

        <h2 className='yourFollowingAddress'>Your following address(es) :</h2>
        {followingAddresses.map((addr, index) => (
          <div key={index} className='entrySecondAddress'>
            <span style={{ width: "90%", fontSize: "14px" }}>{addr.address}</span>
            <button className='deleteButton' onClick={() => handleDeleteFollowing(index)}>×</button>
          </div>
        ))}
      </div>

      <div className='zoneInformation'>
        <h3 className='informationTitle'>INFORMATION</h3>
        <div className='totalInformation'>
          <p>Total Entries: <strong>{totalEntries}</strong></p>
          <p>Total Distance: <strong>{totalDistance}</strong> km</p>
          <p>Total Time: <strong>{formatTime(totalTime)}</strong> min</p>
          <p>Carbon Footprint: <strong>{formatCarbon(carbonFootprint)}</strong> g CO₂</p>
        </div>
      </div>

    </div>
  );
};

export default Sidebar;
