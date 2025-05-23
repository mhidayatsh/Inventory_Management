import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  CircularProgress,
  TableSortLabel,
  TablePagination
} from '@mui/material';
import MuiAlert from '@mui/material/Alert';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, deleteUser, onAuthStateChanged } from 'firebase/auth';
import { db, auth, getUserRole } from '../config/firebase';
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';

interface AppUser {
  id: string;
  email: string;
  role: 'admin' | 'staff';
  uid: string;
}

const Admin: React.FC = () => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [newUserFormData, setNewUserFormData] = useState({
    email: '',
    password: '',
    role: 'staff' as 'admin' | 'staff',
  });
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'staff' | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<AppUser | null>(null);
  const [editingRole, setEditingRole] = useState<'admin' | 'staff'>('staff');
  const [loading, setLoading] = useState(true);

  // Table state
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [orderBy, setOrderBy] = useState<keyof AppUser>('email');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Define fetchUsers function outside of useEffect
  const fetchUsers = async () => {
    setLoading(true); // Set loading true before fetching users
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AppUser[];
      setUsers(usersList);
    } catch (error) {
      console.error("Error fetching users:", error);
      setSnackbar({ open: true, message: 'Error fetching users.', severity: 'error' });
    } finally {
      setLoading(false); // Set loading false after fetching users
    }
  };

  // Effect to fetch current user's role when auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const role = await getUserRole(user.uid);
          setCurrentUserRole(role);
        } catch (error) {
          console.error("Error fetching current user role in Admin:", error);
          setCurrentUserRole(null);
        }
      } else {
        setCurrentUserRole(null);
        // If user logs out, stop loading state related to role
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Effect to fetch users when currentUserRole is determined to be admin
  useEffect(() => {
    // Fetch users only when currentUserRole is determined (not null) and is admin
    if (currentUserRole === 'admin') {
      fetchUsers(); // Call the independently defined fetchUsers
    } else if (currentUserRole !== null) {
      // If role is determined (not null) and not admin, stop loading users
      setUsers([]); // Clear users list for non-admins
      setLoading(false);
    }
  }, [currentUserRole]); // Depend on currentUserRole

  const handleTextInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewUserFormData({ ...newUserFormData, [name as string]: value });
  };

  const handleRoleChange = (event: SelectChangeEvent<'admin' | 'staff'>) => {
    const { name, value } = event.target;
    setNewUserFormData({ ...newUserFormData, [name as string]: value });
  };

  const handleCreateUser = async () => {
    if (!newUserFormData.email || !newUserFormData.password) {
      setSnackbar({ open: true, message: 'Please fill in all fields', severity: 'error' });
      return;
    }

    const prevLoadingState = loading;
    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, newUserFormData.email, newUserFormData.password);
      const firebaseUser = userCredential.user;

      await setDoc(doc(db, 'users', firebaseUser.uid), {
        uid: firebaseUser.uid,
        email: newUserFormData.email,
        role: newUserFormData.role,
      });

      setSnackbar({ open: true, message: 'User created successfully!', severity: 'success' });
      setNewUserFormData({ email: '', password: '', role: 'staff' });
      fetchUsers(); // Call the independently defined fetchUsers
    } catch (error: any) {
      console.error("Error creating user:", error);
      setSnackbar({ open: true, message: `Error creating user: ${error.message}`, severity: 'error' });
      if (!prevLoadingState) {
        setLoading(false);
      }
    } finally {
      if (!prevLoadingState) {
        setLoading(false);
      }
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    const prevLoadingState = loading;
    setLoading(true);

    try {
      await deleteDoc(doc(db, 'users', userToDelete.id));

      setSnackbar({ open: true, message: 'User deleted successfully!', severity: 'success' });
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      fetchUsers(); // Call the independently defined fetchUsers
    } catch (error: any) {
      console.error("Error deleting user:", error);
      setSnackbar({ open: true, message: `Error deleting user: ${error.message}`, severity: 'error' });
      if (!prevLoadingState) {
        setLoading(false);
      }
    } finally {
      if (!prevLoadingState) {
        setLoading(false);
      }
    }
  };

  const openDeleteDialog = (user: AppUser) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setUserToDelete(null);
  };

  const openEditDialog = (user: AppUser) => {
    setUserToEdit(user);
    setEditingRole(user.role);
    setEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setEditDialogOpen(false);
    setUserToEdit(null);
    setEditingRole('staff');
  };

  const handleSaveEditedRole = async () => {
    if (!userToEdit) return;

    const prevLoadingState = loading;
    setLoading(true);

    try {
      await updateDoc(doc(db, 'users', userToEdit.id), {
        role: editingRole
      });

      setSnackbar({ open: true, message: `${userToEdit.email}'s role updated to ${editingRole}!`, severity: 'success' });
      closeEditDialog();
      fetchUsers(); // Call the independently defined fetchUsers
    } catch (error: any) {
      console.error("Error updating user role:", error);
      setSnackbar({ open: true, message: `Error updating user role: ${error.message}`, severity: 'error' });
      if (!prevLoadingState) {
        setLoading(false);
      }
    } finally {
      if (!prevLoadingState) {
        setLoading(false);
      }
    }
  };

  // Table sorting logic
  const handleRequestSort = (
    event: React.MouseEvent<unknown>,
    property: keyof AppUser,
  ) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  // Table pagination logic
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Sorting and Pagination of users list
  const sortedUsers = React.useMemo(() => {
    const comparator = (a: AppUser, b: AppUser) => {
      const valueA = a[orderBy];
      const valueB = b[orderBy];

      if (valueB < valueA) {
        return order === 'asc' ? 1 : -1;
      }
      if (valueB > valueA) {
        return order === 'asc' ? -1 : 1;
      }
      return 0;
    };
    return [...users].sort(comparator);
  }, [order, orderBy, users]);

  const visibleUsers = React.useMemo(
    () =>
      sortedUsers.slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage,
      ),
    [page, rowsPerPage, sortedUsers],
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : currentUserRole === 'admin' ? (
        <>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>Create New User</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column', maxWidth: 400 }}>
              <TextField
                label="Email"
                name="email"
                type="email"
                value={newUserFormData.email}
                onChange={handleTextInputChange}
                fullWidth
              />
              <TextField
                label="Password"
                name="password"
                type="password"
                value={newUserFormData.password}
                onChange={handleTextInputChange}
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  label="Role"
                  name="role"
                  value={newUserFormData.role}
                  onChange={handleRoleChange}
                >
                  <MenuItem value="staff">Staff</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                </Select>
              </FormControl>
              <Button variant="contained" onClick={handleCreateUser} disabled={loading}>
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Create User'}
              </Button>
            </Box>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Existing Users</Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell key="email" sortDirection={orderBy === 'email' ? order : false}>
                      <TableSortLabel
                        active={orderBy === 'email'}
                        direction={orderBy === 'email' ? order : 'asc'}
                        onClick={(event) => handleRequestSort(event, 'email')}
                      >
                        Email
                      </TableSortLabel>
                    </TableCell>
                    <TableCell key="role" sortDirection={orderBy === 'role' ? order : false}>
                      <TableSortLabel
                        active={orderBy === 'role'}
                        direction={orderBy === 'role' ? order : 'asc'}
                        onClick={(event) => handleRequestSort(event, 'role')}
                      >
                        Role
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.role}</TableCell>
                      <TableCell>
                         <IconButton size="small" onClick={() => openEditDialog(user)} disabled={user.uid === auth.currentUser?.uid}>
                           <EditIcon />
                         </IconButton>
                         <IconButton size="small" onClick={() => openDeleteDialog(user)} disabled={user.uid === auth.currentUser?.uid}>
                           <DeleteIcon />
                         </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        No users found in Firestore.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {!loading && users.length > 0 && (
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={users.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          )}

          <Dialog
            open={deleteDialogOpen}
            onClose={closeDeleteDialog}
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
          >
            <DialogTitle id="alert-dialog-title">
              {"Confirm Deletion"}
            </DialogTitle>
            <DialogContent>
              <Typography>Are you sure you want to delete user: {userToDelete?.email}?</Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeDeleteDialog}>Cancel</Button>
              <Button onClick={handleDeleteUser} color="error" variant="contained" autoFocus disabled={loading}>
                 {loading ? <CircularProgress size={24} color="inherit" /> : 'Delete'}
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog open={editDialogOpen} onClose={closeEditDialog}>
            <DialogTitle>Edit User Role</DialogTitle>
            <DialogContent>
               <Typography>Editing role for: {userToEdit?.email}</Typography>
               <FormControl fullWidth sx={{ mt: 2 }}>
                   <InputLabel>Role</InputLabel>
                   <Select
                       label="Role"
                       value={editingRole}
                       onChange={(e: SelectChangeEvent<'admin' | 'staff'>) => setEditingRole(e.target.value as 'admin' | 'staff')}
                   >
                       <MenuItem value="staff">Staff</MenuItem>
                       <MenuItem value="admin">Admin</MenuItem>
                   </Select>
               </FormControl>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeEditDialog}>Cancel</Button>
              <Button onClick={handleSaveEditedRole} variant="contained" disabled={loading}>
                 {loading ? <CircularProgress size={24} color="inherit" /> : 'Save'}
              </Button>
            </DialogActions>
          </Dialog>

        </>
      ) : (
        <Typography variant="h6" color="error" align="center">Access Denied. Only administrators can manage users.</Typography>
      )}

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <MuiAlert elevation={6} variant="filled" severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </MuiAlert>
      </Snackbar>
    </Container>
  );
};

export default Admin;