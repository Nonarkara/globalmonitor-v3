import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Clock, Play, Pause, SkipBack } from 'lucide-react';
import { WAR_START } from '../data/warConstants';

const formatDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const daysSince = (d) => Math.floor((d - WAR_START) / 86400000);
const getToday = () => new Date();

const TimeMachine = ({ onDateChange }) => {
    const [today, setToday] = useState(getToday);
    const [selectedDate, setSelectedDate] = useState(getToday);
    const [playing, setPlaying] = useState(false);
    const intervalRef = useRef(null);

    const totalDays = daysSince(today);
    const currentDay = daysSince(selectedDate);

    const handleSliderChange = useCallback((e) => {
        const dayOffset = parseInt(e.target.value, 10);
        const d = new Date(WAR_START);
        d.setDate(d.getDate() + dayOffset);
        setSelectedDate(d);
        onDateChange?.(d);
    }, [onDateChange]);

    const resetToNow = useCallback(() => {
        setSelectedDate(today);
        setPlaying(false);
        onDateChange?.(today);
    }, [today, onDateChange]);

    useEffect(() => {
        const timer = setInterval(() => setToday(getToday()), 60 * 1000);
        return () => clearInterval(timer);
    }, []);

    // Auto-play animation
    useEffect(() => {
        if (playing) {
            intervalRef.current = setInterval(() => {
                setSelectedDate(prev => {
                    const next = new Date(prev);
                    next.setDate(next.getDate() + 1);
                    if (next > today) {
                        setPlaying(false);
                        return today;
                    }
                    onDateChange?.(next);
                    return next;
                });
            }, 800);
        } else {
            clearInterval(intervalRef.current);
        }
        return () => clearInterval(intervalRef.current);
    }, [playing, today, onDateChange]);

    const togglePlay = () => {
        if (currentDay >= totalDays) {
            // Reset to start if at end
            const d = new Date(WAR_START);
            setSelectedDate(d);
            onDateChange?.(d);
        }
        setPlaying(p => !p);
    };

    const isLive = currentDay >= totalDays;

    return (
        <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 15,
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '12px',
            background: 'rgba(22, 28, 40, 0.85)',
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(16px)',
            minWidth: '380px'
        }}>
            <Clock size={13} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />

            <button onClick={togglePlay} style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '6px',
                padding: '3px 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: 'rgba(255,255,255,0.7)'
            }}>
                {playing ? <Pause size={11} /> : <Play size={11} />}
            </button>

            <button onClick={resetToNow} style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: 'rgba(255,255,255,0.4)',
                padding: '3px'
            }}>
                <SkipBack size={11} />
            </button>

            <input
                type="range"
                min={0}
                max={totalDays}
                value={currentDay}
                onChange={handleSliderChange}
                style={{
                    flex: 1,
                    height: '3px',
                    cursor: 'pointer',
                    accentColor: '#3b82f6'
                }}
            />

            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                lineHeight: 1.2,
                flexShrink: 0
            }}>
                <span style={{
                    fontSize: '0.6rem',
                    fontFamily: 'var(--font-mono)',
                    color: isLive ? '#22c55e' : '#f59e0b',
                    fontWeight: 600,
                    letterSpacing: '0.5px'
                }}>
                    {isLive ? 'LIVE' : `DAY ${currentDay}`}
                </span>
                <span style={{
                    fontSize: '0.55rem',
                    color: 'rgba(255,255,255,0.5)',
                    fontFamily: 'var(--font-mono)'
                }}>
                    {formatDate(selectedDate)}
                </span>
            </div>
        </div>
    );
};

export default TimeMachine;
