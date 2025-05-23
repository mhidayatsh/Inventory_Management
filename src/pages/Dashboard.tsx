import React from 'react';
import { Container, Grid, Paper, Typography, Card, CardContent, Box, List, ListItem, ListItemText, Divider, useMediaQuery, useTheme, Button, TextField } from '@mui/material';
import { collection, getDocs, query, orderBy, limit, Timestamp, getDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Legend } from 'recharts';
import { CircularProgress } from '@mui/material';
import dayjs from 'dayjs';
import { updateProfile } from 'firebase/auth';
import { auth } from '../config/firebase';
import { ShoppingCart as ShoppingCartIcon, AttachMoney as AttachMoneyIcon, Store as StoreIcon } from '@mui/icons-material';
import { ShoppingCartOutlined as ShoppingCartOutlinedIcon, StoreOutlined as StoreOutlinedIcon, SettingsBackupRestore as SettingsBackupRestoreIcon } from '@mui/icons-material';

const COLORS = ['#1976d2', '#ff9800', '#d32f2f'];

interface SaleRecord {
  id: string;
  name: string;
  quantity: number;
  price: number; // sell price
  total: number;
  soldAt: Timestamp; // Use Timestamp type
  category: string;
  profit: number;
  customerName?: string;
  customerMobile?: string;
  createdBy?: string; // Add createdBy field
}

interface PurchaseRecord {
  id: string;
  itemId: string;
  name: string;
  quantity: number;
  price: number; // purchase price
  total: number;
  purchasedAt: Timestamp; // Use Timestamp type
  category: string;
  createdBy?: string; // Add createdBy field
}

interface AdjustmentRecord {
  id: string;
  name: string;
  quantity: number;
  reason: string;
  createdAt: Timestamp; // Use Timestamp type
  createdBy?: string; // Add createdBy field
}

type RecentActivity = (
  | (SaleRecord & { type: 'Sale' })
  | (PurchaseRecord & { type: 'Purchase' })
  | (AdjustmentRecord & { type: 'Adjustment' })
);

const Dashboard: React.FC = () => {
  const [stats, setStats] = React.useState({
    totalItems: 0,
    lowStock: 0,
    outOfStock: 0,
    totalSalesAmount: 0,
    totalProfit: 0,
    totalPurchasesAmount: 0,
  });
  const [pieData, setPieData] = React.useState<any[]>([]);
  const [barData, setBarData] = React.useState<any[]>([]);
  const [recentActivities, setRecentActivities] = React.useState<RecentActivity[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [userEmails, setUserEmails] = React.useState<Record<string, string>>({}); // Add state for user emails

  // Responsive state
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Profile Picture State - Updated for URL input
  const [profilePictureUrl, setProfilePictureUrl] = React.useState<string | null>(auth.currentUser?.photoURL || null); // Initialize with current photoURL
  const [newProfilePictureUrl, setNewProfilePictureUrl] = React.useState<string>(''); // State for the new URL input

  React.useEffect(() => {
    const fetchStatsAndActivities = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch Inventory Stats
        const inventoryRef = collection(db, 'inventory');
        const inventorySnapshot = await getDocs(inventoryRef);
        const items = inventorySnapshot.docs.map(doc => doc.data());

        // Fetch Sales Stats and Recent Sales
        const salesRef = collection(db, 'sales');
        const salesSnapshot = await getDocs(salesRef);
        const salesRecords = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SaleRecord[];
        const totalSales = salesRecords.reduce((sum, sale) => sum + (sale.total || 0), 0);
        const totalProfitAmount = salesRecords.reduce((sum, sale) => sum + (sale.profit || 0), 0);
        const recentSales = salesRecords.map(sale => ({ ...sale, type: 'Sale' as const }));

        // Fetch Purchases Stats and Recent Purchases
        const purchasesRef = collection(db, 'purchases');
        const purchasesSnapshot = await getDocs(purchasesRef);
        const purchaseRecords = purchasesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PurchaseRecord[];
        const totalPurchases = purchaseRecords.reduce((sum, purchase) => sum + (purchase.total || 0), 0);
        const recentPurchases = purchaseRecords.map(purchase => ({ ...purchase, type: 'Purchase' as const }));

        // Fetch Recent Adjustments
        const adjustmentsRef = collection(db, 'adjustments');
        const adjustmentsSnapshot = await getDocs(adjustmentsRef);
        const adjustmentRecords = adjustmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AdjustmentRecord[];
        const recentAdjustments = adjustmentRecords.map(adjustment => ({ ...adjustment, type: 'Adjustment' as const }));

        // Collect unique user IDs from sales, purchases, and adjustments
        const userIds = new Set<string>();
        salesRecords.forEach(sale => sale.createdBy && userIds.add(sale.createdBy));
        purchaseRecords.forEach(purchase => purchase.createdBy && userIds.add(purchase.createdBy));
        adjustmentRecords.forEach(adjustment => adjustment.createdBy && userIds.add(adjustment.createdBy));

        // Fetch user emails for collected user IDs
        const userEmailsMap: Record<string, string> = {};
        for (const userId of userIds) {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            userEmailsMap[userId] = userDoc.data().email || 'Unknown User';
          }
        }
        setUserEmails(userEmailsMap);

        // Combine and sort recent activities by timestamp
        const allRecentActivities = [...recentSales, ...recentPurchases, ...recentAdjustments]
          .sort((a, b) => {
            const dateA = a.type === 'Sale' ? a.soldAt : (a.type === 'Purchase' ? a.purchasedAt : a.createdAt);
            const dateB = b.type === 'Sale' ? b.soldAt : (b.type === 'Purchase' ? b.purchasedAt : b.createdAt);
            // Sort in descending order (newest first)
            return dateB.toDate().getTime() - dateA.toDate().getTime();
          })
          .slice(0, 10); // Keep only the 10 most recent activities

        setStats({
          totalItems: items.length,
          lowStock: items.filter(item => (item.quantity || 0) < 10 && (item.quantity || 0) > 0).length,
          outOfStock: items.filter(item => (item.quantity || 0) === 0).length,
          totalSalesAmount: totalSales,
          totalProfit: totalProfitAmount,
          totalPurchasesAmount: totalPurchases,
        });

        setPieData([
          { name: 'In Stock', value: items.filter(item => (item.quantity || 0) > 0).length },
          { name: 'Low Stock', value: items.filter(item => (item.quantity || 0) < 10 && (item.quantity || 0) > 0).length },
          { name: 'Out of Stock', value: items.filter(item => (item.quantity || 0) === 0).length },
        ]);

        setBarData([
          { name: 'Total', value: items.length },
          { name: 'Low Stock', value: items.filter(item => (item.quantity || 0) < 10).length },
          { name: 'Out of Stock', value: items.filter(item => (item.quantity || 0) === 0).length },
        ]);

        setRecentActivities(allRecentActivities);

      } catch (error: any) {
        console.error("Error fetching dashboard data: ", error);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchStatsAndActivities();
  }, []);

  // Handle saving the new profile picture URL
  const handleSaveProfilePictureUrl = async () => {
    if (newProfilePictureUrl && auth.currentUser) {
      try {
        await updateProfile(auth.currentUser, {
          photoURL: newProfilePictureUrl
        });
        setProfilePictureUrl(newProfilePictureUrl); // Update displayed picture
        setNewProfilePictureUrl(''); // Clear input field
        // Show success message (optional)
      } catch (error) {
        console.error("Error updating profile picture URL: ", error);
        // Show error message (optional)
      }
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        {/* Summary Metrics Cards */}
        <Grid item xs={12} md={4}> {/* Adjust grid size for responsiveness */}
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
            <Typography component="h2" variant="h6" color="primary" gutterBottom>
              Total Sales
            </Typography>
            {loading ? (
              <CircularProgress size={24} />
            ) : error ? (
              <Typography color="error">-</Typography>
            ) : (
              <Typography component="p" variant="h4">
                ${stats.totalSalesAmount.toFixed(2)}
              </Typography>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}> {/* Adjust grid size for responsiveness */}
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
            <Typography component="h2" variant="h6" color="success.main" gutterBottom>
              Total Profit
            </Typography>
             {loading ? (
              <CircularProgress size={24} />
            ) : error ? (
              <Typography color="error">-</Typography>
            ) : (
              <Typography component="p" variant="h4">
                ${stats.totalProfit.toFixed(2)}
              </Typography>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}> {/* Adjust grid size for responsiveness */}
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
            <Typography component="h2" variant="h6" color="info.main" gutterBottom>
              Total Purchases
            </Typography>
             {loading ? (
              <CircularProgress size={24} />
            ) : error ? (
              <Typography color="error">-</Typography>
            ) : (
              <Typography component="p" variant="h4">
                ${stats.totalPurchasesAmount.toFixed(2)}
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* User Info and Profile Picture Section - Moved Here */}
        <Grid item xs={12}> {/* Full width on all screens */}
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography component="h2" variant="h6" color="primary" gutterBottom>
                 User Profile
              </Typography>
               {/* Add profile picture display and URL input */}
               <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {profilePictureUrl ? (
                     <img
                      src={profilePictureUrl}
                      alt="Profile"
                      style={{ width: 40, height: 40, borderRadius: '50%', marginRight: 16 }}
                     />
                   ) : (
                     <img
                      src={'https://mui.com/static/images/avatar/1.jpg'} // Default avatar
                      alt="Profile"
                      style={{ width: 40, height: 40, borderRadius: '50%', marginRight: 16 }}
                     />
                   )}
                 <Typography variant="subtitle1" sx={{ mr: 2 }}>
                   {auth.currentUser?.email}
                 </Typography>
                </Box>
             </Box>
           </Paper>
         </Grid>

        {/* Recent Activity Feed */}
        <Grid item xs={12} md={6}> {/* Adjust grid size for responsiveness */}
          <Paper sx={{ p: 2 }}>
            <Typography component="h2" variant="h6" color="primary" gutterBottom>
              Recent Activity
            </Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
                <CircularProgress />
              </Box>
            ) : error ? (
              <Typography color="error" align="center" sx={{ mt: 4 }}>
                {error}
              </Typography>
            ) : recentActivities.length === 0 ? (
              <Typography variant="body1" align="center" sx={{ mt: 4 }}>
                No recent activity found.
              </Typography>
            ) : (
              <List>
                {recentActivities.map((activity, index) => (
                  <React.Fragment key={activity.id}>
                    <ListItem sx={{ alignItems: 'flex-start' }}> {/* Align items to start if icons are taller */}
                      {/* Add Icon based on activity type */}
                      <Box sx={{ mr: 2, mt: 0.5 }}> {/* Margin right and top to align icon with text */}
                         {activity.type === 'Sale' ? (
                            <ShoppingCartOutlinedIcon color="primary" />
                          ) : activity.type === 'Purchase' ? (
                            <StoreOutlinedIcon color="info" />
                          ) : (
                            <SettingsBackupRestoreIcon color="warning" />
                          )}
                      </Box>
                      {
                        (() => {
                          let secondaryText = '';
                          const performedBy = activity.createdBy ? ` by ${userEmails[activity.createdBy] || 'Unknown User'}` : '';
                          const formattedDate = activity.type === 'Sale' ? dayjs(activity.soldAt.toDate()).format('YYYY-MM-DD HH:mm')
                                                : activity.type === 'Purchase' ? dayjs(activity.purchasedAt.toDate()).format('YYYY-MM-DD HH:mm')
                                                : activity.type === 'Adjustment' ? dayjs(activity.createdAt.toDate()).format('YYYY-MM-DD HH:mm') : '';

                          if (activity.type === 'Sale') {
                            secondaryText = `Quantity: ${activity.quantity}, Total: $${activity.total?.toFixed(2) || '0.00'}, Profit: $${activity.profit?.toFixed(2) || '0.00'}${performedBy} - ${formattedDate}`;
                          } else if (activity.type === 'Purchase') {
                            secondaryText = `Quantity: ${activity.quantity}, Total: $${activity.total?.toFixed(2) || '0.00'}${performedBy} - ${formattedDate}`;
                          } else if (activity.type === 'Adjustment') {
                             secondaryText = `Quantity Changed By: ${activity.quantity}, Reason: ${activity.reason}${performedBy} - ${formattedDate}`;
                          }

                          return (
                            <ListItemText
                              primary={
                                <Typography variant="body1" component="span" sx={{ fontWeight: 'bold' }}>
                                  {activity.type === 'Sale' ? 'Sold' : activity.type === 'Purchase' ? 'Purchased' : 'Adjusted Stock'}: {activity.name}
                                </Typography>
                              }
                              secondary={
                                <Typography variant="body2" color="text.secondary">
                                  {secondaryText}
                                </Typography>
                              }
                            />
                          );
                        })()
                      }
                    </ListItem>
                    {index < recentActivities.length - 1 && <Divider component="li" />} {/* Add divider between items */}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Existing Inventory Status Cards and Charts */}
        <Grid item xs={12} md={6}> {/* Adjust grid size for responsiveness */}
          <Card sx={{ p: 2 }}>
            <CardContent>
              <Typography component="h2" variant="h6" color="primary" gutterBottom>
                Inventory Status
              </Typography>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
                  <CircularProgress />
                </Box>
              ) : error ? (
                <Typography color="error" align="center" sx={{ mt: 4 }}>
                  {error}
                </Typography>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}> {/* Adjust grid size for responsiveness */}
          <Card sx={{ p: 2 }}>
            <CardContent>
              <Typography component="h2" variant="h6" color="primary" gutterBottom>
                Inventory Overview
              </Typography>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
                  <CircularProgress />
                </Box>
              ) : error ? (
                <Typography color="error" align="center" sx={{ mt: 4 }}>
                  {error}
                </Typography>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={barData}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value">
                      {barData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
        {/* Existing Inventory Count Papers */}
        <Grid item xs={12} md={4}> {/* Adjust grid size for responsiveness */}
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
            <Typography component="h2" variant="h6" color="primary" gutterBottom>
              Total Items
            </Typography>
            <Typography component="p" variant="h4">
              {loading ? <CircularProgress size={24} /> : error ? '-' : stats.totalItems}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}> {/* Adjust grid size for responsiveness */}
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
            <Typography component="h2" variant="h6" color="warning.main" gutterBottom>
              Low Stock Items
            </Typography>
            <Typography component="p" variant="h4">
              {loading ? <CircularProgress size={24} /> : error ? '-' : stats.lowStock}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}> {/* Adjust grid size for responsiveness */}
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
            <Typography component="h2" variant="h6" color="error.main" gutterBottom>
              Out of Stock
            </Typography>
            <Typography component="p" variant="h4">
              {loading ? <CircularProgress size={24} /> : error ? '-' : stats.outOfStock}
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard; 