
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Container, Row, Col, Form, Button, Table, Pagination, Card } from 'react-bootstrap';
import { FaMicrophone, FaFileExcel, FaEdit, FaTrash } from 'react-icons/fa';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const API_URL = "https://expense-tracker-backend-jui1.onrender.com/api";

// Set up axios with authentication
axios.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

function ExpenseTracker({ user }) {
  const [expenses, setExpenses] = useState([]);
  const [newExpense, setNewExpense] = useState({
    item: '',
    amount: '',
    category: 'Miscellaneous',
    date: new Date().toISOString().split('T')[0]
  });
  const [editingExpense, setEditingExpense] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0
  });
  const [filters, setFilters] = useState({
    period: 'month',
    startDate: '',
    endDate: '',
    limit: 50
  });
  const [totalExpense, setTotalExpense] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [userBudget, setUserBudget] = useState(user?.budget || 0);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition();
        recognitionInstance.lang = 'en-IN';
        recognitionInstance.continuous = false;
        recognitionInstance.interimResults = false;

        recognitionInstance.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          parseVoiceInput(transcript);
          setIsRecording(false);
        };

        recognitionInstance.onend = () => {
          setIsRecording(false);
        };

        recognitionInstance.onerror = (event) => {
          console.error('Speech recognition error', event);
          setIsRecording(false);
        };

        setRecognition(recognitionInstance);
      }
    }
  }, []);

  // Get user info including budget
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await axios.get(`${API_URL}/users/me`);
        setUserBudget(response.data.budget);
      } catch (error) {
        console.error('Error fetching user info:', error);
      }
    };

    fetchUserInfo();
  }, []);

  // Fetch expenses
  const fetchExpenses = async () => {
    try {
      const { period, startDate, endDate, limit } = filters;
      const { currentPage } = pagination;
      
      let queryParams = `page=${currentPage}&limit=${limit}`;
      
      if (period) {
        queryParams += `&period=${period}`;
      } else if (startDate && endDate) {
        queryParams += `&startDate=${startDate}&endDate=${endDate}`;
      }
      
      const response = await axios.get(`${API_URL}/expenses?${queryParams}`);
     
      setExpenses(response.data.expenses);
      setPagination({
        currentPage: response.data.currentPage,
        totalPages: response.data.totalPages,
        totalItems: response.data.totalItems
      });
      setTotalExpense(response.data.totalExpense);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    }
  };

  // Initial fetch and when filters or pagination change
  useEffect(() => {
    fetchExpenses();
  }, [filters, pagination.currentPage]);

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (editingExpense) {
      setEditingExpense({ ...editingExpense, [name]: value });
    } else {
      setNewExpense({ ...newExpense, [name]: value });
    }
  };

  // Update budget
  const updateBudget = async () => {
    try {
      const response = await axios.put(`${API_URL}/users/me`, { budget: userBudget });
      setUserBudget(response.data.budget);
      alert('Budget updated successfully!');
    } catch (error) {
      console.error('Error updating budget:', error);
    }
  };

  // Add new expense
  const addExpense = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/expenses`, newExpense);
      setNewExpense({
        item: '',
        amount: '',
        category: 'Miscellaneous',
        date: new Date().toISOString().split('T')[0]
      });
      fetchExpenses();
    } catch (error) {
      console.error('Error adding expense:', error);
    }
  };

  // Start voice recording
  const startRecording = () => {
    if (recognition && !isRecording) {
      recognition.start();
      setIsRecording(true);
    }
  };

  // Parse voice input to extract expense details
  const parseVoiceInput = (text) => {
    console.log('Voice input:', text);
    
    // Example formats: "spent 500 on groceries" or "groceries 500"
    const spentOnRegex = /spent\s+(\d+)\s+on\s+(.+)/i;
    const simpleRegex = /(.+?)\s+(\d+)$/i;
    
    let match = text.match(spentOnRegex);
    
    if (match) {
      const amount = parseInt(match[1]);
      const item = match[2].trim();
      
      setNewExpense({
        ...newExpense,
        item,
        amount
      });
    } else {
      match = text.match(simpleRegex);
      
      if (match) {
        const item = match[1].trim();
        const amount = parseInt(match[2]);
        
        setNewExpense({
          ...newExpense,
          item,
          amount
        });
      } else {
        alert("Couldn't understand the expense from your voice. Please try again or enter manually.");
      }
    }
  };

  // Start editing an expense
  const handleEdit = (expense) => {
    setEditingExpense({
      ...expense,
      date: new Date(expense.date).toISOString().split('T')[0]
    });
  };

  // Update an expense
  const updateExpense = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/expenses/${editingExpense._id}`, editingExpense);
      setEditingExpense(null);
      fetchExpenses();
    } catch (error) {
      console.error('Error updating expense:', error);
    }
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingExpense(null);
  };

  // Delete an expense
  const deleteExpense = async (id) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        await axios.delete(`${API_URL}/expenses/${id}`);
        fetchExpenses();
      } catch (error) {
        console.error('Error deleting expense:', error);
      }
    }
  };

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });
    setPagination({ ...pagination, currentPage: 1 });
  };

  // Export to Excel
  const exportToExcel = async () => {
    try {
      const { period, startDate, endDate } = filters;
      
      let queryParams = '';
      if (period) {
        queryParams += `?period=${period}`;
      } else if (startDate && endDate) {
        queryParams += `?startDate=${startDate}&endDate=${endDate}`;
      }
      
      const response = await axios.get(`${API_URL}/expenses/export${queryParams}`);
      const expenses = response.data;
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Expenses');
      
      worksheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Item', key: 'item', width: 30 },
        { header: 'Category', key: 'category', width: 15 },
        { header: 'Amount (₹)', key: 'amount', width: 15 }
      ];
      
      expenses.forEach(expense => {
        worksheet.addRow({
          date: new Date(expense.date).toLocaleDateString(),
          item: expense.item,
          category: expense.category,
          amount: expense.amount
        });
      });
      
      // Add total row
      worksheet.addRow({});
      worksheet.addRow({
        item: 'Total',
        amount: expenses.reduce((sum, expense) => sum + expense.amount, 0)
      });
      
      // Style the header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), 'Expense_Report.xlsx');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
    }
  };

  // Calculate budget status - moved inside component to ensure availability of totalExpense
  const budgetRemaining = userBudget - totalExpense;
  const budgetStatus = budgetRemaining >= 0 ? 'under-budget' : 'over-budget';

  // Generate pagination items
  const paginationItems = [];
  for (let page = 1; page <= pagination.totalPages; page++) {
    paginationItems.push(
      <Pagination.Item 
        key={page} 
        active={page === pagination.currentPage}
        onClick={() => setPagination({ ...pagination, currentPage: page })}
      >
        {page}
      </Pagination.Item>
    );
  }

  return (
    <Container fluid>
      <Row className="mt-4 mb-4">
        <Col>
          <h1 className="text-primary">Welcome, {user?.name || 'User'}</h1>
          <p className="text-muted">Track your personal expenses with voice commands or manual entry</p>
        </Col>
      </Row>

      {/* User Budget */}
      <Row className="mb-4">
        <Col md={6}>
          <div className="expense-form">
            <h3 className="mb-3">Your Budget</h3>
            <Form.Group className="mb-3 d-flex align-items-center">
              <Form.Label className="me-3 mb-0">Monthly Budget:</Form.Label>
              <Form.Control
                type="number"
                value={userBudget}
                onChange={(e) => setUserBudget(parseFloat(e.target.value) || 0)}
                style={{ width: '150px' }}
                className="me-3"
              />
              <Button variant="primary" onClick={updateBudget}>Update</Button>
            </Form.Group>
          </div>
        </Col>
      </Row>

      {/* Budget Status Card */}
      <Row className="mb-4">
        <Col md={6}>
          <Card 
            border={budgetStatus === 'under-budget' ? 'success' : 'danger'}
            className={`budget-status-card ${budgetStatus}`}
          >
            <Card.Body>
              <Card.Title>{budgetStatus === 'under-budget' ? 'Budget Status: On Track' : 'Budget Status: Overspent'}</Card.Title>
              <Card.Text className={`fs-2 fw-bold ${budgetStatus === 'under-budget' ? 'text-success' : 'text-danger'}`}>
                ₹{Math.abs(budgetRemaining).toLocaleString()} {budgetStatus === 'under-budget' ? 'Remaining' : 'Over Budget'}
              </Card.Text>
              <Card.Text className="text-muted">
                Budget: ₹{userBudget.toLocaleString()} / Spent: ₹{totalExpense.toLocaleString()}
              </Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Add Expense Form */}
      <Row className="mb-4">
        <Col>
          <div className="expense-form">
            <h2 className="mb-3">
              {editingExpense ? 'Edit Expense' : 'Add New Expense'}
            </h2>
            <Form onSubmit={editingExpense ? updateExpense : addExpense}>
              <Row>
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>Item</Form.Label>
                    <Form.Control
                      type="text"
                      name="item"
                      placeholder="What did you spend on?"
                      value={editingExpense ? editingExpense.item : newExpense.item}
                      onChange={handleInputChange}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group className="mb-3">
                    <Form.Label>Amount (₹)</Form.Label>
                    <Form.Control
                      type="number"
                      name="amount"
                      placeholder="How much?"
                      value={editingExpense ? editingExpense.amount : newExpense.amount}
                      onChange={handleInputChange}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>Category</Form.Label>
                    <Form.Select
                      name="category"
                      value={editingExpense ? editingExpense.category : newExpense.category}
                      onChange={handleInputChange}
                    >
                      <option value="Miscellaneous">Miscellaneous</option>
                      <option value="Food">Food</option>
                      <option value="Transport">Transport</option>
                      <option value="Entertainment">Entertainment</option>
                      <option value="Shopping">Shopping</option>
                      <option value="Bills">Bills</option>
                      <option value="Health">Health</option>
                      <option value="Education">Education</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group className="mb-3">
                    <Form.Label>Date</Form.Label>
                    <Form.Control
                      type="date"
                      name="date"
                      value={editingExpense ? editingExpense.date : newExpense.date}
                      onChange={handleInputChange}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={2} className="d-flex align-items-end">
                  <div className="d-flex">
                    {editingExpense ? (
                      <>
                        <Button variant="success" type="submit" className="me-2">
                          Update
                        </Button>
                        <Button variant="secondary" onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="primary" type="submit" className="me-2">
                          Add
                        </Button>
                        <Button
                          variant={isRecording ? "danger" : "outline-primary"}
                          className={`mic-button ${isRecording ? "active" : ""}`}
                          onClick={startRecording}
                          type="button"
                        >
                          <FaMicrophone />
                        </Button>
                      </>
                    )}
                  </div>
                </Col>
              </Row>
            </Form>
          </div>
        </Col>
      </Row>

      {/* Filters and Export */}
      <Row className="mb-4">
        <Col>
          <div className="expense-filters">
            <Row>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Filter by Period</Form.Label>
                  <Form.Select
                    name="period"
                    value={filters.period}
                    onChange={handleFilterChange}
                  >
                    <option value="">Custom Range</option>
                    <option value="day">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="year">This Year</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              
              {!filters.period && (
                <>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>Start Date</Form.Label>
                      <Form.Control
                        type="date"
                        name="startDate"
                        value={filters.startDate}
                        onChange={handleFilterChange}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>End Date</Form.Label>
                      <Form.Control
                        type="date"
                        name="endDate"
                        value={filters.endDate}
                        onChange={handleFilterChange}
                      />
                    </Form.Group>
                  </Col>
                </>
              )}
              
              <Col md={2}>
                <Form.Group>
                  <Form.Label>Items per page</Form.Label>
                  <Form.Select
                    name="limit"
                    value={filters.limit}
                    onChange={handleFilterChange}
                  >
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="200">200</option>
                    <option value="500">500</option>
                    <option value="1000">1000</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              
              <Col md={1} className="d-flex align-items-end">
                <Button variant="success" onClick={exportToExcel}>
                  <FaFileExcel /> Export
                </Button>
              </Col>
            </Row>
          </div>
        </Col>
      </Row>

      {/* Summary Card */}
      <Row className="mb-4">
        <Col>
          <div className="expense-summary">
            <Row>
              <Col>
                <Card border="primary">
                  <Card.Body>
                    <Card.Title>Total Expenses</Card.Title>
                    <Card.Text className="fs-2 fw-bold text-primary">
                    {/* {console.log(totalExpense)}
                    {console.log(totalExpense.toLocaleString())} */}
                      ₹{totalExpense.toLocaleString()}
                    </Card.Text>
                    <Card.Text className="text-muted">
                      {filters.period === 'day' && 'Today'}
                      {filters.period === 'week' && 'This Week'}
                      {filters.period === 'month' && 'This Month'}
                      {filters.period === 'year' && 'This Year'}
                      {!filters.period && 'Custom Range'}
                    </Card.Text>
                  </Card.Body>
                </Card>
              </Col>
              <Col>
                <Card border="info">
                  <Card.Body>
                    <Card.Title>Total Entries</Card.Title>
                    <Card.Text className="fs-2 fw-bold text-info">
                      {pagination.totalItems}
                    </Card.Text>
                    <Card.Text className="text-muted">
                      {pagination.totalItems === 1 ? 'Expense' : 'Expenses'} Recorded
                    </Card.Text>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </div>
        </Col>
      </Row>

      {/* Expense Table */}
      <Row>
        <Col>
          <div className="expense-table">
            <Table striped hover responsive>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Amount (₹)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-3">
                      No expenses found. Start adding some!
                    </td>
                  </tr>
                ) : (
                  expenses.map((expense, index) => (
                    <tr key={expense._id} className="table-row">
                      <td>{(pagination.currentPage - 1) * Number(filters.limit) + index + 1}</td>
                      <td>{new Date(expense.date).toLocaleDateString()}</td>
                      <td>{expense.item}</td>
                      <td>
                        <span className="badge bg-info">{expense.category}</span>
                      </td>
                      <td className="fw-bold">₹{expense.amount.toLocaleString()}</td>
                      <td>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="me-2"
                          onClick={() => handleEdit(expense)}
                        >
                          <FaEdit />
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => deleteExpense(expense._id)}
                        >
                          <FaTrash />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="pagination-container py-3">
                <Pagination>
                  <Pagination.First onClick={() => setPagination({ ...pagination, currentPage: 1 })} />
                  <Pagination.Prev 
                    onClick={() => {
                      if (pagination.currentPage > 1) {
                        setPagination({ ...pagination, currentPage: pagination.currentPage - 1 });
                      }
                    }} 
                  />
                  {paginationItems}
                  <Pagination.Next 
                    onClick={() => {
                      if (pagination.currentPage < pagination.totalPages) {
                        setPagination({ ...pagination, currentPage: pagination.currentPage + 1 });
                      }
                    }} 
                  />
                  <Pagination.Last onClick={() => setPagination({ ...pagination, currentPage: pagination.totalPages })} />
                </Pagination>
              </div>
            )}
          </div>
        </Col>
      </Row>
    </Container>
  );
}

export default ExpenseTracker;
