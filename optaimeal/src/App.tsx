import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import PageClient from './pages/PageClient';
import PageOpp from './pages/PageOpp';
import { useEffect } from 'react';

function App() {

  // example call
  useEffect(() => {
    // connect to backend
    fetch('http://localhost:8000/')
      .then((response) => response.json())
      
      .catch((error) => console.error("Error connecting to backend:", error));
  }, []);

  return (
    <Router>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/client">Page Client</Link>
        <Link to="/opp">Page Opp</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/client" element={<PageClient />} />
        <Route path="/opp" element={<PageOpp />} />
      </Routes>
    </Router>
  );
}



export default App;