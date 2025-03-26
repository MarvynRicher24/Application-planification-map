// src/components/Sidebar.js
import React from 'react';
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
        />
      </div>

      <div className='zoneBaseAddress'>
        <AddressAutocomplete
          placeholder="Enter your base address"
          onSelect={handleBaseSelect}
        />
        {baseAddress && (
          <div className='entryBaseAddress'>
            <span style={{ width: "90%", fontSize: "14px" }}>{baseAddress.address}</span>
            <button onClick={handleDeleteBase} style={{ width: '3rem', background: '#e8e8e8', fontSize: '16px', cursor: 'pointer', border: "none", borderRadius: "10px" }}>×</button>
          </div>
        )}
      </div>

      <div className='zoneSecondAddress'>
        <AddressAutocomplete
          placeholder="Enter following address"
          onSelect={handleFollowingSelect}
        />
        <h2 className='yourFollowingAddress'>Your following address :</h2>
        {followingAddresses.map((addr, index) => (
          <div key={index} className='entrySecondAddress'>
            <span style={{ width: "90%", fontSize: "14px" }}>{addr.address}</span>
            <button onClick={() => handleDeleteFollowing(index)} style={{ width: '3rem', background: '#e8e8e8', fontSize: '16px', cursor: 'pointer', border: "none", borderRadius: "10px" }}>×</button>
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
