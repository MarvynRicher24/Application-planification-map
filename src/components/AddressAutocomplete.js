import React, { useState, useEffect, useRef } from 'react';

const AddressAutocomplete = ({ placeholder, onSelect }) => {
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
    const apiKey = 'a920f1061aa14d3a9db4657483e68d9c';
    const containerRef = useRef(null);
    const controllerRef = useRef(null);
    const inputRef = useRef(null); // Input reference

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setSuggestions([]);
                setActiveSuggestionIndex(-1);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        // If the entry is too short, empty the suggestions and reset the active index.
        if (inputValue.length < 3) {
            setSuggestions([]);
            setActiveSuggestionIndex(-1);
            return;
        }

        // Cancels the previous query if it exists
        if (controllerRef.current) {
            controllerRef.current.abort();
        }
        const controller = new AbortController();
        controllerRef.current = controller;

        const timeoutId = setTimeout(async () => {
            try {
                const response = await fetch(
                    `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(inputValue)}&limit=5&apiKey=${apiKey}`,
                    { signal: controller.signal }
                );
                const data = await response.json();
                if (data && data.features) {
                    setSuggestions(data.features);
                    setActiveSuggestionIndex(-1);
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error("Erreur lors de la récupération des suggestions :", error);
                }
            }
        }, 300); // 300ms debounce

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [inputValue, apiKey]);

    const handleSelect = (item) => {
        const { properties, geometry } = item;
        onSelect({
            address: properties.formatted,
            lat: geometry.coordinates[1],
            lon: geometry.coordinates[0],
        });
        // Clean input and reset suggestions
        setInputValue('');
        setSuggestions([]);
        setActiveSuggestionIndex(-1);
        // Remove focus from input after selection
        if (inputRef.current) {
            inputRef.current.blur();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (suggestions.length > 0) {
                setActiveSuggestionIndex((prevIndex) => {
                    const nextIndex = prevIndex + 1;
                    return nextIndex >= suggestions.length ? 0 : nextIndex;
                });
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (suggestions.length > 0) {
                setActiveSuggestionIndex((prevIndex) => {
                    const nextIndex = prevIndex - 1;
                    return nextIndex < 0 ? suggestions.length - 1 : nextIndex;
                });
            }
        } else if (e.key === 'Enter') {
            if (activeSuggestionIndex !== -1 && suggestions.length > 0) {
                e.preventDefault();
                handleSelect(suggestions[activeSuggestionIndex]);
            }
        }
    };

    return (
        <div className="autocomplete" ref={containerRef}>
            <input
                ref={inputRef}
                name='autocomplete'
                type="text"
                placeholder={placeholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                    width: '100%', border: "none",
                    borderRadius: "10px"
                }}
            />
            {suggestions.length > 0 && (
                <ul className="suggestions" style={{
                    position: 'absolute',
                    zIndex: 1000,
                    background: '#fefefe',
                    listStyle: 'none',
                    marginTop: -8,
                    padding: '5px',
                    border: '1px solid #D9D9D9',
                    fontSize: '13px',
                }}>
                    {suggestions.map((item, index) => (
                        <li
                            key={index}
                            onMouseEnter={() => setActiveSuggestionIndex(index)}
                            onMouseLeave={() => setActiveSuggestionIndex(-1)}
                            style={{
                                padding: '5px',
                                marginBottom: 5,
                                cursor: 'pointer',
                                background: index === activeSuggestionIndex ? '#E8E8E8' : 'transparent'
                            }}
                            onClick={() => handleSelect(item)}
                        >
                            {item.properties.formatted}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default AddressAutocomplete;
