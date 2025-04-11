import React, { useState, useRef, useEffect } from 'react';

const CustomSelect = ({ value, onChange, options, placeholder, style }) => {
  const [open, setOpen] = useState(false);
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1);

  const selectRef = useRef(null);

  // Close dropdown when clicked outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (selectRef.current && !selectRef.current.contains(e.target)) {
        setOpen(false);
        setActiveOptionIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get the selected option label or placeholder
  const selectedLabel = options.find(opt => opt.value === value)?.label || placeholder;

  const handleKeyDown = (e) => {
    if (!open) {
      // Open dropdown as soon as an arrow key is pressed
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setOpen(true);
        // Set active index to 0
        setActiveOptionIndex(0);
        e.preventDefault();
        return;
      }
    }
    if (open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveOptionIndex(prev => (prev + 1) % options.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveOptionIndex(prev => (prev - 1 + options.length) % options.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeOptionIndex >= 0 && activeOptionIndex < options.length) {
          onChange(options[activeOptionIndex].value);
          setOpen(false);
          setActiveOptionIndex(-1);
          // Remove focus to remove contour
          selectRef.current.blur();
        }
      } else if (e.key === "Escape") {
        setOpen(false);
        setActiveOptionIndex(-1);
      }
    }
  };

  return (
    <div className='chooseVehicle'
      ref={selectRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={() => setOpen(prev => !prev)}
      style={style}
    >
      {selectedLabel}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: '#fefefe',
            border: '1px solid #ccc',
            zIndex: 1000
          }}
        >
          {options.map((option, index) => (
            <div
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                onChange(option.value);
                setOpen(false);
                setActiveOptionIndex(-1);
                // Remove focus to remove contour after click
                selectRef.current.blur();
              }}
              style={{
                padding: '8px',
                cursor: 'pointer',
                backgroundColor: index === activeOptionIndex ? '#E8E8E8' : '#fefefe',
                fontSize: '13px',
                fontWeight: 'normal'
              }}
              onMouseEnter={() => setActiveOptionIndex(index)}
              onMouseLeave={() => setActiveOptionIndex(-1)}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
