import { useState, useEffect } from 'react';
import HomeworkWidget from '../components/journal/HomeworkWidget';

export default function JournalHomework() {
  const [isReady, setIsReady] = useState(false);

  // Hardware-aware smart deferral to ensure smooth sidebar transition animation
  useEffect(() => {
    let idleId: any;

    const scheduleRender = () => {
      if (typeof (window as any).requestIdleCallback === 'function') {
        idleId = (window as any).requestIdleCallback(() => {
          setIsReady(true);
        }, { timeout: 200 }); // Maximum fallback timeout of 200ms
      } else {
        idleId = setTimeout(() => {
          setIsReady(true);
        }, 150);
      }
    };

    setIsReady(false);

    // Double requestAnimationFrame ensures that the browser has scheduled the transition
    // and performed at least one paint cycle before we start checking for idle time.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scheduleRender();
      });
    });

    return () => {
      if (typeof (window as any).cancelIdleCallback === 'function') {
        (window as any).cancelIdleCallback(idleId);
      } else {
        clearTimeout(idleId);
      }
    };
  }, []);

  return isReady ? <HomeworkWidget /> : null;
}
