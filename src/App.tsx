import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Sales from './pages/Sales';
import Purchases from './pages/Purchases';
import Adjustments from './pages/Adjustments';
import PageWrapper from './components/PageWrapper';
import ProtectedRoute from './components/ProtectedRoute';
import Admin from './pages/Admin';
import UserManagement from './pages/UserManagement';

function App() {
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const theme = createTheme({
    palette: {
      mode,
      primary: {
        main: '#1976d2',
      },
      secondary: {
        main: '#dc004e',
      },
    },
  });

  const toggleTheme = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Navbar mode={mode} toggleTheme={toggleTheme} />
        <Routes>
          <Route path="/login" element={<PageWrapper><Login /></PageWrapper>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<PageWrapper><Dashboard /></PageWrapper>} />
            <Route path="/inventory" element={<PageWrapper><Inventory /></PageWrapper>} />
            <Route path="/profile" element={<PageWrapper><Profile /></PageWrapper>} />
            <Route path="/sales" element={<PageWrapper><Sales /></PageWrapper>} />
            <Route path="/purchases" element={<PageWrapper><Purchases /></PageWrapper>} />
            <Route path="/adjustments" element={<PageWrapper><Adjustments /></PageWrapper>} />
            <Route element={<ProtectedRoute requiredRole="admin" />}>
              <Route path="/users" element={<PageWrapper><UserManagement /></PageWrapper>} />
              <Route path="/admin" element={<PageWrapper><Admin /></PageWrapper>} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App; 