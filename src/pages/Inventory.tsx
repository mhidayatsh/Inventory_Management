import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Snackbar,
  Typography,
  TableSortLabel,
  TablePagination,
  Box,
  CircularProgress,
  useMediaQuery,
  useTheme,
  Card,
  CardContent,
  CardActions
} from '@mui/material';
import MuiAlert from '@mui/material/Alert';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, ShoppingCart as ShoppingCartIcon, AddShoppingCart as AddShoppingCartIcon, SettingsBackupRestore as AdjustIcon, Sort } from '@mui/icons-material';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import dayjs from 'dayjs';
import { signOut, onAuthStateChanged, User } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  price: number; // last purchase price
  avgCost?: number; // average cost
  category: string;
}

type Order = 'asc' | 'desc';

const Inventory: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    quantity: 0,
    price: 0,
    category: ''
  });
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  // Sell dialog state
  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [sellItem, setSellItem] = useState<InventoryItem | null>(null);
  const [sellQuantity, setSellQuantity] = useState(1);
  const [sellPrice, setSellPrice] = useState<number | ''>('');
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [sellDateTime, setSellDateTime] = useState<Date>(new Date());

  // Purchase dialog state
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [purchaseItem, setPurchaseItem] = useState<InventoryItem | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [purchasePrice, setPurchasePrice] = useState<number | ''>('');
  const [purchaseDateTime, setPurchaseDateTime] = useState<Date>(new Date());

  // Adjust dialog state
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState<number | ''>('');
  const [adjustReason, setAdjustReason] = useState('Correction');
  const [adjustDate, setAdjustDate] = useState<string>(dayjs().format('YYYY-MM-DD'));

  // Table state
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<keyof InventoryItem>('name');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  // Responsive state
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Loading and Error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        setUser(null);
        navigate('/login');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const fetchItems = async () => {
    setLoading(true);
    setError(null); // Clear previous errors
    try {
      const querySnapshot = await getDocs(collection(db, 'inventory'));
      const itemsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InventoryItem[];
      setItems(itemsList);
    } catch (error: any) { // Catch error and specify type
      console.error("Error fetching inventory: ", error);
      setError('Failed to load inventory data. Please try again.'); // Set user-friendly error message
      setSnackbar({ open: true, message: 'Error fetching inventory!', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestSort = (
    event: React.MouseEvent<unknown>,
    property: keyof InventoryItem,
  ) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortedItems = React.useMemo(() => {
    const comparator = (a: InventoryItem, b: InventoryItem) => {
      // If sorting by a non-sortable column like 'actions', just maintain original order or return 0
      // Cast orderBy to string to avoid type mismatch with 'actions' literal
      if ((orderBy as string) === 'actions') {
        return 0; // Maintain original order for 'actions' column
      }

      // Handle numeric or string comparison for sortable columns
      const valueA = a[orderBy];
      const valueB = b[orderBy];

      // Handle potential undefined/null values and different types
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        // String comparison
        return order === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
      } else if (typeof valueA === 'number' && typeof valueB === 'number') {
        // Numeric comparison
        return order === 'asc' ? valueA - valueB : valueB - valueA;
      } else {
        // Fallback for mixed types or undefined/null
        // Treat undefined/null as smaller for consistent sorting
        if (valueA == null && valueB != null) return order === 'asc' ? -1 : 1;
        if (valueB == null && valueA != null) return order === 'asc' ? 1 : -1;
        // If both are null/undefined or uncomparable types, maintain order
        return 0;
      }
    };
    return [...items].sort(comparator);
  }, [order, orderBy, items]);

  // Note: Inventory currently doesn't have search or date filters, so filteredItems is the same as sortedItems.
  // If filters are added later, this memoized value would be updated.
  const filteredItems = sortedItems; // Assuming no filters for now

  const visibleItems = React.useMemo(
    () =>
      filteredItems.slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage,
      ),
    [page, rowsPerPage, filteredItems],
  );

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleOpen = (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        category: item.category
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        quantity: 0,
        price: 0,
        category: ''
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingItem(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingItem) {
        await updateDoc(doc(db, 'inventory', editingItem.id), formData);
        setSnackbar({ open: true, message: 'Item updated!', severity: 'success' });
      } else {
        await addDoc(collection(db, 'inventory'), formData);
        setSnackbar({ open: true, message: 'Item added!', severity: 'success' });
      }
      handleClose();
      fetchItems();
    } catch (error) {
      setSnackbar({ open: true, message: 'Error occurred!', severity: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'inventory', id));
      setSnackbar({ open: true, message: 'Item deleted!', severity: 'success' });
      fetchItems();
    } catch (error) {
      setSnackbar({ open: true, message: 'Error occurred!', severity: 'error' });
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity' || name === 'price' ? Number(value) : value, // Convert numeric inputs to numbers
    }));
  };

  // Sell dialog handlers
  const handleSellOpen = (item: InventoryItem) => {
    setSellItem(item);
    setSellQuantity(1);
    setSellPrice('');
    setCustomerName('');
    setCustomerMobile('');
    setSellDateTime(new Date());
    setSellDialogOpen(true);
  };

  const handleSellClose = () => {
    setSellDialogOpen(false);
    setSellItem(null);
  };

  const handleSell = async () => {
    if (!sellItem || sellQuantity <= 0 || Number(sellPrice) <= 0) {
      setError('Please select an item and enter valid quantity and price');
      return;
    }

    try {
      const saleRecord = {
        itemId: sellItem.id,
        name: sellItem.name,
        quantity: sellQuantity,
        price: Number(sellPrice),
        total: sellQuantity * Number(sellPrice),
        soldAt: Timestamp.now(),
        category: sellItem.category,
        profit: (Number(sellPrice) - (sellItem.avgCost || 0)) * sellQuantity,
        customerName: customerName,
        customerMobile: customerMobile,
        createdBy: auth.currentUser?.uid
      };

      // Update inventory quantity
      await updateDoc(doc(db, 'inventory', sellItem.id), {
        quantity: sellItem.quantity - sellQuantity,
        lastUpdated: Timestamp.now()
      });

      // Add sale record
      await addDoc(collection(db, 'sales'), saleRecord);

      // Update local state
      setItems(prev => prev.map(item => 
        item.id === sellItem.id 
          ? { ...item, quantity: item.quantity - sellQuantity }
          : item
      ));

      handleSellClose();
      setError(null);
    } catch (error) {
      console.error('Error selling item:', error);
      setError('Failed to sell item. Please try again.');
    }
  };

  // Purchase dialog handlers
  const handlePurchaseOpen = (item: InventoryItem) => {
    setPurchaseItem(item);
    setPurchaseQuantity(1);
    setPurchasePrice('');
    setPurchaseDateTime(new Date());
    setPurchaseDialogOpen(true);
  };

  const handlePurchaseClose = () => {
    setPurchaseDialogOpen(false);
    setPurchaseItem(null);
  };

  const handlePurchase = async () => {
    if (!purchaseItem || purchaseQuantity <= 0 || Number(purchasePrice) <= 0) {
      setError('Please select an item and enter valid quantity and price');
      return;
    }

    try {
      const purchaseRecord = {
        itemId: purchaseItem.id,
        name: purchaseItem.name,
        quantity: purchaseQuantity,
        price: Number(purchasePrice),
        total: purchaseQuantity * Number(purchasePrice),
        purchasedAt: Timestamp.now(),
        category: purchaseItem.category,
        createdBy: auth.currentUser?.uid
      };

      // Calculate new average cost
      const currentTotalCost = (purchaseItem.avgCost || 0) * purchaseItem.quantity;
      const purchaseTotalCost = purchaseQuantity * Number(purchasePrice);
      const newTotalQuantity = purchaseItem.quantity + purchaseQuantity;
      const newAvgCost = (currentTotalCost + purchaseTotalCost) / newTotalQuantity;

      // Update inventory
      await updateDoc(doc(db, 'inventory', purchaseItem.id), {
        quantity: purchaseItem.quantity + purchaseQuantity,
        avgCost: newAvgCost,
        lastUpdated: Timestamp.now()
      });

      // Add purchase record
      await addDoc(collection(db, 'purchases'), purchaseRecord);

      // Update local state
      setItems(prev => prev.map(item => 
        item.id === purchaseItem.id 
          ? { ...item, quantity: item.quantity + purchaseQuantity, avgCost: newAvgCost }
          : item
      ));

      handlePurchaseClose();
      setError(null);
    } catch (error) {
      console.error('Error purchasing item:', error);
      setError('Failed to purchase item. Please try again.');
    }
  };

  // Adjust dialog handlers
  const handleAdjustOpen = (item: InventoryItem) => {
    setAdjustItem(item);
    setAdjustQuantity('');
    setAdjustReason('Correction');
    setAdjustDate(dayjs().format('YYYY-MM-DD'));
    setAdjustDialogOpen(true);
  };

  const handleAdjustClose = () => {
    setAdjustDialogOpen(false);
    setAdjustItem(null);
  };

  const handleAdjust = async () => {
    if (!adjustItem || adjustQuantity === '' || Number(adjustQuantity) === 0 || !adjustReason || !adjustDate) {
       setSnackbar({ open: true, message: 'Please enter a valid non-zero quantity, reason, and date for adjustment.', severity: 'error' });
      return;
    }

    const quantityChange = Number(adjustQuantity);
    const newQuantity = adjustItem.quantity + quantityChange; // Positive quantityChange for increase, negative for decrease

    if (newQuantity < 0) {
      setSnackbar({ open: true, message: 'Adjustment would result in negative inventory quantity.', severity: 'error' });
      return;
    }

    setLoading(true); // Start loading for the action
    try {
       // Update inventory quantity
       await updateDoc(doc(db, 'inventory', adjustItem.id), { quantity: newQuantity });

       // Add adjustment record to 'adjustments' collection
       const adjustmentRecord = {
         itemId: adjustItem.id,
         name: adjustItem.name,
         quantity: quantityChange, // Record the change in quantity
         reason: adjustReason,
         date: adjustDate, // Store date as string or convert to Timestamp if needed
         category: adjustItem.category, // Inherit category from inventory item
         createdAt: Timestamp.now(), // Use server timestamp
         createdBy: auth.currentUser?.uid // Add current user's ID
       };
       await addDoc(collection(db, 'adjustments'), adjustmentRecord);

      setSnackbar({ open: true, message: 'Inventory adjusted!', severity: 'success' });
      handleAdjustClose();
      fetchItems(); // Refresh inventory list
    } catch (error) {
      console.error("Error adjusting inventory: ", error);
      setSnackbar({ open: true, message: 'Error adjusting inventory!', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setSnackbar({ open: true, message: 'Logged out successfully!', severity: 'success' });
      navigate('/login');
    } catch (error) {
      setSnackbar({ open: true, message: 'Error logging out!', severity: 'error' });
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Profile Info and Logout Button */}
      {user && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1">Logged in as: {user.email}</Typography>
          <Button variant="outlined" color="secondary" onClick={handleLogout}>
            Logout
          </Button>
        </Box>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" gutterBottom>Inventory</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>Add New Item</Button>
        </Box>

        {/* Conditional rendering based on state (loading, error, data) */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error" align="center" sx={{ mt: 4 }}>
            {error}
          </Typography>
        ) : filteredItems.length === 0 ? (
          <Typography variant="body1" align="center" sx={{ mt: 4 }}>
            No inventory items found.
            {/* Add suggestion to clear filters if filters were implemented */}
          </Typography>
        ) : isMobile ? (
          <Box>
            {visibleItems.map((item) => (
              <Card key={item.id} sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" component="div">{item.name}</Typography>
                  <Typography color="text.secondary">Category: {item.category}</Typography>
                  <Typography variant="body2">Quantity: {item.quantity}</Typography>
                  <Typography variant="body2">Last Purchase Price: ${item.price?.toFixed(2) || '0.00'}</Typography>
                  {item.avgCost !== undefined && <Typography variant="body2">Average Cost: ${item.avgCost?.toFixed(2) || '0.00'}</Typography>}
                </CardContent>
                <CardActions>
                  <Button size="small" startIcon={<ShoppingCartIcon />} onClick={() => handleSellOpen(item)}>Sell</Button>
                  <Button size="small" startIcon={<AddShoppingCartIcon />} onClick={() => handlePurchaseOpen(item)}>Purchase</Button>
                  <Button size="small" startIcon={<AdjustIcon />} onClick={() => handleAdjustOpen(item)}>Adjust</Button>
                  <Button size="small" startIcon={<EditIcon />} onClick={() => handleOpen(item)}>Edit</Button>
                  <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDelete(item.id)}>Delete</Button>
                </CardActions>
              </Card>
            ))}
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  {[ 'name', 'quantity', 'price', 'avgCost', 'category', 'actions'].map((headCell) => (
                    <TableCell
                      key={headCell}
                      align={headCell === 'quantity' || headCell === 'price' || headCell === 'avgCost' || headCell === 'actions' ? 'right' : 'left'}
                      sortDirection={(orderBy as string) === headCell && (headCell as string) !== 'actions' ? order : false}
                    >
                      {headCell !== 'actions' ? (
                        <TableSortLabel
                          active={orderBy === headCell}
                          direction={orderBy === headCell ? order : 'asc'}
                          onClick={(event) => handleRequestSort(event, headCell as keyof InventoryItem)}
                        >
                          {headCell === 'price' ? 'Last Purchase Price' : headCell === 'avgCost' ? 'Average Cost' : headCell.charAt(0).toUpperCase() + headCell.slice(1)}
                        </TableSortLabel>
                      ) : (
                        headCell.charAt(0).toUpperCase() + headCell.slice(1)
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {(rowsPerPage > 0
                  ? visibleItems
                  : filteredItems
                ).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell align="right">{item.quantity}</TableCell>
                    <TableCell align="right">${item.price?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell align="right">${item.avgCost !== undefined ? item.avgCost.toFixed(2) : 'N/A'}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell align="right">
                      <IconButton color="primary" onClick={() => handleSellOpen(item)} size="small"><ShoppingCartIcon /></IconButton>
                      <IconButton color="primary" onClick={() => handlePurchaseOpen(item)} size="small"><AddShoppingCartIcon /></IconButton>
                      <IconButton color="primary" onClick={() => handleAdjustOpen(item)} size="small"><AdjustIcon /></IconButton>
                      <IconButton color="primary" onClick={() => handleOpen(item)} size="small"><EditIcon /></IconButton>
                      <IconButton color="error" onClick={() => handleDelete(item.id)} size="small"><DeleteIcon /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No inventory items found. {/* Updated empty state message */}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Ensure pagination is only shown when not loading and there are items */}
        {!loading && !error && filteredItems.length > 0 && (
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredItems.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        )}
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{editingItem ? 'Edit Inventory Item' : 'Add New Inventory Item'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            type="text"
            fullWidth
            variant="outlined"
            name="name"
            value={formData.name}
            onChange={handleFormChange}
          />
          <TextField
            margin="dense"
            label="Quantity"
            type="number"
            fullWidth
            variant="outlined"
            name="quantity"
            value={formData.quantity}
            onChange={handleFormChange}
            inputProps={{ min: 0 }}
          />
          <TextField
            margin="dense"
            label="Last Purchase Price"
            type="number"
            fullWidth
            variant="outlined"
            name="price"
            value={formData.price}
            onChange={handleFormChange}
            inputProps={{ min: 0 }}
          />
          <TextField
            margin="dense"
            label="Category"
            type="text"
            fullWidth
            variant="outlined"
            name="category"
            value={formData.category}
            onChange={handleFormChange}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit}>{editingItem ? 'Update' : 'Add'}</Button>
        </DialogActions>
      </Dialog>

      {/* Sell Dialog */}
      <Dialog open={sellDialogOpen} onClose={handleSellClose}>
        <DialogTitle>Sell Item: {sellItem?.name}</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle1">Available Quantity: {sellItem?.quantity}</Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Quantity to Sell"
            type="number"
            fullWidth
            variant="outlined"
            value={sellQuantity}
            onChange={(e) => setSellQuantity(parseInt(e.target.value, 10) || 0)}
            inputProps={{ min: 1, max: sellItem?.quantity || 0 }}
          />
          <TextField
            margin="dense"
            label="Selling Price (per item)"
            type="number"
            fullWidth
            variant="outlined"
            value={sellPrice}
            onChange={(e) => setSellPrice(parseFloat(e.target.value) || '')}
            inputProps={{ min: 0 }}
          />
          <TextField
            margin="dense"
            label="Customer Name (Optional)"
            type="text"
            fullWidth
            variant="outlined"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Customer Mobile (Optional)"
            type="text"
            fullWidth
            variant="outlined"
            value={customerMobile}
            onChange={(e) => setCustomerMobile(e.target.value)}
          />
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DateTimePicker
              label="Sale Date & Time (Optional)"
              value={sellDateTime}
              onChange={(newValue) => setSellDateTime(newValue || new Date())}
              slotProps={{ textField: { fullWidth: true, margin: 'dense' } }}
            />
          </LocalizationProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSellClose}>Cancel</Button>
          <Button onClick={handleSell} disabled={!sellQuantity || (sellItem && sellQuantity > (sellItem.quantity || 0)) || sellPrice === ''}>Sell</Button>
        </DialogActions>
      </Dialog>

      {/* Purchase Dialog */}
      <Dialog open={purchaseDialogOpen} onClose={handlePurchaseClose}>
        <DialogTitle>Purchase Item: {purchaseItem?.name}</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle1">Current Quantity: {purchaseItem?.quantity}</Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Quantity to Purchase"
            type="number"
            fullWidth
            variant="outlined"
            value={purchaseQuantity}
            onChange={(e) => setPurchaseQuantity(parseInt(e.target.value, 10) || 0)}
            inputProps={{ min: 1 }}
          />
          <TextField
            margin="dense"
            label="Purchase Price (per item)"
            type="number"
            fullWidth
            variant="outlined"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || '')}
            inputProps={{ min: 0 }}
          />
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DateTimePicker
              label="Purchase Date & Time (Optional)"
              value={purchaseDateTime}
              onChange={(newValue) => setPurchaseDateTime(newValue || new Date())}
              slotProps={{ textField: { fullWidth: true, margin: 'dense' } }}
            />
          </LocalizationProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={handlePurchaseClose}>Cancel</Button>
          <Button onClick={handlePurchase} disabled={!purchaseQuantity || purchasePrice === ''}>Purchase</Button>
        </DialogActions>
      </Dialog>

      {/* Adjust Dialog */}
      <Dialog open={adjustDialogOpen} onClose={handleAdjustClose}>
        <DialogTitle>Adjust Item: {adjustItem?.name}</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle1">Current Quantity: {adjustItem?.quantity}</Typography>
          <TextField
            autoFocus
            margin="dense"
            label="New Quantity"
            type="number"
            fullWidth
            variant="outlined"
            value={adjustQuantity}
            onChange={(e) => setAdjustQuantity(parseInt(e.target.value, 10) || '')}
            inputProps={{ min: 0 }}
          />
          <TextField
            margin="dense"
            label="Reason for Adjustment"
            type="text"
            fullWidth
            variant="outlined"
            value={adjustReason}
            onChange={(e) => setAdjustReason(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Adjustment Date"
            type="date"
            fullWidth
            variant="outlined"
            value={adjustDate}
            onChange={(e) => setAdjustDate(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAdjustClose}>Cancel</Button>
          <Button onClick={handleAdjust} disabled={adjustQuantity === ''}>Adjust</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <MuiAlert elevation={6} variant="filled" severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </MuiAlert>
      </Snackbar>
    </Container>
  );
};

export default Inventory; 