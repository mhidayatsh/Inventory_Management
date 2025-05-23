import React, { useState, useEffect } from 'react';
import { Container, Typography, Box, CircularProgress, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button, FormControl, InputLabel, Select, MenuItem, Snackbar, TextField } from '@mui/material';
import { collection, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Edit as EditIcon } from '@mui/icons-material';
import MuiAlert, { AlertProps } from '@mui/material/Alert';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, getUserRole } from '../config/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';

interface UserRecord {
  id: string;
  email: string;
  role: 'admin' | 'staff';
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for Edit Dialog
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'staff'>('staff');

  // State for Snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  // State for Add User Dialog
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'staff'>('staff');
  const [isAddingUser, setIsAddingUser] = useState(false);

  // Current authenticated user and their role
  const [user] = useAuthState(auth);
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'staff' | null>(null);
  const [isCurrentUserRoleLoading, setIsCurrentUserRoleLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        const usersCollectionRef = collection(db, 'users');
        const querySnapshot = await getDocs(usersCollectionRef);
        const usersList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as UserRecord[];
        setUsers(usersList);
      } catch (error: any) {
        console.error("Error fetching users: ", error);
        setError('Failed to load users data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Fetch the current user's role when the user object changes
  useEffect(() => {
    const fetchRole = async () => {
      console.log("useEffect [user]: User object changed", user);
      if (user) {
        setIsCurrentUserRoleLoading(true);
        console.log("useEffect [user]: Fetching role for user ID:", user.uid);
        try {
          const role = await getUserRole(user.uid);
          console.log("useEffect [user]: Fetched role:", role);
          setCurrentUserRole(role);
        } catch (error) {
          console.error("Error fetching current user role in UserManagement: ", error);
          setCurrentUserRole(null);
        } finally {
          setIsCurrentUserRoleLoading(false);
          console.log("useEffect [user]: isCurrentUserRoleLoading set to false");
        }
      } else {
        setCurrentUserRole(null);
        setIsCurrentUserRoleLoading(false);
        console.log("useEffect [user]: User is null, setting role to null and loading to false");
      }
    };

    fetchRole();
  }, [user]);

  // Handlers for Edit Dialog
  const handleOpenEditDialog = (user: UserRecord) => {
    setEditingUser(user);
    setSelectedRole(user.role);
    setOpenEditDialog(true);
  };

  const handleCloseEditDialog = () => {
    setOpenEditDialog(false);
    setEditingUser(null);
    setSelectedRole('staff');
  };

  const handleRoleChange = (event: any) => {
    setSelectedRole(event.target.value as 'admin' | 'staff');
  };

  const handleSaveRole = async () => {
    if (editingUser) {
      setLoading(true);
      try {
        const userDocRef = doc(db, 'users', editingUser.id);
        await updateDoc(userDocRef, {
          role: selectedRole
        });
        setUsers(users.map(user => user.id === editingUser.id ? { ...user, role: selectedRole } : user));
        setSnackbar({ open: true, message: 'User role updated successfully!', severity: 'success' });
        handleCloseEditDialog();
      } catch (error) {
        console.error("Error updating user role: ", error);
        setSnackbar({ open: true, message: 'Failed to update user role.', severity: 'error' });
      } finally {
        setLoading(false);
      }
    }
  };

  // Handlers for Add User Dialog
  const handleOpenAddDialog = () => {
    setOpenAddDialog(true);
    setNewUserEmail('');
    setNewUserPassword('');
    setNewUserRole('staff');
  };

  const handleCloseAddDialog = () => {
    setOpenAddDialog(false);
    setIsAddingUser(false);
  };

  const handleAddNewUser = async () => {
    setIsAddingUser(true);
    try {
      // Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, newUserEmail, newUserPassword);
      const userId = userCredential.user.uid;

      // Add user role to Firestore
      await setDoc(doc(db, 'users', userId), {
        email: newUserEmail,
        role: newUserRole,
      });

      // Refresh the user list
      const usersCollectionRef = collection(db, 'users');
      const querySnapshot = await getDocs(usersCollectionRef);
      const usersList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as UserRecord[];
      setUsers(usersList);

      setSnackbar({ open: true, message: 'User added successfully!', severity: 'success' });
      handleCloseAddDialog();
    } catch (error: any) {
      console.error("Error adding new user: ", error);
      setSnackbar({ open: true, message: `Failed to add user: ${error.message}`, severity: 'error' });
    } finally {
      setIsAddingUser(false);
    }
  };

  console.log("UserManagement Render: currentUserRole:", currentUserRole, "isCurrentUserRoleLoading:", isCurrentUserRoleLoading);

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>User Management</Typography>

      {loading || isCurrentUserRoleLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Typography color="error" align="center" sx={{ mt: 4 }}>
          {error}
        </Typography>
      ) : (currentUserRole && currentUserRole === 'admin') ? (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="contained" color="primary" onClick={handleOpenAddDialog}>
              Add New User
            </Button>
          </Box>
          <Paper sx={{ p: 2 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.role}</TableCell>
                      <TableCell>
                        <IconButton
                          color="primary"
                          size="small"
                          onClick={() => handleOpenEditDialog(user)}
                          disabled={currentUserRole !== 'admin'}
                        >
                          <EditIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        No users found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Dialog open={openEditDialog} onClose={handleCloseEditDialog}>
            <DialogTitle>Edit User Role</DialogTitle>
            <DialogContent>
              {editingUser && (
                <Box sx={{ minWidth: 300 }}>
                  <Typography variant="body1" gutterBottom>Email: {editingUser.email}</Typography>
                  <FormControl fullWidth variant="outlined" margin="dense">
                    <InputLabel id="role-select-label">Role</InputLabel>
                    <Select
                      labelId="role-select-label"
                      id="role-select"
                      value={selectedRole}
                      label="Role"
                      onChange={handleRoleChange}
                    >
                      <MenuItem value="admin">Admin</MenuItem>
                      <MenuItem value="staff">Staff</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseEditDialog}>Cancel</Button>
              <Button onClick={handleSaveRole} color="primary" disabled={currentUserRole !== 'admin'}>Save</Button>
            </DialogActions>
          </Dialog>

          <Dialog open={openAddDialog} onClose={handleCloseAddDialog}>
            <DialogTitle>Add New User</DialogTitle>
            <DialogContent>
              <TextField
                autoFocus
                margin="dense"
                label="Email Address"
                type="email"
                fullWidth
                variant="outlined"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
              />
              <TextField
                margin="dense"
                label="Password"
                type="password"
                fullWidth
                variant="outlined"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
              />
               <FormControl fullWidth variant="outlined" margin="dense" sx={{ mt: 1 }}>
                <InputLabel id="new-role-select-label">Role</InputLabel>
                <Select
                  labelId="new-role-select-label"
                  id="new-role-select"
                  value={newUserRole}
                  label="Role"
                  onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'staff')}
                >
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="staff">Staff</MenuItem>
                </Select>
              </FormControl>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseAddDialog} disabled={isAddingUser}>Cancel</Button>
              <Button onClick={handleAddNewUser} color="primary" disabled={isAddingUser}>
                {isAddingUser ? <CircularProgress size={24} /> : 'Add User'}
              </Button>
            </DialogActions>
          </Dialog>
        </>
      ) : (
        <Typography variant="h6" color="error" align="center">Access Denied. Only administrators can manage users.</Typography>
      )}

      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <MuiAlert elevation={6} variant="filled" severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </MuiAlert>
      </Snackbar>
    </Container>
  );
};

export default UserManagement; 