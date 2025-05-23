import React, { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, getUserRole } from '../config/firebase';
import { CircularProgress, Box, Typography } from '@mui/material';

interface ProtectedRouteProps {
  requiredRole?: 'admin' | 'staff';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredRole }) => {
  const [user, loading] = useAuthState(auth);
  const [userRole, setUserRole] = useState<'admin' | 'staff' | null>(null);
  const [isRoleLoading, setIsRoleLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;

    const fetchRole = async () => {
      if (!user) {
        if (isMounted) {
          setUserRole(null);
          setIsRoleLoading(false);
        }
        return;
      }

        try {
          const role = await getUserRole(user.uid);
        if (isMounted) {
          setUserRole(role);
          setError(null);
        }
        } catch (error) {
          console.error("Error fetching user role in ProtectedRoute: ", error);
        if (isMounted) {
          setUserRole(null);
          setError("Failed to verify user role. Please try logging in again.");
        }
        } finally {
        if (isMounted) {
          setIsRoleLoading(false);
        }
      }
    };

    fetchRole();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Show loading spinner during initial auth check or role loading
  if (loading || isRoleLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Show error if role verification failed
  if (error) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role requirement if specified
  if (requiredRole && userRole !== requiredRole) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography color="error">Access Denied. You do not have permission to view this page.</Typography>
      </Box>
    );
  }

  // Render protected content
    return <Outlet />;
};

export default ProtectedRoute; 