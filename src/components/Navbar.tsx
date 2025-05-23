import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Switch,
  Tooltip,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Divider
} from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import InventoryIcon from '@mui/icons-material/Inventory';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ListAltIcon from '@mui/icons-material/ListAlt';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import LogoutIcon from '@mui/icons-material/Logout';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import TuneIcon from '@mui/icons-material/Tune';
import PeopleIcon from '@mui/icons-material/People';
import { auth, getUserRole } from '../config/firebase';
import { signOut } from 'firebase/auth';

interface NavbarProps {
  mode: 'light' | 'dark';
  toggleTheme: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ mode, toggleTheme }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'staff' | null>(null);

  const handleDrawerToggle = () => setDrawerOpen((prev) => !prev);
  const handleAvatarClick = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);
  const handleLogout = async () => {
    handleMenuClose();
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const user = auth.currentUser;

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const role = await getUserRole(user.uid);
        setCurrentUserRole(role);
      } else {
        setCurrentUserRole(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      // This effect runs when the user object changes, which includes photoURL updates
      // No specific action needed here other than relying on the user object in JSX
    }
  }, [user]);

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <InventoryIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Inventory Manager
          </Typography>
          <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <Switch
              checked={mode === 'dark'}
              onChange={toggleTheme}
              icon={<Brightness7Icon />}
              checkedIcon={<Brightness4Icon />}
              color="default"
              sx={{ ml: 2 }}
            />
          </Tooltip>
          <IconButton color="inherit" onClick={handleAvatarClick} sx={{ ml: 2 }}>
            <Avatar alt="User" src={user?.photoURL || ''}>
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </Avatar>
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
            <MenuItem disabled>
              Role: <b style={{ marginLeft: 8 }}>{currentUserRole === 'admin' ? 'Admin' : 'Staff'}</b>
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { handleMenuClose(); navigate('/profile'); }}>Profile</MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <LogoutIcon fontSize="small" sx={{ mr: 1 }} /> Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Drawer anchor="left" open={drawerOpen} onClose={handleDrawerToggle}>
        <Box sx={{ width: 250 }} role="presentation" onClick={handleDrawerToggle}>
          <List>
            <ListItem disablePadding>
              <ListItemButton component={RouterLink} to="/">
                <ListItemIcon><DashboardIcon /></ListItemIcon>
                <ListItemText primary="Dashboard" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton component={RouterLink} to="/inventory">
                <ListItemIcon><ListAltIcon /></ListItemIcon>
                <ListItemText primary="Inventory" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton component={RouterLink} to="/sales">
                <ListItemIcon><ShoppingCartIcon /></ListItemIcon>
                <ListItemText primary="Sales" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton component={RouterLink} to="/purchases">
                <ListItemIcon><ReceiptLongIcon /></ListItemIcon>
                <ListItemText primary="Purchases" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton component={RouterLink} to="/adjustments">
                <ListItemIcon><TuneIcon /></ListItemIcon>
                <ListItemText primary="Adjustments" />
              </ListItemButton>
            </ListItem>
            {currentUserRole === 'admin' && (
              <>
                <ListItem disablePadding>
                  <ListItemButton component={RouterLink} to="/users">
                    <ListItemIcon><PeopleIcon /></ListItemIcon>
                    <ListItemText primary="User Management" />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton component={RouterLink} to="/admin">
                    <ListItemIcon><i className="fas fa-user-shield"></i></ListItemIcon>
                    <ListItemText primary="Admin" />
                  </ListItemButton>
                </ListItem>
              </>
            )}
          </List>
        </Box>
      </Drawer>
    </>
  );
};

export default Navbar; 