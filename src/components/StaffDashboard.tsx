import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Card, Row, Col, Button, Table, Form, Alert, Modal } from 'react-bootstrap';

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  category: string;
  lastUpdated: Date;
}

interface Sale {
  id: string;
  items: Array<{
    itemId: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  date: Date;
  createdBy: string;
}

const StaffDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [salePrice, setSalePrice] = useState('');

  // Load inventory and sales data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load inventory
        const inventoryQuery = query(collection(db, 'inventory'));
        const inventorySnapshot = await getDocs(inventoryQuery);
        const inventoryData = inventorySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as InventoryItem));
        setInventory(inventoryData);

        // Load sales
        const salesQuery = query(
          collection(db, 'sales'),
          where('createdBy', '==', currentUser?.uid)
        );
        const salesSnapshot = await getDocs(salesQuery);
        const salesData = salesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Sale));
        setSales(salesData);

        setLoading(false);
      } catch (err) {
        setError('Failed to load data');
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser]);

  // Create new sale
  const handleCreateSale = async () => {
    if (!selectedItem || saleQuantity <= 0 || !salePrice) {
      setError('Please select an item and enter valid quantity and price');
      return;
    }

    try {
      // Check if enough stock is available
      if (selectedItem.quantity < saleQuantity) {
        setError('Not enough stock available');
        return;
      }

      const total = saleQuantity * Number(salePrice);
      
      // Create sale record
      await addDoc(collection(db, 'sales'), {
        items: [{
          itemId: selectedItem.id,
          name: selectedItem.name,
          quantity: saleQuantity,
          price: Number(salePrice)
        }],
        total,
        date: Timestamp.now(),
        createdBy: currentUser?.uid
      });

      // Update inventory quantity
      await updateDoc(doc(db, 'inventory', selectedItem.id), {
        quantity: selectedItem.quantity - saleQuantity,
        lastUpdated: Timestamp.now()
      });

      setSuccess('Sale created successfully');
      setShowSaleModal(false);
      // Reload data
      window.location.reload();
    } catch (err) {
      setError('Failed to create sale');
    }
  };

  // Update inventory quantity
  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 0) {
      setError('Quantity cannot be negative');
      return;
    }

    try {
      await updateDoc(doc(db, 'inventory', itemId), {
        quantity: newQuantity,
        lastUpdated: Timestamp.now()
      });
      setSuccess('Quantity updated successfully');
      // Reload data
      window.location.reload();
    } catch (err) {
      setError('Failed to update quantity');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="container mt-4">
      <h2>Staff Dashboard</h2>
      
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Row className="mt-4">
        <Col md={6}>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span>Inventory Overview</span>
              <Button variant="primary" size="sm" onClick={() => setShowSaleModal(true)}>
                Create Sale
              </Button>
            </Card.Header>
            <Card.Body>
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map(item => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.quantity}</td>
                      <td>${item.price}</td>
                      <td>
                        <Button
                          variant="warning"
                          size="sm"
                          onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 0}
                        >
                          Decrease
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card>
            <Card.Header>Recent Sales</Card.Header>
            <Card.Body>
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Items</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(sale => (
                    <tr key={sale.id}>
                      <td>{sale.date.toLocaleDateString()}</td>
                      <td>{sale.items.length} items</td>
                      <td>${sale.total}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Sale Modal */}
      <Modal show={showSaleModal} onHide={() => setShowSaleModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Create New Sale</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Select Item</Form.Label>
              <Form.Select
                value={selectedItem?.id || ''}
                onChange={(e) => {
                  const item = inventory.find(i => i.id === e.target.value);
                  setSelectedItem(item || null);
                }}
              >
                <option value="">Select an item</option>
                {inventory.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} (Stock: {item.quantity})
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Quantity</Form.Label>
              <Form.Control
                type="number"
                min="1"
                value={saleQuantity}
                onChange={(e) => setSaleQuantity(Number(e.target.value))}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Price</Form.Label>
              <Form.Control
                type="number"
                min="0"
                step="0.01"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSaleModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreateSale}>
            Create Sale
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default StaffDashboard; 