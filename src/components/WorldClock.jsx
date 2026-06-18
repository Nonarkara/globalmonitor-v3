import React, { useEffect, useRef, memo } from 'react';

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

const SecondaryClock = memo(({ city, timeRef }) => (
    <div className="secondary-clock-h">
        <span className="clock-city-small">{city.name}</span>
        <span className="clock-time-small" ref={timeRef} aria-live="off">--:--</span>
    </div>
));
SecondaryClock.displayName = 'SecondaryClock';

/** Primary clock ticks via ref — no parent React re-render every second. */
const PrimaryClock = memo(({ city, timeRef }) => (
    <div className="primary-clock-content">
        <div className="clock-city">{city.label || city.name}</div>
        <div className="clock-time-large" ref={timeRef} aria-live="off">--:--:--</div>
    </div>
));
PrimaryClock.displayName = 'PrimaryClock';

const WorldClock = ({ viewMode = 'middleeast' }) => {
    const cities = viewMode === 'thailand'
        ? THAILAND_CITIES
        : viewMode === 'indopacific'
            ? INDO_PACIFIC_CITIES
            : ME_CITIES;

    const primaryTimeRef = useRef(null);
    const secondaryTimeRefs = useRef([]);

    const primaryCity = cities.find((city) => city.primary) || cities[0];
    const secondaryCities = cities.filter((city) => !city.primary);

    useEffect(() => {
        secondaryTimeRefs.current = secondaryTimeRefs.current.slice(0, secondaryCities.length);

        let lastMinute = -1;

        const tick = () => {
            const now = new Date();
            if (primaryTimeRef.current) {
                primaryTimeRef.current.textContent = formatTime(now, primaryCity.tz, true);
            }

            const minute = now.getMinutes();
            if (minute !== lastMinute) {
                lastMinute = minute;
                secondaryCities.forEach((city, index) => {
                    const el = secondaryTimeRefs.current[index];
                    if (el) {
                        el.textContent = formatTime(now, city.tz, false);
                    }
                });
            }
        };

        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [primaryCity.tz, secondaryCities]);

    return (
        <div className="top-bar-clock">
            <div className="secondary-clocks-side left-side">
                {secondaryCities.slice(0, 4).map((city, index) => (
                    <SecondaryClock
                        key={city.name}
                        city={city}
                        timeRef={(el) => { secondaryTimeRefs.current[index] = el; }}
                    />
                ))}
            </div>

            <div className="primary-clock-center">
                <PrimaryClock city={primaryCity} timeRef={primaryTimeRef} />
            </div>

            <div className="secondary-clocks-side right-side">
                {secondaryCities.slice(4).map((city, index) => (
                    <SecondaryClock
                        key={city.name}
                        city={city}
                        timeRef={(el) => { secondaryTimeRefs.current[index + 4] = el; }}
                    />
                ))}
            </div>
        </div>
    );
};

export default memo(WorldClock);
