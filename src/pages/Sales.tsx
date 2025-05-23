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
  FormHelperText,
  Autocomplete
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

interface SaleRecord {
  id: string;
  itemId: string;
  name: string;
  quantity: number;
  price: number; // sell price
  total: number;
  soldAt: Timestamp; // Use Timestamp type
  category: string;
  profit: number;
  customerName?: string;
  customerMobile?: string;
}

// Define InventoryItem interface to fetch and display inventory data
interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  price: number; // last purchase price
  avgCost?: number; // average cost
  category: string;
}

// Define type for sortable keys, excluding 'actions'
type SortableSaleKeys = Exclude<keyof SaleRecord, 'id' | 'itemId' | 'total' | 'category' | 'profit' | 'customerName' | 'customerMobile'>; // Add/remove keys based on sortable columns

type Order = 'asc' | 'desc';

const Sales: React.FC = () => {
  const [sales, setSales] = useState<SaleRecord[]>([]);
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
  const [orderBy, setOrderBy] = useState<keyof SaleRecord>('soldAt'); // orderBy can be any keyof SaleRecord for comparator, but UI sort labels only on sortable ones
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  // Responsive state
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Add/Edit Dialog State
  const [openDialog, setOpenDialog] = useState(false);
  const [editingSale, setEditingSale] = useState<SaleRecord | null>(null);
  const [saleFormData, setSaleFormData] = useState({
    itemId: '',
    name: '',
    quantity: 0,
    price: 0,
    soldAt: null as Date | null, // Use Date | null for date picker compatibility
    customerName: '',
    customerMobile: '',
    // category and profit will be derived from selected inventory item
  });

  // State for validation errors
  const [validationErrors, setValidationErrors] = useState<{
    itemId?: string;
    quantity?: string;
    price?: string;
    soldAt?: string;
  }>({});

  useEffect(() => {
    fetchSales();
    fetchInventoryItems(); // Fetch inventory items on component mount
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

  const fetchSales = async () => {
    setLoading(true);
    setError(null);
    try {
      const querySnapshot = await getDocs(collection(db, 'sales'));
      const salesList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert Timestamp to Date for local state if needed, or handle Timestamp directly.
        // Keeping it as Timestamp for consistency with interface and Firebase data.
        // Convert to Date only when needed for display or date picker.
      })) as SaleRecord[];
      setSales(salesList);
    } catch (error: any) {
      console.error("Error fetching sales: ", error);
      setError('Failed to load sales data. Please try again.');
      setSnackbar({ open: true, message: 'Error fetching sales!', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Fetch inventory items
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
    property: keyof SaleRecord, // Property can be any key for comparator
  ) => {
    // Only allow sorting on defined sortable columns in the UI header
    // The comparator handles all keys, but we only trigger sorting from specific columns
    // if ((headCells as readonly HeadCell[]).find(cell => cell.id === property)?.isSortable !== false) {
      const isAsc = orderBy === property && order === 'asc';
      setOrder(isAsc ? 'desc' : 'asc');
      setOrderBy(property);
    // }
  };

  const sortedSales = useMemo(() => {
    const comparator = (a: SaleRecord, b: SaleRecord) => {
      const valueA = a[orderBy];
      const valueB = b[orderBy];

      // Handle null/undefined values
      if (valueA == null && valueB == null) return 0;
      if (valueA == null) return order === 'asc' ? -1 : 1;
      if (valueB == null) return order === 'asc' ? 1 : -1;

      // Handle Timestamp comparison
      if (orderBy === 'soldAt') {
        const dateA = valueA instanceof Timestamp ? valueA.toDate().getTime() : 0;
        const dateB = valueB instanceof Timestamp ? valueB.toDate().getTime() : 0;
        return order === 'asc' ? dateA - dateB : dateB - dateA;
      }

      // Handle numeric comparison
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return order === 'asc' ? valueA - valueB : valueB - valueA;
      }

      // Handle string comparison (case-insensitive)
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

      // Fallback for other types - no sorting
      return 0;
    };
    return [...sales].sort(comparator);
  }, [order, orderBy, sales]);

  const filteredSales = useMemo(() => {
    let filtered = sortedSales;

    if (dateRange[0] && dateRange[1]) {
      const startDate = dayjs(dateRange[0]).startOf('day');
      const endDate = dayjs(dateRange[1]).endOf('day');
      filtered = filtered.filter(sale => {
        // Ensure soldAt is a Timestamp before calling toDate()
        const saleDate = sale.soldAt instanceof Timestamp ? dayjs(sale.soldAt.toDate()) : null;
        return saleDate && saleDate.isAfter(startDate) && saleDate.isBefore(endDate);
      });
    }

    if (searchTerm) {
      filtered = filtered.filter(sale =>
        sale.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sale.customerName && sale.customerName.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    return filtered;
  }, [sortedSales, dateRange, searchTerm]);

  const visibleSales = useMemo(
    () =>
      filteredSales.slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage,
      ),
    [page, rowsPerPage, filteredSales],
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
    const dataToExport = filteredSales.map(sale => ({
      Name: sale.name,
      Quantity: sale.quantity,
      "Sell Price": sale.price,
      Total: sale.total,
      "Sold At": sale.soldAt instanceof Timestamp ? dayjs(sale.soldAt.toDate()).format('YYYY-MM-DD HH:mm') : '',
      Category: sale.category,
      Profit: sale.profit,
      "Customer Name": sale.customerName || '',
      "Customer Mobile": sale.customerMobile || '',
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'sales_history.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalSalesAmount = useMemo(() => filteredSales.reduce((sum, sale) => sum + (sale.total || 0), 0), [filteredSales]); // Handle potential undefined total
  const totalProfit = useMemo(() => filteredSales.reduce((sum, sale) => sum + (sale.profit || 0), 0), [filteredSales]); // Handle potential undefined profit
  const totalQuantitySold = useMemo(() => filteredSales.reduce((sum, sale) => sum + (sale.quantity || 0), 0), [filteredSales]); // Handle potential undefined quantity

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setSnackbar({ open: true, message: 'Logged out successfully!', severity: 'success' });
      navigate('/login');
    } catch (error) {
      setSnackbar({ open: true, message: 'Error logging out!', severity: 'error' });
    }
  };

  // Dialog Handlers
  const handleAddOpen = () => {
    setEditingSale(null);
    setSaleFormData({
      itemId: '',
      name: '',
      quantity: 0,
      price: 0,
      soldAt: new Date(), // Set current date/time by default
      customerName: '',
      customerMobile: '',
    });
    setOpenDialog(true);
  };

  const handleEditOpen = (sale: SaleRecord) => {
    setEditingSale(sale);
     // Find the corresponding inventory item to pre-select in the dropdown
     const initialItem = inventoryItems.find(item => item.id === sale.itemId);
    setSaleFormData({
      itemId: sale.itemId,
      name: sale.name,
      quantity: sale.quantity,
      price: sale.price,
      soldAt: sale.soldAt instanceof Timestamp ? sale.soldAt.toDate() : null, // Convert Timestamp to Date for picker
      customerName: sale.customerName || '',
      customerMobile: sale.customerMobile || '',
    });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingSale(null);
    setValidationErrors({}); // Clear errors when closing dialog
    // Reset form data if needed, although handleAddOpen/handleEditOpen does this
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    setSaleFormData(prev => ({
      ...prev,
      [name as string]: name === 'quantity' || name === 'price' ? Number(value) : value,
    }));
     // Clear validation error for the field being changed
     setValidationErrors(prev => ({ ...prev, [name as string]: undefined }));
  };

   // Handle Inventory Item selection
   const handleItemSelect = (event: React.ChangeEvent<{}>, value: InventoryItem | null) => {
     if(value) {
       setSaleFormData(prev => ({
         ...prev,
         itemId: value.id,
         name: value.name,
       }));
        setValidationErrors(prev => ({ ...prev, itemId: undefined })); // Clear error
     } else { // Handles clearing the selection
        setSaleFormData(prev => ({
         ...prev,
         itemId: '',
         name: '',
       }));
        setValidationErrors(prev => ({ ...prev, itemId: 'Please select an item.' })); // Set error if selection is cleared
     }
   };

  const handleDateChange = (date: Date | null) => { // Expect Date | null
    setSaleFormData(prev => ({
      ...prev,
      soldAt: date, // Use Date object
    }));
     setValidationErrors(prev => ({ ...prev, soldAt: undefined })); // Clear error
  };

  const handleSubmitSale = async () => {
    // Validate required fields including itemId
    const errors: typeof validationErrors = {};
    if (!saleFormData.itemId) {
      errors.itemId = 'Please select an item.';
    }
    if (saleFormData.quantity <= 0) {
      errors.quantity = 'Quantity must be positive.';
    }
    if (saleFormData.price <= 0) {
      errors.price = 'Sell Price must be positive.';
    }
    if (!saleFormData.soldAt || !(saleFormData.soldAt instanceof Date) || isNaN(saleFormData.soldAt.getTime())) {
       errors.soldAt = 'Please select a valid date and time.';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setSnackbar({ open: true, message: 'Please fix the errors in the form.', severity: 'error' });
      return;
    }

    setLoading(true); // Start loading for the action
    try {
      // Find the selected inventory item to get category and avgCost
      const selectedItem = inventoryItems.find(item => item.id === saleFormData.itemId);

      if (!selectedItem) {
         setSnackbar({ open: true, message: 'Selected inventory item not found.', severity: 'error' });
         setLoading(false);
         return;
      }

       // Ensure soldAt is a valid Date object before converting to Timestamp
       if (!saleFormData.soldAt || !(saleFormData.soldAt instanceof Date) || isNaN(saleFormData.soldAt.getTime())) {
           setSnackbar({ open: true, message: 'Please select a valid date and time.', severity: 'error' });
           setLoading(false);
           return;
      }

      const saleRecordToSave = {
        itemId: saleFormData.itemId,
        name: selectedItem.name, // Use name from inventory item
        quantity: saleFormData.quantity,
        price: saleFormData.price, // Use the manually entered sell price
        total: saleFormData.quantity * saleFormData.price, // Calculate total based on sell price
        soldAt: Timestamp.fromDate(saleFormData.soldAt as Date), // Convert Date to Timestamp, explicitly cast after validation check
        category: selectedItem.category, // Use category from inventory item
        // Calculate profit using the inventory item's average cost
        profit: selectedItem.avgCost !== undefined ? (saleFormData.price - selectedItem.avgCost) * saleFormData.quantity : saleFormData.quantity * saleFormData.price, // If avgCost not available, profit is just sell price
        customerName: saleFormData.customerName,
        customerMobile: saleFormData.customerMobile,
      };

      if (editingSale) {
        // When editing, update the sale record
        await updateDoc(doc(db, 'sales', editingSale.id), saleRecordToSave);

        // Important: Handle potential change in quantity for inventory update on edit.
        // If the quantity changed during edit, adjust inventory accordingly.
        const oldQuantity = editingSale.quantity;
        const newQuantity = saleFormData.quantity;
        const quantityDifference = oldQuantity - newQuantity; // Positive if sold less, negative if sold more

        const inventoryItemRef = doc(db, 'inventory', selectedItem.id);
        const inventoryDoc = await getDoc(inventoryItemRef); // Fetch current inventory state

        if(inventoryDoc.exists()) {
          const currentInventoryQuantity = inventoryDoc.data().quantity;
          const updatedInventoryQuantity = currentInventoryQuantity + quantityDifference; // Add back if sold less, subtract more if sold more
           await updateDoc(inventoryItemRef, { quantity: updatedInventoryQuantity });
        }

        setSnackbar({ open: true, message: 'Sale record updated and inventory adjusted!', severity: 'success' });
      } else {
        // For adding a new sale record
        await addDoc(collection(db, 'sales'), saleRecordToSave);

        // Update inventory quantity (subtract sold quantity)
        const inventoryItemRef = doc(db, 'inventory', selectedItem.id);
        const inventoryDoc = await getDoc(inventoryItemRef); // Fetch current inventory state

         if(inventoryDoc.exists()) {
          const currentInventoryQuantity = inventoryDoc.data().quantity;
           // Check if enough stock is available before updating inventory
           if (currentInventoryQuantity >= saleFormData.quantity) {
             const updatedInventoryQuantity = currentInventoryQuantity - saleFormData.quantity;
             await updateDoc(inventoryItemRef, { quantity: updatedInventoryQuantity });
              setSnackbar({ open: true, message: 'Sale record added and inventory updated!', severity: 'success' });
           } else {
              // If not enough stock, add the sale record but show an error
               setSnackbar({ open: true, message: 'Sale record added, but insufficient stock in inventory!', severity: 'error' });
           }
        } else {
           // Inventory item not found, add sale record but show error
            setSnackbar({ open: true, message: 'Sale record added, but linked inventory item not found!', severity: 'error' });
        }
      }
      handleCloseDialog();
      fetchSales(); // Refresh the sales list
      fetchInventoryItems(); // Also refresh inventory list to show updated quantities
    } catch (error) {
      console.error("Error saving sale record: ", error);
      setSnackbar({ open: true, message: 'Error saving sale record!', severity: 'error' });
    } finally {
      setLoading(false); // Stop loading
    }
  };

  const handleDeleteSale = async (id: string) => {
    setLoading(true); // Start loading for the action
    try {
      // Before deleting the sale, get the quantity sold and the item ID to update inventory
      const saleToDelete = sales.find(sale => sale.id === id);
      if (saleToDelete) {
         const inventoryItemRef = doc(db, 'inventory', saleToDelete.itemId);
         const inventoryDoc = await getDoc(inventoryItemRef); // Fetch current inventory state

         if(inventoryDoc.exists()) {
          const currentInventoryQuantity = inventoryDoc.data().quantity;
          const updatedInventoryQuantity = currentInventoryQuantity + saleToDelete.quantity; // Add back the sold quantity
           await updateDoc(inventoryItemRef, { quantity: updatedInventoryQuantity });
         }
      }

      await deleteDoc(doc(db, 'sales', id));
      setSnackbar({ open: true, message: 'Sale record deleted!', severity: 'success' });
      fetchSales(); // Refresh the list
      fetchInventoryItems(); // Also refresh inventory list to show updated quantities
    } catch (error) {
      console.error("Error deleting sale record: ", error);
      setSnackbar({ open: true, message: 'Error deleting sale record!', severity: 'error' });
    } finally {
      setLoading(false); // Stop loading
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
        <Typography variant="h6" gutterBottom>Sales Summary</Typography>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}> {/* Allow wrapping for smaller screens */}
            <DateRangePicker
              value={dateRange}
              onChange={(newValue) => handleDateRangeChange(newValue as DateRange<Date>)}
               slots={{
                 textField: (params) => <TextField {...params} />
              }}
              localeText={{ start: 'Start Date', end: 'End Date' }}
              enableAccessibleFieldDOMStructure={false}
              slotProps={{ textField: { size: 'small' } }} // Make picker smaller
            />
             {/* Add New Sale Button */}
             <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddOpen}
              sx={{ ml: 'auto' }} // Push button to the right
            >
              Add New Sale
            </Button>
          </Box>
        </LocalizationProvider>

        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Paper elevation={2} sx={{ p: 2, flexGrow: 1 }}>
            <Typography component="h2" variant="h6" color="primary" gutterBottom>Total Sales</Typography>
            <Typography component="p" variant="h4">${totalSalesAmount.toFixed(2)}</Typography>
          </Paper>
          <Paper elevation={2} sx={{ p: 2, flexGrow: 1 }}>
            <Typography component="h2" variant="h6" color="success.main" gutterBottom>Total Profit</Typography>
            <Typography component="p" variant="h4">${totalProfit.toFixed(2)}</Typography>
          </Paper>
          <Paper elevation={2} sx={{ p: 2, flexGrow: 1 }}>
            <Typography component="h2" variant="h6" color="info.main" gutterBottom>Total Quantity Sold</Typography>
            <Typography component="p" variant="h4">{totalQuantitySold}</Typography>
          </Paper>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <TextField
            label="Search by Item/Customer Name"
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
            disabled={filteredSales.length === 0}
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
        ) : filteredSales.length === 0 ? (
          <Typography variant="body1" align="center" sx={{ mt: 4 }}>
            No sales found matching your criteria.
            { (searchTerm || (dateRange[0] && dateRange[1])) &&
              <Box>Try clearing the search or date filters.</Box>
            }
          </Typography>
        ) : isMobile ? (
          <Box>
            {visibleSales.map((sale) => (
              <Card key={sale.id} sx={{ mb: 2 }}>
                <CardContent>
                  {/* Display Item Name from Sale Record */}
                  <Typography variant="h6" component="div">{sale.name}</Typography>
                  <Typography color="text.secondary">Category: {sale.category}</Typography>
                  <Typography variant="body2">Quantity: {sale.quantity}</Typography>
                  <Typography variant="body2">Sell Price: ${sale.price?.toFixed(2) || '0.00'}</Typography>
                  <Typography variant="body2">Total: ${sale.total?.toFixed(2) || '0.00'}</Typography>
                  <Typography variant="body2">Profit: ${sale.profit?.toFixed(2) || '0.00'}</Typography>
                  <Typography variant="body2">Sold At: {sale.soldAt instanceof Timestamp ? dayjs(sale.soldAt.toDate()).format('YYYY-MM-DD HH:mm') : 'N/A'}</Typography>
                  {sale.customerName && <Typography variant="body2">Customer Name: {sale.customerName}</Typography>}
                  {sale.customerMobile && <Typography variant="body2">Customer Mobile: {sale.customerMobile}</Typography>}
                </CardContent>
                <CardActions>
                   <Button size="small" startIcon={<EditIcon />} onClick={() => handleEditOpen(sale)}>Edit</Button>
                   <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDeleteSale(sale.id)}>Delete</Button>
                </CardActions>
              </Card>
            ))}
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  {[ 'name', 'quantity', 'price', 'total', 'soldAt', 'category', 'profit', 'customerName', 'customerMobile', 'actions'].map((headCell) => (
                     <TableCell
                     key={headCell}
                     sortDirection={(orderBy as string) === headCell && (headCell as string) !== 'actions' ? order : false} // Cast to string for 'actions' comparison
                     align={headCell === 'quantity' || headCell === 'price' || headCell === 'total' || headCell === 'profit' || headCell === 'actions' ? 'right' : 'left'}
                   >
                     {headCell !== 'actions' ? (
                       <TableSortLabel
                         active={orderBy === headCell}
                         direction={orderBy === headCell ? order : 'asc'}
                         onClick={(event) => handleRequestSort(event, headCell as keyof SaleRecord)}
                       >
                         {headCell === 'price' ? 'Sell Price' : headCell.charAt(0).toUpperCase() + headCell.slice(1)}
                       </TableSortLabel>
                     ) : (
                       'Actions'
                     )}
                   </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {(rowsPerPage > 0
                  ? visibleSales
                  : filteredSales
                ).map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>{sale.name}</TableCell>
                    <TableCell align="right">{sale.quantity}</TableCell>
                    <TableCell align="right">${sale.price?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell align="right">${sale.total?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell align="right">{sale.soldAt instanceof Timestamp ? dayjs(sale.soldAt.toDate()).format('YYYY-MM-DD HH:mm') : 'N/A'}</TableCell>
                    <TableCell>{sale.category}</TableCell>
                    <TableCell align="right">${sale.profit?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell>{sale.customerName}</TableCell>
                    <TableCell>{sale.customerMobile}</TableCell>
                    <TableCell align="right">
                       <IconButton color="primary" onClick={() => handleEditOpen(sale)} size="small"><EditIcon /></IconButton>
                       <IconButton color="error" onClick={() => handleDeleteSale(sale.id)} size="small"><DeleteIcon /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredSales.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} align="center"> {/* Adjusted colspan */}
                      No sales found matching your criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {!loading && !error && filteredSales.length > 0 && (
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredSales.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        )}

      </Paper>

      {/* Add/Edit Sale Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>{editingSale ? 'Edit Sale Record' : 'Add New Sale Record'}</DialogTitle>
        <DialogContent>
           {fetchingInventory ? (
            <CircularProgress size={20} />
          ) : inventoryError ? (
            <Typography color="error">{inventoryError}</Typography>
          ) : ( /* Use Autocomplete to select Inventory Item */
             <Autocomplete
               options={inventoryItems}
               getOptionLabel={(option) => option.name}
               value={inventoryItems.find(item => item.id === saleFormData.itemId) || null} // Set value based on itemId
               onChange={handleItemSelect} // Use the updated handler
               disabled={!!editingSale} // Disable item selection when editing
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
          {/* Autocomplete handles displaying the selected item name, these are redundant now */}
          {/* We can remove these TextFields */}
          {/* {!editingSale && saleFormData.itemId && ( */}
          {/*    <TextField */}
          {/*     margin="dense" */}
          {/*     label="Item Name" */}
          {/*     type="text" */}
          {/*     fullWidth */}
          {/*     variant="outlined" */}
          {/*     name="name" */}
          {/*     value={saleFormData.name} */}
          {/*     InputProps={{ readOnly: true }} */}
          {/*   /> */}
          {/* )} */}
          {/* {editingSale && ( */}
          {/*    <TextField */}
          {/*    margin="dense" */}
          {/*    label="Item Name" */}
          {/*    type="text" */}
          {/*    fullWidth */}
          {/*    variant="outlined" */}
          {/*    name="name" */}
          {/*    value={saleFormData.name} */}
          {/*    InputProps={{ readOnly: true }} */}
          {/*  /> */}
          {/* )} */}

          {/* Display selected item's current stock quantity */}
          {saleFormData.itemId && inventoryItems.find(item => item.id === saleFormData.itemId) && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Current Stock: {inventoryItems.find(item => item.id === saleFormData.itemId)?.quantity || 0}
            </Typography>
          )}

          <TextField
            margin="dense"
            label="Quantity"
            type="number"
            fullWidth
            variant="outlined"
            name="quantity"
            value={saleFormData.quantity}
            onChange={handleFormChange}
             error={!!validationErrors.quantity}
             helperText={validationErrors.quantity}
            inputProps={{ min: 1, style: { textAlign: 'center' } }} // Center align text for better look with buttons
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <IconButton
                    size="small"
                    onClick={() => setSaleFormData(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))}
                    disabled={saleFormData.quantity <= 1} // Disable minus button if quantity is 1 or less
                  >
                    -
                  </IconButton>
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setSaleFormData(prev => ({ ...prev, quantity: prev.quantity + 1 }))}
                  >
                    +
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
           <TextField
            margin="dense"
            label="Sell Price (per item)"
            type="number"
            fullWidth
            variant="outlined"
            name="price"
            value={saleFormData.price}
            onChange={handleFormChange}
             error={!!validationErrors.price}
             helperText={validationErrors.price}
            inputProps={{ min: 0 }}
          />

          {/* Display calculated total */}
          <Typography variant="body1" sx={{ mt: 1 }}>
            Total: ${(saleFormData.quantity * saleFormData.price).toFixed(2)}
          </Typography>

          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DateTimePicker
              label="Sold At (Optional)"
              value={saleFormData.soldAt}
              onChange={handleDateChange}
              slots={{
                textField: (params) => <TextField {...params} margin="dense" fullWidth variant="outlined" error={!!validationErrors.soldAt} helperText={validationErrors.soldAt} />
              }}
              // Add renderInput and other props for better visual
              slotProps={{
                textField: { size: 'small' },
                openPickerButton: { color: 'primary' }, // Example: change calendar icon color
              }}
              ampm={false} // Use 24-hour format
              disableFuture={false} // Allow selecting future dates if needed
              // views={['year', 'month', 'day', 'hours', 'minutes']} // Specify views if needed
              // openTo="day" // Specify starting view
              // inputFormat="dd/MM/yyyy HH:mm"
              // mask="__/__/____ __:__"
              enableAccessibleFieldDOMStructure={false}
            />
          </LocalizationProvider>
           <TextField
            margin="dense"
            label="Customer Name (Optional)"
            type="text"
            fullWidth
            variant="outlined"
            name="customerName"
            value={saleFormData.customerName}
            onChange={handleFormChange}
          />
           <TextField
            margin="dense"
            label="Customer Mobile (Optional)"
            type="text"
            fullWidth
            variant="outlined"
            name="customerMobile"
            value={saleFormData.customerMobile}
            onChange={handleFormChange}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmitSale} disabled={loading}>
            {loading ? <CircularProgress size={24} /> : (editingSale ? 'Update' : 'Add')}
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

export default Sales; 