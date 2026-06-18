import React, { useState, useEffect, memo } from 'react';

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

const formatTime = (date, timezone, showSeconds = false) => {
    try {
        const options = {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            ...(showSeconds && { second: '2-digit' }),
            hour12: false
        };
        return date.toLocaleTimeString('en-GB', options);
    } catch {
        return showSeconds ? '--:--:--' : '--:--';
    }
};

const SecondaryClock = memo(({ city, time }) => (
    <div className="secondary-clock-h">
        <span className="clock-city-small">{city.name}</span>
        <span className="clock-time-small">{time}</span>
    </div>
));
SecondaryClock.displayName = 'SecondaryClock';

const PrimaryClock = memo(({ city, time }) => (
    <div className="primary-clock-content">
        <div className="clock-city">{city.label || city.name}</div>
        <div className="clock-time-large" aria-live="off">{time}</div>
    </div>
));
PrimaryClock.displayName = 'PrimaryClock';

const WorldClock = ({ viewMode = 'middleeast' }) => {
    const cities = viewMode === 'thailand'
        ? THAILAND_CITIES
        : viewMode === 'indopacific'
            ? INDO_PACIFIC_CITIES
            : ME_CITIES;
    const [currentTime, setCurrentTime] = useState(() => new Date());
    const [minuteBucket, setMinuteBucket] = useState(() => Math.floor(Date.now() / 60000));

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            setCurrentTime(now);
            const nextBucket = Math.floor(now.getTime() / 60000);
            setMinuteBucket((prev) => (prev === nextBucket ? prev : nextBucket));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const primaryCity = cities.find((city) => city.primary) || cities[0];
    const secondaryCities = cities.filter((city) => !city.primary);
    const primaryTime = formatTime(currentTime, primaryCity.tz, true);
    const secondaryTimes = secondaryCities.map((city) => ({
        city,
        time: formatTime(new Date(minuteBucket * 60000), city.tz, false)
    }));

    return (
        <div className="top-bar-clock">
            <div className="secondary-clocks-side left-side">
                {secondaryTimes.slice(0, 4).map(({ city, time }) => (
                    <SecondaryClock key={city.name} city={city} time={time} />
                ))}
            </div>

            <div className="primary-clock-center">
                <PrimaryClock city={primaryCity} time={primaryTime} />
            </div>

            <div className="secondary-clocks-side right-side">
                {secondaryTimes.slice(4).map(({ city, time }) => (
                    <SecondaryClock key={city.name} city={city} time={time} />
                ))}
            </div>
        </div>
    );
};

export default memo(WorldClock);
