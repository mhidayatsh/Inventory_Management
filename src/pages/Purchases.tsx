import React, { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Box,
  TextField,
  InputAdornment,
  Button,
  Snackbar,
  TableSortLabel,
  TablePagination,
  useMediaQuery,
  useTheme,
  Card,
  CardContent,
  CardActions,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Autocomplete,
  FormHelperText
} from '@mui/material';
import MuiAlert from '@mui/material/Alert';
import { Search as SearchIcon, FileDownload as FileDownloadIcon, Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp, getDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import dayjs from 'dayjs';
import Papa from 'papaparse';
import { DateRangePicker } from '@mui/x-date-pickers-pro/DateRangePicker';
import { DateRange } from '@mui/x-date-pickers-pro';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { signOut, onAuthStateChanged, User } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { SelectChangeEvent } from '@mui/material';

interface PurchaseRecord {
  id: string;
  itemId: string;
  name: string;
  quantity: number;
  price: number; // purchase price
  total: number;
  purchasedAt: Timestamp; // Use Timestamp type
  category: string;
}

// Define InventoryItem interface to fetch and display inventory data
interface InventoryItem {
  id: string;
  name: string;
  quantity: number; // current stock
  price: number; // last purchase price (will be updated on new purchase)
  avgCost?: number; // average cost (might need to calculate on purchase)
  category: string;
}

// Define type for sortable keys, excluding 'actions'
type SortablePurchaseKeys = Exclude<keyof PurchaseRecord, 'id' | 'itemId' | 'total' | 'category'>; // Add/remove keys based on sortable columns

type Order = 'asc' | 'desc';

const Purchases: React.FC = () => {
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [dateRange, setDateRange] = useState<DateRange<Date>>([null, null]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inventory state to fetch items for linking
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [fetchingInventory, setFetchingInventory] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  // Table state
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<keyof PurchaseRecord>('purchasedAt'); // orderBy can be any keyof PurchaseRecord for comparator
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  // Responsive state
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Add/Edit Dialog State
  const [openDialog, setOpenDialog] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<PurchaseRecord | null>(null);
  const [purchaseFormData, setPurchaseFormData] = useState({
    itemId: '',
    quantity: 0,
    price: 0,
    purchasedAt: null as Date | null,
  });

  // State for validation errors
  const [validationErrors, setValidationErrors] = useState<{
    itemId?: string;
    quantity?: string;
    price?: string;
    purchasedAt?: string;
  }>({});

  useEffect(() => {
    fetchPurchases();
    fetchInventoryItems();
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

  const fetchPurchases = async () => {
    setLoading(true);
    setError(null);
    try {
      const querySnapshot = await getDocs(collection(db, 'purchases'));
      const purchasesList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        purchasedAt: doc.data().purchasedAt as Timestamp,
      })) as PurchaseRecord[];
      setPurchases(purchasesList);
    } catch (error: any) {
      console.error("Error fetching purchases: ", error);
      setError('Failed to load purchases data. Please try again.');
      setSnackbar({ open: true, message: 'Error fetching purchases!', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchInventoryItems = async () => {
    setFetchingInventory(true);
    setInventoryError(null);
    try {
      const querySnapshot = await getDocs(collection(db, 'inventory'));
      const itemsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InventoryItem[];
      setInventoryItems(itemsList);
    } catch (error: any) {
      console.error("Error fetching inventory items: ", error);
      setInventoryError('Failed to load inventory items for linking.');
    } finally {
      setFetchingInventory(false);
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };

  const handleDateRangeChange = (newDateRange: DateRange<Date>) => {
    setDateRange(newDateRange);
    setPage(0);
  };

  const handleRequestSort = (
    event: React.MouseEvent<unknown>,
    property: keyof PurchaseRecord,
  ) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortedPurchases = useMemo(() => {
    const comparator = (a: PurchaseRecord, b: PurchaseRecord) => {
      const valueA = a[orderBy];
      const valueB = b[orderBy];

      if (valueA == null && valueB == null) return 0;
      if (valueA == null) return order === 'asc' ? -1 : 1;
      if (valueB == null) return order === 'asc' ? 1 : -1;

      if (orderBy === 'purchasedAt') {
        const dateA = valueA instanceof Timestamp ? valueA.toDate().getTime() : 0;
        const dateB = valueB instanceof Timestamp ? valueB.toDate().getTime() : 0;
        return order === 'asc' ? dateA - dateB : dateB - dateA;
      }

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return order === 'asc' ? valueA - valueB : valueB - valueA;
      }

      if (typeof valueA === 'string' && typeof valueB === 'string') {
        const stringA = valueA.toLowerCase();
        const stringB = valueB.toLowerCase();
        if (stringB < stringA) {
          return order === 'asc' ? 1 : -1;
        }
        if (stringB > stringA) {
          return order === 'asc' ? -1 : 1;
        }
        return 0;
      }

      return 0;
    };
    return [...purchases].sort(comparator);
  }, [order, orderBy, purchases]);

  const filteredPurchases = useMemo(() => {
    let filtered = sortedPurchases;

    if (dateRange[0] && dateRange[1]) {
      const startDate = dayjs(dateRange[0]).startOf('day');
      const endDate = dayjs(dateRange[1]).endOf('day');
      filtered = filtered.filter(purchase => {
        const purchaseDate = purchase.purchasedAt instanceof Timestamp ? dayjs(purchase.purchasedAt.toDate()) : null;
        return purchaseDate && purchaseDate.isAfter(startDate) && purchaseDate.isBefore(endDate);
      });
    }

    if (searchTerm) {
      filtered = filtered.filter(purchase =>
        purchase.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [sortedPurchases, dateRange, searchTerm]);

  const visiblePurchases = useMemo(
    () =>
      filteredPurchases.slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage,
      ),
    [page, rowsPerPage, filteredPurchases],
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

  const handleExportCsv = () => {
    const dataToExport = filteredPurchases.map(purchase => ({
      Name: purchase.name,
      Quantity: purchase.quantity,
      "Purchase Price": purchase.price,
      Total: purchase.total,
      "Purchased At": purchase.purchasedAt instanceof Timestamp ? dayjs(purchase.purchasedAt.toDate()).format('YYYY-MM-DD HH:mm') : '',
      Category: purchase.category,
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'purchases_history.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalQuantityPurchased = useMemo(() => filteredPurchases.reduce((sum, purchase) => sum + (purchase.quantity || 0), 0), [filteredPurchases]);
  const totalPurchaseAmount = useMemo(() => filteredPurchases.reduce((sum, purchase) => sum + (purchase.total || 0), 0), [filteredPurchases]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setSnackbar({ open: true, message: 'Logged out successfully!', severity: 'success' });
      navigate('/login');
    } catch (error) {
      setSnackbar({ open: true, message: 'Error logging out!', severity: 'error' });
    }
  };

  const handleAddOpen = () => {
    setEditingPurchase(null);
    setPurchaseFormData({
      itemId: '',
      quantity: 0,
      price: 0,
      purchasedAt: new Date(),
    });
    setOpenDialog(true);
  };

  const handleEditOpen = (purchase: PurchaseRecord) => {
    setEditingPurchase(purchase);
    setPurchaseFormData({
      itemId: purchase.itemId,
      quantity: purchase.quantity,
      price: purchase.price,
      purchasedAt: purchase.purchasedAt.toDate(),
    });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingPurchase(null);
    setValidationErrors({}); // Clear errors when closing dialog
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    setPurchaseFormData(prev => ({
      ...prev,
      [name as string]: name === 'quantity' || name === 'price' ? Number(value) : value,
    }));
    // Clear validation error for the field being changed
    setValidationErrors(prev => ({ ...prev, [name as string]: undefined }));
  };

  const handleDateChange = (date: Date | null) => {
    setPurchaseFormData(prev => ({
      ...prev,
      purchasedAt: date,
    }));
     setValidationErrors(prev => ({ ...prev, purchasedAt: undefined })); // Clear error
  };

  const handleItemSelect = (event: React.ChangeEvent<{}>, value: InventoryItem | null) => {
    if(value) {
      setPurchaseFormData(prev => ({
        ...prev,
        itemId: value.id,
      }));
      setValidationErrors(prev => ({ ...prev, itemId: undefined })); // Clear error
    } else { // Handles clearing the selection
    setPurchaseFormData(prev => ({
      ...prev,
        itemId: '',
    }));
       setValidationErrors(prev => ({ ...prev, itemId: 'Please select an item.' })); // Set error if selection is cleared
    }
  };

  const handleSubmitPurchase = async () => {
    const errors: typeof validationErrors = {};
    if (!purchaseFormData.itemId) {
      errors.itemId = 'Please select an item.';
    }
    if (purchaseFormData.quantity <= 0) {
      errors.quantity = 'Quantity must be positive.';
    }
    if (purchaseFormData.price < 0) { // Price can be 0 for free items/adjustments
      errors.price = 'Price cannot be negative.';
    }
     if (!purchaseFormData.purchasedAt || !(purchaseFormData.purchasedAt instanceof Date) || isNaN(purchaseFormData.purchasedAt.getTime())) {
       errors.purchasedAt = 'Please select a valid date and time.';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setSnackbar({ open: true, message: 'Please fix the errors in the form.', severity: 'error' });
      return;
    }

    setLoading(true);
    try {
      const selectedItem = inventoryItems.find(item => item.id === purchaseFormData.itemId);

      if (!selectedItem) {
         setSnackbar({ open: true, message: 'Selected inventory item not found.', severity: 'error' });
         setLoading(false);
         return;
      }

      // Ensure purchasedAt is a valid Date object before converting to Timestamp
      if (!purchaseFormData.purchasedAt || !(purchaseFormData.purchasedAt instanceof Date) || isNaN(purchaseFormData.purchasedAt.getTime())) {
           setSnackbar({ open: true, message: 'Please select a valid date and time.', severity: 'error' });
         setLoading(false);
         return;
      }

      const purchaseRecordToSave = {
        itemId: purchaseFormData.itemId,
        name: selectedItem.name,
        quantity: purchaseFormData.quantity,
        price: purchaseFormData.price,
        total: purchaseFormData.quantity * purchaseFormData.price,
        purchasedAt: Timestamp.fromDate(purchaseFormData.purchasedAt as Date), // Explicitly cast to Date after validation check
        category: selectedItem.category,
      };

      const inventoryItemRef = doc(db, 'inventory', selectedItem.id);
      const inventoryDoc = await getDoc(inventoryItemRef);

      if (!inventoryDoc.exists()) {
        setSnackbar({ open: true, message: 'Linked inventory item not found for update!', severity: 'error' });
        setLoading(false);
        return;
      }

      const currentInventoryData = inventoryDoc.data();
      const currentInventoryQuantity = currentInventoryData.quantity;

      if (editingPurchase) {
        await updateDoc(doc(db, 'purchases', editingPurchase.id), purchaseRecordToSave);

        const originalPurchase = purchases.find(pur => pur.id === editingPurchase.id);

        if (originalPurchase) {
            const oldQuantity = originalPurchase.quantity;
            const newQuantity = purchaseFormData.quantity;
            const quantityChange = newQuantity - oldQuantity;

            const updatedInventoryQuantity = currentInventoryQuantity + quantityChange;

             if (updatedInventoryQuantity < 0) {
               setSnackbar({ open: true, message: 'Purchase edit would result in negative inventory quantity. Operation cancelled.', severity: 'error' });
               setLoading(false);
               return;
            }

            await updateDoc(inventoryItemRef, { quantity: updatedInventoryQuantity, price: purchaseFormData.price });

            setSnackbar({ open: true, message: 'Purchase record updated and inventory adjusted!', severity: 'success' });

        } else {
           setSnackbar({ open: true, message: 'Error finding original purchase record for inventory update.', severity: 'error' });
           setLoading(false);
           return;
        }

      } else {
        await addDoc(collection(db, 'purchases'), purchaseRecordToSave);

        const updatedInventoryQuantity = currentInventoryQuantity + purchaseFormData.quantity;

        await updateDoc(inventoryItemRef, { quantity: updatedInventoryQuantity, price: purchaseFormData.price });

        setSnackbar({ open: true, message: 'Purchase record added and inventory updated!', severity: 'success' });
      }
      handleCloseDialog();
      fetchPurchases();
      fetchInventoryItems();
    } catch (error) {
      console.error("Error saving purchase record: ", error);
      setSnackbar({ open: true, message: 'Error saving purchase record!', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePurchase = async (id: string) => {
    setLoading(true);
    try {
      const purchaseToDelete = purchases.find(pur => pur.id === id);
      if (purchaseToDelete) {
         const inventoryItemRef = doc(db, 'inventory', purchaseToDelete.itemId);
         const inventoryDoc = await getDoc(inventoryItemRef);

         if(inventoryDoc.exists()) {
          const currentInventoryQuantity = inventoryDoc.data().quantity;
          const updatedInventoryQuantity = currentInventoryQuantity - purchaseToDelete.quantity;

           if (updatedInventoryQuantity < 0) {
               setSnackbar({ open: true, message: 'Deleting purchase would result in negative inventory quantity. Operation cancelled.', severity: 'error' });
               setLoading(false);
               return;
           }

           await updateDoc(inventoryItemRef, { quantity: updatedInventoryQuantity });
         } else {
             setSnackbar({ open: true, message: 'Linked inventory item not found for inventory update!', severity: 'error' });
             console.error(`Inventory item ${purchaseToDelete.itemId} not found for purchase deletion inventory update.`);
         }
      }

      await deleteDoc(doc(db, 'purchases', id));
      setSnackbar({ open: true, message: 'Purchase record deleted!', severity: 'success' });
      fetchPurchases();
      fetchInventoryItems();
    } catch (error) {
      console.error("Error deleting purchase record: ", error);
      setSnackbar({ open: true, message: 'Error deleting purchase record!', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {user && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1">Logged in as: {user.email}</Typography>
          <Button variant="outlined" color="secondary" onClick={handleLogout}>
            Logout
          </Button>
        </Box>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Purchase Summary</Typography>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <DateRangePicker
              value={dateRange}
              onChange={(newValue) => handleDateRangeChange(newValue as DateRange<Date>)}
               slots={{
                 textField: (params) => <TextField {...params} />
              }}
              localeText={{ start: 'Start Date', end: 'End Date' }}
              slotProps={{ textField: { size: 'small' } }}
            />
             <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddOpen}
              sx={{ ml: 'auto' }}
            >
              Add New Purchase
            </Button>
          </Box>
        </LocalizationProvider>

        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Paper elevation={2} sx={{ p: 2, flexGrow: 1 }}>
            <Typography component="h2" variant="h6" color="primary" gutterBottom>Total Quantity Purchased</Typography>
            <Typography component="p" variant="h4">{totalQuantityPurchased}</Typography>
          </Paper>
           <Paper elevation={2} sx={{ p: 2, flexGrow: 1 }}>
            <Typography component="h2" variant="h6" color="primary" gutterBottom>Total Purchase Amount</Typography>
            <Typography component="p" variant="h4">${totalPurchaseAmount.toFixed(2)}</Typography>
          </Paper>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <TextField
            label="Search by Item Name"
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="contained"
            startIcon={<FileDownloadIcon />}
            onClick={handleExportCsv}
            disabled={filteredPurchases.length === 0}
          >
            Export to CSV
          </Button>
        </Box>

         {(searchTerm || (dateRange[0] && dateRange[1])) && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Button
              variant="outlined"
              onClick={() => {
                setSearchTerm('');
                setDateRange([null, null]);
                setPage(0);
              }}
            >
              Clear Filters
            </Button>
          </Box>
        )}

        {loading || fetchingInventory ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        ) : error || inventoryError ? (
          <Typography color="error" align="center" sx={{ mt: 4 }}>
            {error || inventoryError}
          </Typography>
        ) : filteredPurchases.length === 0 ? (
          <Typography variant="body1" align="center" sx={{ mt: 4 }}>
            No purchases found matching your criteria.
             { (searchTerm || (dateRange[0] && dateRange[1])) &&
              <Box>Try clearing the search or date filters.</Box>
            }
          </Typography>
        ) : isMobile ? (
          <Box>
            {visiblePurchases.map((purchase) => (
              <Card key={purchase.id} sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" component="div">{purchase.name}</Typography>
                  <Typography color="text.secondary">Category: {purchase.category}</Typography>
                  <Typography variant="body2">Quantity: {purchase.quantity}</Typography>
                  <Typography variant="body2">Price: ${purchase.price.toFixed(2)}</Typography>
                  <Typography variant="body2">Total: ${purchase.total.toFixed(2)}</Typography>
                  <Typography variant="body2">Purchased At: {purchase.purchasedAt instanceof Timestamp ? dayjs(purchase.purchasedAt.toDate()).format('YYYY-MM-DD HH:mm') : 'N/A'}</Typography>
                </CardContent>
                 <CardActions>
                   <Button size="small" startIcon={<EditIcon />} onClick={() => handleEditOpen(purchase)}>Edit</Button>
                   <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDeletePurchase(purchase.id)}>Delete</Button>
                </CardActions>
              </Card>
            ))}
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  {[ 'name', 'quantity', 'price', 'total', 'purchasedAt', 'category', 'actions'].map((headCell) => (
                     <TableCell
                     key={headCell}
                     sortDirection={(orderBy as string) === headCell && (headCell as string) !== 'actions' ? order : false}
                     align={headCell === 'quantity' || headCell === 'price' || headCell === 'total' || headCell === 'actions' || headCell === 'purchasedAt' ? 'right' : 'left'}
                   >
                     {(['name', 'quantity', 'price', 'total', 'purchasedAt', 'category'] as (keyof PurchaseRecord)[]).includes(headCell as keyof PurchaseRecord) ? (
                       <TableSortLabel
                         active={orderBy === headCell}
                         direction={orderBy === headCell ? order : 'asc'}
                         onClick={(event) => handleRequestSort(event, headCell as keyof PurchaseRecord)}
                       >
                         {headCell === 'purchasedAt' ? 'Purchased At' : headCell.charAt(0).toUpperCase() + headCell.slice(1)}
                       </TableSortLabel>
                     ) : (
                         headCell === 'purchasedAt' ? 'Purchased At' : headCell.charAt(0).toUpperCase() + headCell.slice(1)
                     )}
                   </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {(rowsPerPage > 0
                  ? visiblePurchases
                  : filteredPurchases
                ).map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell>{purchase.name}</TableCell>
                    <TableCell align="right">{purchase.quantity}</TableCell>
                    <TableCell align="right">${purchase.price.toFixed(2)}</TableCell>
                    <TableCell align="right">${purchase.total.toFixed(2)}</TableCell>
                    <TableCell align="right">{purchase.purchasedAt instanceof Timestamp ? dayjs(purchase.purchasedAt.toDate()).format('YYYY-MM-DD HH:mm') : 'N/A'}</TableCell>
                     <TableCell>{purchase.category}</TableCell>
                    <TableCell align="right">
                       <IconButton color="primary" onClick={() => handleEditOpen(purchase)} size="small"><EditIcon /></IconButton>
                       <IconButton color="error" onClick={() => handleDeletePurchase(purchase.id)} size="small"><DeleteIcon /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                 {filteredPurchases.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No purchases found matching your criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {!loading && !error && filteredPurchases.length > 0 && (
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredPurchases.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        )}

      </Paper>

       {/* Add/Edit Purchase Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>{editingPurchase ? 'Edit Purchase Record' : 'Add New Purchase Record'}</DialogTitle>
        <DialogContent>
           {fetchingInventory ? (
            <CircularProgress size={20} />
          ) : inventoryError ? (
            <Typography color="error">{inventoryError}</Typography>
          ) : (
             <Autocomplete
               options={inventoryItems}
               getOptionLabel={(option) => option.name}
               value={inventoryItems.find(item => item.id === purchaseFormData.itemId) || null} // Set value based on itemId
                 onChange={handleItemSelect}
                 disabled={!!editingPurchase}
               renderInput={(params) => (
                 <TextField
                   {...params}
                   label="Select Item"
                   margin="dense"
                   fullWidth
                   variant="outlined"
                   error={!!validationErrors.itemId}
                   helperText={validationErrors.itemId}
                 />
               )}
             />
          )}

           {/* Display selected item name and category (now derived from selected item in state) */}
           {purchaseFormData.itemId && inventoryItems.find(item => item.id === purchaseFormData.itemId) && (
              <Box>
                <TextField
                 margin="dense"
                 label="Category"
                 type="text"
                 fullWidth
                 variant="outlined"
                 value={inventoryItems.find(item => item.id === purchaseFormData.itemId)?.category || ''}
                 InputProps={{ readOnly: true }}
               />

                {/* Display selected item's current stock quantity */}
               <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                 Current Stock: {inventoryItems.find(item => item.id === purchaseFormData.itemId)?.quantity || 0}
               </Typography>
             </Box>
           )}

          <TextField
            margin="dense"
            label="Quantity"
            type="number"
            fullWidth
            variant="outlined"
            name="quantity"
            value={purchaseFormData.quantity}
            onChange={handleFormChange}
             error={!!validationErrors.quantity}
             helperText={validationErrors.quantity}
             inputProps={{ min: 0, style: { textAlign: 'center' } }}
             InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <IconButton
                    size="small"
                    onClick={() => setPurchaseFormData(prev => ({ ...prev, quantity: Math.max(0, prev.quantity - 1) }))}
                    disabled={purchaseFormData.quantity <= 0}
                  >
                    -
                  </IconButton>
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setPurchaseFormData(prev => ({ ...prev, quantity: prev.quantity + 1 }))}
                  >
                    +
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
           <TextField
            margin="dense"
            label="Purchase Price (per unit)"
            type="number"
            fullWidth
            variant="outlined"
            name="price"
            value={purchaseFormData.price}
            onChange={handleFormChange}
             error={!!validationErrors.price}
             helperText={validationErrors.price}
             inputProps={{ min: 0 }}
          />

          {/* Display calculated total */}
          <Typography variant="body1" sx={{ mt: 1 }}>
            Total: ${(purchaseFormData.quantity * purchaseFormData.price).toFixed(2)}
          </Typography>

            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DateTimePicker
                label="Purchase Date & Time (Optional)"
                value={purchaseFormData.purchasedAt}
                onChange={handleDateChange}
                slotProps={{
                  textField: { fullWidth: true, margin: 'dense', ...validationErrors.purchasedAt && { error: true, helperText: validationErrors.purchasedAt } },
                }}
              />
            </LocalizationProvider>

        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={loading}>Cancel</Button>
           <Button onClick={handleSubmitPurchase} disabled={loading}>
             {loading ? <CircularProgress size={24} /> : (editingPurchase ? 'Update' : 'Add')}
           </Button>
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

export default Purchases; 