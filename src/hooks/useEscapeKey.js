import { useEffect } from 'react';

/**
 * Listen for the Escape key while a modal is open and call onEscape.
 * Use in every modal component to support keyboard dismissal.
 */
export function useEscapeKey(isOpen, onEscape) {
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onEscape?.();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onEscape]);
}
