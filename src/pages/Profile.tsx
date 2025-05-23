import React, { useState } from 'react';
import { Container, Paper, Typography, Avatar, Button, Box, Snackbar, TextField, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import MuiAlert from '@mui/material/Alert';
import { auth } from '../config/firebase';
import { sendPasswordResetEmail, updatePassword, updateProfile } from 'firebase/auth';

const Profile: React.FC = () => {
  const user = auth.currentUser;
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [changePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newProfilePictureUrl, setNewProfilePictureUrl] = useState<string>('');

  const handleSendResetEmail = async () => {
    if (user && user.email) {
      try {
        await sendPasswordResetEmail(auth, user.email);
        setSnackbar({ open: true, message: 'Password reset email sent!', severity: 'success' });
      } catch (error) {
        console.error("Error sending password reset email:", error);
        setSnackbar({ open: true, message: 'Error sending password reset email.', severity: 'error' });
      }
    }
  };

  const handleChangePassword = async () => {
    if (!user) return;
    if (!currentPassword || !newPassword) {
      setSnackbar({ open: true, message: 'Please fill in all fields', severity: 'error' });
      return;
    }
    if (newPassword.length < 6) {
      setSnackbar({ open: true, message: 'New password must be at least 6 characters.', severity: 'error' });
      return;
    }

    try {
      // Note: Re-authentication might be required before updating password for security reasons.
      // Firebase usually handles this by requiring a recent login or explicit re-auth flow.
      await updatePassword(user, newPassword);
      setSnackbar({ open: true, message: 'Password updated successfully!', severity: 'success' });
      setChangePasswordDialogOpen(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch (error: any) {
        console.error("Error changing password:", error);
         // Handle specific Firebase errors, e.g., auth/requires-recent-login
        if (error.code === 'auth/requires-recent-login') {
             setSnackbar({ open: true, message: 'Please re-login to change your password.', severity: 'error' });
        } else {
            setSnackbar({ open: true, message: `Error changing password: ${error.message}`, severity: 'error' });
        }
    }
  };

  const handleSaveProfilePictureUrl = async () => {
    if (newProfilePictureUrl && user) {
      try {
        await updateProfile(user, {
          photoURL: newProfilePictureUrl
        });
        // Refresh user object to reflect the change immediately (optional, useEffect might handle this)
        // await user.reload(); // Firebase v9 might handle this differently or automatically
        setSnackbar({ open: true, message: 'Profile picture updated successfully!', severity: 'success' });
        setNewProfilePictureUrl(''); // Clear input field
        // If using a confirmation dialog, close it here
        // setConfirmPictureChangeOpen(false);
      } catch (error) {
        console.error("Error updating profile picture URL: ", error);
        setSnackbar({ open: true, message: 'Failed to update profile picture URL.', severity: 'error' });
        // If using a confirmation dialog, close it here
        // setConfirmPictureChangeOpen(false);
      }
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Paper elevation={3} sx={{ p: 4, width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <Avatar sx={{ width: 80, height: 80, mx: 'auto', mb: 2 }} src={user?.photoURL || ''}>
          {user?.email?.[0]?.toUpperCase() || 'U'}
        </Avatar>
        <Typography variant="h5" gutterBottom>
          {user?.email || 'User'}
        </Typography>
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Profile Picture URL"
            variant="outlined"
            fullWidth
            value={newProfilePictureUrl}
            onChange={(e) => setNewProfilePictureUrl(e.target.value)}
            sx={{ mb: 1 }}
          />
          <Button variant="contained" onClick={handleSaveProfilePictureUrl} disabled={!newProfilePictureUrl}>
            Save Profile Picture URL
          </Button>
          <Button variant="outlined" onClick={handleSendResetEmail}>
            Send Password Reset Email
          </Button>
           <Button variant="outlined" onClick={() => setChangePasswordDialogOpen(true)}>
            Change Password
          </Button>
        </Box>
      </Paper>

      {/* Change Password Dialog */}
      <Dialog open={changePasswordDialogOpen} onClose={() => setChangePasswordDialogOpen(false)}>
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Current Password"
            type="password"
            fullWidth
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
           <TextField
            margin="dense"
            label="New Password"
            type="password"
            fullWidth
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangePasswordDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleChangePassword} variant="contained">Change Password</Button>
        </DialogActions>
      </Dialog>

      {/* Optional Confirmation Dialog for Picture Change (if needed) */}
      {/* <Dialog open={confirmPictureChangeOpen} onClose={() => setConfirmPictureChangeOpen(false)}> */}
      {/*   <DialogTitle>Confirm Profile Picture Change</DialogTitle> */}
      {/*   <DialogContent> */}
      {/*     <Typography>Are you sure you want to change your profile picture to this URL?</Typography> */}
      {/*   </DialogContent> */}
      {/*   <DialogActions> */}
      {/*     <Button onClick={() => setConfirmPictureChangeOpen(false)}>Cancel</Button> */}
      {/*     <Button onClick={handleSaveProfilePictureUrl} color="primary" variant="contained">Confirm</Button> */}
      {/*   </DialogActions> */}
      {/* </Dialog> */}

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <MuiAlert elevation={6} variant="filled" severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </MuiAlert>
      </Snackbar>
    </Container>
  );
};

export default Profile; 