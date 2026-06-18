import React, { useState, useEffect } from 'react';

const ME_CITIES = [
    { name: 'Jerusalem', tz: 'Asia/Jerusalem', label: 'Jerusalem (IL)', primary: true },
    { name: 'Washington', tz: 'America/New_York' },
    { name: 'London', tz: 'Europe/London' },
    { name: 'Tehran', tz: 'Asia/Tehran' },
    { name: 'Moscow', tz: 'Europe/Moscow' },
    { name: 'Riyadh', tz: 'Asia/Riyadh' },
    { name: 'Beirut', tz: 'Asia/Beirut' },
    { name: 'Beijing', tz: 'Asia/Shanghai' },
    { name: 'Kyiv', tz: 'Europe/Kyiv' },
];

const INDO_PACIFIC_CITIES = [
    { name: 'Singapore', tz: 'Asia/Singapore', label: 'Singapore (SG)', primary: true },
    { name: 'Bangkok', tz: 'Asia/Bangkok' },
    { name: 'Jakarta', tz: 'Asia/Jakarta' },
    { name: 'Manila', tz: 'Asia/Manila' },
    { name: 'Tokyo', tz: 'Asia/Tokyo' },
    { name: 'Delhi', tz: 'Asia/Kolkata' },
    { name: 'Canberra', tz: 'Australia/Sydney' },
    { name: 'Honolulu', tz: 'Pacific/Honolulu' },
    { name: 'Washington', tz: 'America/New_York' },
];

const THAILAND_CITIES = [
    { name: 'Bangkok', tz: 'Asia/Bangkok', label: 'Bangkok (TH)', primary: true },
    { name: 'Chiang Mai', tz: 'Asia/Bangkok' },
    { name: 'Khon Kaen', tz: 'Asia/Bangkok' },
    { name: 'Phuket', tz: 'Asia/Bangkok' },
    { name: 'Singapore', tz: 'Asia/Singapore' },
    { name: 'Tokyo', tz: 'Asia/Tokyo' },
    { name: 'Beijing', tz: 'Asia/Shanghai' },
    { name: 'Sydney', tz: 'Australia/Sydney' },
    { name: 'London', tz: 'Europe/London' },
    { name: 'Washington', tz: 'America/New_York' },
];

const WorldClock = ({ viewMode = 'middleeast' }) => {
    const cities = viewMode === 'thailand'
        ? THAILAND_CITIES
        : viewMode === 'indopacific'
            ? INDO_PACIFIC_CITIES
            : ME_CITIES;
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (date, timezone, showSeconds = false, showDate = false) => {
        try {
            const options = {
                timeZone: timezone,
                hour: '2-digit',
                minute: '2-digit',
                ...(showSeconds && { second: '2-digit' }),
                hour12: false
            };
            const timeStr = date.toLocaleTimeString('en-US', options);

            if (showDate) {
                const dateOptions = { timeZone: timezone, weekday: 'short', month: 'short', day: 'numeric' };
                const dateStr = date.toLocaleDateString('en-US', dateOptions);
                return { time: timeStr, date: dateStr };
            }
            return { time: timeStr };
        } catch {
            return { time: '--:--', date: '---' };
        }
    };

    return (
        <div className="top-bar-clock">
            {/* Left side secondary clocks */}
            <div className="secondary-clocks-side left-side">
                {cities.filter(c => !c.primary).slice(0, 4).map(city => {
                    const dt = formatTime(currentTime, city.tz);
                    return (
                        <div key={city.name} className="secondary-clock-h">
                            <span className="clock-city-small">{city.name}</span>
                            <span className="clock-time-small">{dt.time}</span>
                        </div>
                    );
                })}
            </div>

            {/* Center Primary Clock */}
            <div className="primary-clock-center">
                {cities.filter(c => c.primary).map(city => {
                    const dt = formatTime(currentTime, city.tz, true, false);
                    return (
                        <div key={city.name} className="primary-clock-content">
                            <div className="clock-city">{city.label || city.name}</div>
                            <div className="clock-time-large">
                                {dt.time.split(':').map((part, i) => (
                                    <React.Fragment key={i}>
                                        <span className={i === 2 ? 'seconds' : ''}>{part}</span>
                                        {i < 2 && <span className="colon">:</span>}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Right side secondary clocks */}
            <div className="secondary-clocks-side right-side">
                {cities.filter(c => !c.primary).slice(4).map(city => {
                    const dt = formatTime(currentTime, city.tz);
                    return (
                        <div key={city.name} className="secondary-clock-h">
                            <span className="clock-city-small">{city.name}</span>
                            <span className="clock-time-small">{dt.time}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default WorldClock;
