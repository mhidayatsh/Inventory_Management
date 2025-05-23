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
  FormControl
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

interface AdjustmentRecord {
  id: string;
  itemId: string;
  name: string;
  quantity: number;
  reason: string;
  date: string;
  category: string;
  createdAt: Timestamp;
}

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  avgCost?: number;
  category: string;
}

type SortableAdjustmentKeys = Exclude<keyof AdjustmentRecord, 'id' | 'itemId' | 'reason' | 'category'>;

type Order = 'asc' | 'desc';

const Adjustments: React.FC = () => {
  const [adjustments, setAdjustments] = useState<AdjustmentRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [dateRange, setDateRange] = useState<DateRange<Date>>([null, null]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [fetchingInventory, setFetchingInventory] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<keyof AdjustmentRecord>('createdAt');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  const [openDialog, setOpenDialog] = useState(false);
  const [editingAdjustment, setEditingAdjustment] = useState<AdjustmentRecord | null>(null);
  const [adjustmentFormData, setAdjustmentFormData] = useState({
    itemId: '',
    quantity: 0,
    reason: '',
    date: dayjs().format('YYYY-MM-DD'),
  });

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    fetchAdjustments();
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

  const fetchAdjustments = async () => {
    setLoading(true);
    setError(null);
    try {
      const querySnapshot = await getDocs(collection(db, 'adjustments'));
      const adjustmentsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date as string,
        createdAt: doc.data().createdAt as Timestamp,
      })) as AdjustmentRecord[];
      setAdjustments(adjustmentsList);
    } catch (error: any) {
      console.error("Error fetching adjustments: ", error);
      setError('Failed to load adjustments data. Please try again.');
      setSnackbar({ open: true, message: 'Error fetching adjustments!', severity: 'error' });
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
    property: keyof AdjustmentRecord,
  ) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortedAdjustments = useMemo(() => {
    const comparator = (a: AdjustmentRecord, b: AdjustmentRecord) => {
      const valueA = a[orderBy];
      const valueB = b[orderBy];

      if (valueA == null && valueB == null) return 0;
      if (valueA == null) return order === 'asc' ? -1 : 1;
      if (valueB == null) return order === 'asc' ? 1 : -1;

      if (orderBy === 'createdAt') {
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
    return [...adjustments].sort(comparator);
  }, [order, orderBy, adjustments]);

  const filteredAdjustments = useMemo(() => {
    let filtered = sortedAdjustments;

    if (dateRange[0] && dateRange[1]) {
      const startDate = dayjs(dateRange[0]).startOf('day');
      const endDate = dayjs(dateRange[1]).endOf('day');
      filtered = filtered.filter(adjustment => {
        const adjustmentDate = adjustment.createdAt instanceof Timestamp ? dayjs(adjustment.createdAt.toDate()) : null;
        return adjustmentDate && adjustmentDate.isAfter(startDate) && adjustmentDate.isBefore(endDate);
      });
    }

    if (searchTerm) {
      filtered = filtered.filter(adjustment =>
        adjustment.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [sortedAdjustments, dateRange, searchTerm]);

  const visibleAdjustments = useMemo(
    () =>
      filteredAdjustments.slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage,
      ),
    [page, rowsPerPage, filteredAdjustments],
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
    const dataToExport = filteredAdjustments.map(adjustment => ({
      Name: adjustment.name,
      Quantity: adjustment.quantity,
      Reason: adjustment.reason,
      Date: adjustment.date,
      Category: adjustment.category,
      "Created At": adjustment.createdAt instanceof Timestamp ? dayjs(adjustment.createdAt.toDate()).format('YYYY-MM-DD HH:mm') : '',
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'adjustments_history.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalAdjustmentsQuantity = useMemo(() => filteredAdjustments.reduce((sum, adjustment) => sum + (adjustment.quantity || 0), 0), [filteredAdjustments]);

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
    setEditingAdjustment(null);
    setAdjustmentFormData({
      itemId: '',
      quantity: 0,
      reason: '',
      date: dayjs().format('YYYY-MM-DD'),
    });
    setOpenDialog(true);
  };

  const handleEditOpen = (adjustment: AdjustmentRecord) => {
    setEditingAdjustment(adjustment);
    setAdjustmentFormData({
      itemId: adjustment.itemId,
      quantity: adjustment.quantity,
      reason: adjustment.reason,
      date: adjustment.date,
    });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingAdjustment(null);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    setAdjustmentFormData(prev => ({
      ...prev,
      [name as string]: name === 'quantity' ? Number(value) : value,
    }));
  };

  const handleItemSelect = (event: SelectChangeEvent<string>) => {
    const selectedItemId = event.target.value as string;
    setAdjustmentFormData(prev => ({
      ...prev,
      itemId: selectedItemId,
    }));
  };

  const handleSubmitAdjustment = async () => {
    if (!adjustmentFormData.itemId || adjustmentFormData.quantity === 0 || !adjustmentFormData.reason || !adjustmentFormData.date) {
      setSnackbar({ open: true, message: 'Please fill all required fields (Item, Quantity, Reason, Date). Quantity cannot be zero.', severity: 'error' });
      return;
    }

    setLoading(true);
    try {
      const selectedItem = inventoryItems.find(item => item.id === adjustmentFormData.itemId);

      if (!selectedItem) {
        setSnackbar({ open: true, message: 'Selected inventory item not found.', severity: 'error' });
        setLoading(false);
        return;
      }

      const adjustmentRecordToSave = {
        itemId: adjustmentFormData.itemId,
        name: selectedItem.name,
        quantity: adjustmentFormData.quantity,
        reason: adjustmentFormData.reason,
        date: adjustmentFormData.date,
        category: selectedItem.category,
        createdAt: Timestamp.now(),
      };

      if (editingAdjustment) {
        await updateDoc(doc(db, 'adjustments', editingAdjustment.id), adjustmentRecordToSave);

        const originalAdjustment = adjustments.find(adj => adj.id === editingAdjustment.id);

        if (originalAdjustment) {
          const oldQuantityChange = originalAdjustment.quantity;
          const newQuantityChange = adjustmentFormData.quantity;
          const inventoryChange = newQuantityChange - oldQuantityChange;

          const inventoryItemRef = doc(db, 'inventory', selectedItem.id);
          const inventoryDoc = await getDoc(inventoryItemRef);

          if(inventoryDoc.exists()) {
            const currentInventoryQuantity = inventoryDoc.data().quantity;
            const updatedInventoryQuantity = currentInventoryQuantity + inventoryChange;

            if (updatedInventoryQuantity < 0) {
              setSnackbar({ open: true, message: 'Adjustment edit would result in negative inventory quantity. Operation cancelled.', severity: 'error' });
              setLoading(false);
              return;
            }

            await updateDoc(inventoryItemRef, { quantity: updatedInventoryQuantity });
            setSnackbar({ open: true, message: 'Adjustment record updated and inventory adjusted!', severity: 'success' });
          } else {
            setSnackbar({ open: true, message: 'Adjustment record updated, but linked inventory item not found!', severity: 'error' });
          }

        } else {
          setSnackbar({ open: true, message: 'Error finding original adjustment record for inventory update.', severity: 'error' });
          setLoading(false);
          return;
        }

      } else {
        await addDoc(collection(db, 'adjustments'), adjustmentRecordToSave);

        const inventoryItemRef = doc(db, 'inventory', selectedItem.id);
        const inventoryDoc = await getDoc(inventoryItemRef);

         if(inventoryDoc.exists()) {
          const currentInventoryQuantity = inventoryDoc.data().quantity;
          const updatedInventoryQuantity = currentInventoryQuantity + adjustmentFormData.quantity;

           if (updatedInventoryQuantity < 0) {
              setSnackbar({ open: true, message: 'Adjustment record added, but would result in negative inventory quantity!', severity: 'error' });
           } else {
              setSnackbar({ open: true, message: 'Adjustment record added and inventory updated!', severity: 'success' });
           }
            await updateDoc(inventoryItemRef, { quantity: updatedInventoryQuantity });

        } else {
           setSnackbar({ open: true, message: 'Adjustment record added, but linked inventory item not found!', severity: 'error' });
        }
      }
      handleCloseDialog();
      fetchAdjustments();
      fetchInventoryItems();
    } catch (error) {
      console.error("Error saving adjustment record: ", error);
      setSnackbar({ open: true, message: 'Error saving adjustment record!', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAdjustment = async (id: string) => {
    setLoading(true);
    try {
      const adjustmentToDelete = adjustments.find(adj => adj.id === id);
      if (adjustmentToDelete) {
         const inventoryItemRef = doc(db, 'inventory', adjustmentToDelete.itemId);
         const inventoryDoc = await getDoc(inventoryItemRef);

         if(inventoryDoc.exists()) {
          const currentInventoryQuantity = inventoryDoc.data().quantity;
          const updatedInventoryQuantity = currentInventoryQuantity - adjustmentToDelete.quantity;

           if (updatedInventoryQuantity < 0) {
               setSnackbar({ open: true, message: 'Deleting adjustment would result in negative inventory quantity. Operation cancelled.', severity: 'error' });
               setLoading(false);
               return;
           }

           await updateDoc(inventoryItemRef, { quantity: updatedInventoryQuantity });
         }
      }

      await deleteDoc(doc(db, 'adjustments', id));
      setSnackbar({ open: true, message: 'Adjustment record deleted!', severity: 'success' });
      fetchAdjustments();
      fetchInventoryItems();
    } catch (error) {
      console.error("Error deleting adjustment record: ", error);
      setSnackbar({ open: true, message: 'Error deleting adjustment record!', severity: 'error' });
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
        <Typography variant="h6" gutterBottom>Adjustment Summary</Typography>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <DateRangePicker
              value={dateRange}
              onChange={(newValue) => handleDateRangeChange(newValue as DateRange<Date>)}
              slots={{
                textField: (params) => <TextField {...params} />
              }}
              localeText={{ start: 'Start Date', end: 'End Date' }}
              enableAccessibleFieldDOMStructure={false}
              slotProps={{ textField: { size: 'small' } }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddOpen}
              sx={{ ml: 'auto' }}
            >
              Add New Adjustment
            </Button>
          </Box>
        </LocalizationProvider>

        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Paper elevation={2} sx={{ p: 2, flexGrow: 1 }}>
            <Typography component="h2" variant="h6" color="primary" gutterBottom>Total Quantity Adjusted</Typography>
            <Typography component="p" variant="h4">{totalAdjustmentsQuantity}</Typography>
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
            disabled={filteredAdjustments.length === 0}
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
        ) : filteredAdjustments.length === 0 ? (
          <Typography variant="body1" align="center" sx={{ mt: 4 }}>
            No adjustments found matching your criteria.
            { (searchTerm || (dateRange[0] && dateRange[1])) &&
              <Box>Try clearing the search or date filters.</Box>
            }
          </Typography>
        ) : isMobile ? (
          <Box>
            {visibleAdjustments.map((adjustment) => (
              <Card key={adjustment.id} sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" component="div">{adjustment.name}</Typography>
                  <Typography color="text.secondary">Category: {adjustment.category}</Typography>
                  <Typography variant="body2">Quantity Change: {adjustment.quantity}</Typography>
                  <Typography variant="body2">Reason: {adjustment.reason}</Typography>
                  <Typography variant="body2">Date: {adjustment.date}</Typography>
                  <Typography variant="body2">Created At: {adjustment.createdAt instanceof Timestamp ? dayjs(adjustment.createdAt.toDate()).format('YYYY-MM-DD HH:mm') : 'N/A'}</Typography>
                </CardContent>
                <CardActions>
                  <Button size="small" startIcon={<EditIcon />} onClick={() => handleEditOpen(adjustment)}>Edit</Button>
                  <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDeleteAdjustment(adjustment.id)}>Delete</Button>
                </CardActions>
              </Card>
            ))}
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  {[ 'name', 'quantity', 'reason', 'date', 'category', 'createdAt', 'actions'].map((headCell) => (
                     <TableCell
                     key={headCell}
                     sortDirection={(orderBy as string) === headCell && (headCell as string) !== 'actions' ? order : false}
                     align={headCell === 'quantity' || headCell === 'actions' ? 'right' : 'left'}
                   >
                     {(['name', 'quantity', 'date', 'createdAt'] as (keyof AdjustmentRecord)[]).includes(headCell as keyof AdjustmentRecord) ? (
                       <TableSortLabel
                         active={orderBy === headCell}
                         direction={orderBy === headCell ? order : 'asc'}
                         onClick={(event) => handleRequestSort(event, headCell as keyof AdjustmentRecord)}
                       >
                         {headCell === 'createdAt' ? 'Created At' : headCell.charAt(0).toUpperCase() + headCell.slice(1)}
                       </TableSortLabel>
                     ) : (
                        headCell === 'createdAt' ? 'Created At' : headCell.charAt(0).toUpperCase() + headCell.slice(1)
                     )}
                   </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {(rowsPerPage > 0
                  ? visibleAdjustments
                  : filteredAdjustments
                ).map((adjustment) => (
                  <TableRow key={adjustment.id}>
                    <TableCell>{adjustment.name}</TableCell>
                    <TableCell align="right">{adjustment.quantity}</TableCell>
                    <TableCell>{adjustment.reason}</TableCell>
                    <TableCell>{adjustment.date}</TableCell>
                    <TableCell>{adjustment.category}</TableCell>
                    <TableCell align="right">{adjustment.createdAt instanceof Timestamp ? dayjs(adjustment.createdAt.toDate()).format('YYYY-MM-DD HH:mm') : 'N/A'}</TableCell>
                    <TableCell align="right">
                       <IconButton color="primary" onClick={() => handleEditOpen(adjustment)} size="small"><EditIcon /></IconButton>
                       <IconButton color="error" onClick={() => handleDeleteAdjustment(adjustment.id)} size="small"><DeleteIcon /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                 {filteredAdjustments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No adjustments found matching your criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {!loading && !error && filteredAdjustments.length > 0 && (
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredAdjustments.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        )}

      </Paper>

      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>{editingAdjustment ? 'Edit Adjustment Record' : 'Add New Adjustment Record'}</DialogTitle>
        <DialogContent>
           {fetchingInventory ? (
            <CircularProgress size={20} />
          ) : inventoryError ? (
            <Typography color="error">{inventoryError}</Typography>
          ) : (
             <FormControl fullWidth margin="dense" variant="outlined">
               <InputLabel id="inventory-item-select-label">Select Item</InputLabel>
               <Select
                 labelId="inventory-item-select-label"
                 id="inventory-item-select"
                 value={adjustmentFormData.itemId}
                 label="Select Item"
                 onChange={handleItemSelect}
                 disabled={!!editingAdjustment}
               >
                 <MenuItem value=""><em>-- Select an Item --</em></MenuItem>
                 {inventoryItems.map((item) => (
                   <MenuItem key={item.id} value={item.id}>{item.name} (Stock: {item.quantity})</MenuItem>
                 ))}
               </Select>
             </FormControl>
          )}

           {adjustmentFormData.itemId && (
              <TextField
               margin="dense"
               label="Item Name"
               type="text"
               fullWidth
               variant="outlined"
               value={inventoryItems.find(item => item.id === adjustmentFormData.itemId)?.name || ''}
               InputProps={{ readOnly: true }}
             />
           )}

          <TextField
            margin="dense"
            label="Quantity Change (+/-)"
            type="number"
            fullWidth
            variant="outlined"
            name="quantity"
            value={adjustmentFormData.quantity}
            onChange={handleFormChange}
          />
           <TextField
            margin="dense"
            label="Reason"
            type="text"
            fullWidth
            variant="outlined"
            name="reason"
            value={adjustmentFormData.reason}
            onChange={handleFormChange}
          />
            <TextField
              margin="dense"
              label="Adjustment Date"
              type="date"
              fullWidth
              variant="outlined"
              name="date"
              value={adjustmentFormData.date}
              onChange={handleFormChange}
              InputLabelProps={{
                shrink: true,
              }}
            />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
           <Button onClick={handleSubmitAdjustment}>{editingAdjustment ? 'Update' : 'Add'}</Button>
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

export default Adjustments; 