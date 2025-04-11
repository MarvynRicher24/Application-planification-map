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

  // New statuses for error message and success during file import
  const [fileError, setFileError] = useState('');
  const [importedFileName, setImportedFileName] = useState('');

  // Reports for export errors
  const [exportGoogleError, setExportGoogleError] = useState('');
  const [downloadGpxError, setDownloadGpxError] = useState('');

  // Checks if entries are complete (base address and at least 1 following address)
  const entriesComplete = baseAddress && followingAddresses.length > 0;

  // Function to use the user's GPS coordinates and geocode the address via Nominatim
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
          }
        } catch (error) {
          console.error("Reverse geocoding error :", error);
        }
      }, (error) => {
        console.error("Geolocation error :", error);
      });
    };
  };

  // Function to geocode an address via the Nominatim API
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

  // File import processing function
  const handleFileImport = (e) => {
    // Reset return messages
    setFileError('');
    setImportedFileName('');

    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      let importedAddresses = [];
      // File extension detection
      if (file.name.toLowerCase().endsWith('.json')) {
        try {
          const data = JSON.parse(text);
          // The JSON file is assumed to contain an array of
          // with keys that can be “address” or ‘lat’ and “lon” coordinates
          importedAddresses = data.map(item => {
            if (item.lat && item.lon) {
              return {
                address: item.address || `${item.lat}, ${item.lon}`,
                lat: parseFloat(item.lat),
                lon: parseFloat(item.lon),
              };
            }
            // Alternatively, we can concatenate any address fields
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
        // Simple CSV parser: we assume a first line of headers
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
            // Address object construction
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
        }
      };

      // Address validation: geocode addresses without coordinates
      const validatedAddresses = await Promise.all(
        importedAddresses.map(async (addr) => {
          if (addr.lat && addr.lon) return addr;
          // Use address string to geocode
          return await geocodeAddress(addr.address);
        })
      );
      // Filter out invalid addresses (null)
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

  // Formatting time (in minutes) in h and min
  const formatTime = (time) => {
    const minutes = parseInt(time, 10);
    if (minutes < 60) return `${minutes}`;
    const hours = Math.floor(minutes / 60);
    const min = minutes % 60;
    return `${hours} h ${min}`;
  };

  // Carbon footprint formatting (in grams) in kg and g
  const formatCarbon = (carbon) => {
    const grams = parseFloat(carbon);
    if (grams < 1000) return `${grams}`;
    const kg = Math.floor(grams / 1000);
    const remainder = Math.round(grams % 1000);
    return `${kg} kg ${remainder}`;
  };

  // CustomSelect options
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

  // Building the Google Maps URL for the route
  const buildGoogleMapsUrl = () => {
    const exportPoints = (baseAddress && followingAddresses.length > 0)
      ? ((window.route && window.route.optimizedPoints)
        ? window.route.optimizedPoints
        : [baseAddress, ...followingAddresses])
      : [];
    if (exportPoints.length < 2) return '';
    const origin = exportPoints[0];
    const destination = exportPoints[exportPoints.length - 1];
    const waypoints = exportPoints.slice(1, exportPoints.length - 1)
      .map(pt => `${pt.lat},${pt.lon}`)
      .join('|');
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lon}&destination=${destination.lat},${destination.lon}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''}&travelmode=driving`;
    return url;
  };

  // Function to generate and download a GPX file
  const downloadGPX = () => {
    const exportPoints = (baseAddress && followingAddresses.length > 0)
      ? ((window.route && window.route.optimizedPoints) ? window.route.optimizedPoints : [baseAddress, ...followingAddresses])
      : [];
    if (exportPoints.length < 2) {
      setDownloadGpxError("Please complete entries before downloading");
      return;
    }
    // Resets error message if there are dots
    setDownloadGpxError('');

    let gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="FastPlaneco" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Exported Route</name>
  </metadata>
  <trk>
    <name>FastPlaneco Route</name>
    <trkseg>
`;
    exportPoints.forEach(pt => {
      gpxContent += `      <trkpt lat="${pt.lat}" lon="${pt.lon}">
        <desc>${pt.address}</desc>
      </trkpt>
`;
    });
    gpxContent += `    </trkseg>
  </trk>
</gpx>`;

    const blob = new Blob([gpxContent], { type: 'application/gpx+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'exported_route.gpx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Manage export to Google Maps
  const handleExportGoogle = () => {
    if (!baseAddress || followingAddresses.length === 0) {
      setExportGoogleError("Please complete entries before export");
      return;
    }
    // Resets the error message, then opens the link in a new tab.
    setExportGoogleError("");
    const googleUrl = buildGoogleMapsUrl();
    if (googleUrl !== "") {
      window.open(googleUrl, "_blank", "noopener");
    }
  };

  // Reset messages as soon as entries are complete
  // These messages are displayed dynamically, depending on conditions
  const exportGoogleMessage = entriesComplete
    ? "you can now export your itinerary to Google Maps"
    : "";
  const downloadGpxMessage = entriesComplete
    ? "you can now download a gpx file of your itinerary"
    : "";

  // Optional backup to use route.optimizedPoints via window
  window.route = window.route || null;

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
        {/* Use GPS Coordinates" button added here */}
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

        {/* File import input added */}
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
          {/* Display file name on success or error message */}
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

      {/* Display file name on success or error message */}
      <div className="dataExport">
        <button className='exportButton' onClick={handleExportGoogle} >
          Export to Google Maps
        </button>
        {!entriesComplete && exportGoogleError && (
          <div style={{ color: 'red', fontSize: '12px', marginTop: '4px', textAlign: 'center' }}>
            {exportGoogleError}
          </div>
        )}
        {entriesComplete && (
          <div style={{ color: 'green', fontSize: '12px', marginTop: '4px', textAlign: 'center' }}>
            {exportGoogleMessage}
          </div>
        )}
        <button className='downloadButton' onClick={downloadGPX} >
          Download a GPX file
        </button>
        {!entriesComplete && downloadGpxError && (
          <div style={{ color: 'red', fontSize: '12px', marginTop: '4px', textAlign: 'center' }}>
            {downloadGpxError}
          </div>
        )}
        {entriesComplete && (
          <div style={{ color: 'green', fontSize: '12px', marginTop: '4px', textAlign: 'center' }}>
            {downloadGpxMessage}
          </div>
        )}
      </div>

    </div>
  );
};

export default Sidebar;
