import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import PageOne from './pages/PageOne';
import PageTwo from './pages/PageTwo';

function App() {
  return (
    <Router>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/page-one">Page One</Link>
        <Link to="/page-two">Page Two</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/page-one" element={<PageOne />} />
        <Route path="/page-two" element={<PageTwo />} />
      </Routes>
    </Router>
  );
}



export default App;