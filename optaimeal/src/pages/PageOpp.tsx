import styles from './PageClient.module.css';
import { useState, useEffect } from 'react';

export default function PageOpp() {

  const [activeView, setActiveView] = useState('main'); 

  useEffect(() => {
      
  }, []);

  return (
    <div className="opp-container">
      <div className={styles.sidebar_wrapper}>
        <nav className={styles.top_sidebar}>
          <button className={styles.top_sidebar_btn} onClick={() => setActiveView('home')}>Main</button>
          <button className={styles.top_sidebar_btn} onClick={() => setActiveView('generate')}>Generate</button>
          <button className={styles.top_sidebar_btn} onClick={() => setActiveView('calendar')}>Calendar</button>
          <button className={styles.top_sidebar_btn} onClick={() => setActiveView('saved')}>Saved</button>

        </nav>
      </div>

      <main>
        {activeView === 'home' ? (
          
          <p>a</p>

        // Chat interface
        ) : activeView === 'generate' ? (
          <p>b</p>

        ) : activeView === 'calendar' ? (

          <p>c</p>
        ) : activeView === 'saved' ? (
          <p>d</p>
        ) : (
          <p>e</p>
        )}
      </main>
    </div>
  );
}