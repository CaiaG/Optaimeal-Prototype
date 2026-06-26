import styles from './Home.module.css';
import { useNavigate } from 'react-router-dom';

const Home: React.FC = () => {

  const navigate = useNavigate();

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <div className={styles.container}>
      <nav className={styles.nav}>
        <h2 className={styles.logo}>Optaimeal</h2>
      </nav>

      <main className={styles.hero}>
        <h1>Prototype</h1>

        <div className={styles.grid}>
          <div className={styles.card}>
            <h3>For Kitchens</h3>
            <p>...</p>

            <button className={styles.btnRed} onClick={() => handleNavigation('/client')}>
              Client
            </button>
          </div>

          <div className={styles.card}>
            <h3>For Operators</h3>
            <p>...</p>
            <button className={styles.btnGreen} onClick={() => handleNavigation('/opp')}>
              Operator
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;