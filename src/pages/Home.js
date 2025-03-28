import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../index.css'; 

const Home = () => {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate('/main');
  };

  return (
    <div className="home-container">
      <h1 className="home-title">FastPlaneco</h1>
      <button className="start-button" onClick={handleStart}>
        let's get started
      </button>
    </div>
  );
};

export default Home;
