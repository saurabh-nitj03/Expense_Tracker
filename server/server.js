
require('dotenv').config()
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User =require('./model/userSchema');
const Expense = require ('./model/expenseSchema');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware for JWT authentication
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication required' });
  }
};

// User Registration
app.post('/api/users/register', async (req, res) => {
  try {
    const { name, email, password, budget } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      budget: budget || 0
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        budget: user.budget
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User Login
app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        budget: user.budget
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current user
app.get('/api/users/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
app.put('/api/users/me', auth, async (req, res) => {
  try {
    const { name, budget } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (name) user.name = name;
    if (budget !== undefined) user.budget = budget;
    
    await user.save();
    
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      budget: user.budget
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add Expense (with user authentication)
app.post('/api/expenses', auth, async (req, res) => {
  try {
    const { item, amount, category, date } = req.body;
    const newExpense = new Expense({ 
      userId: req.userId,
      item, 
      amount: Number(amount), // Ensure amount is stored as number
      category: category || 'Miscellaneous',
      date: date ? new Date(date) : new Date()
    });
    await newExpense.save();
    res.json(newExpense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Expenses with pagination and filters (for authenticated user)
app.get('/api/expenses', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    let dateFilter = { userId: req.userId };
    const { period, startDate, endDate, category } = req.query;
    
    if (period) {
      const today = new Date();
      let startOfPeriod = new Date();
      
      if (period === 'day') {
        startOfPeriod.setHours(0, 0, 0, 0);
      } else if (period === 'week') {
        const day = today.getDay();
        startOfPeriod.setDate(today.getDate() - day);
        startOfPeriod.setHours(0, 0, 0, 0);
      } else if (period === 'month') {
        startOfPeriod = new Date(today.getFullYear(), today.getMonth(), 1);
      } else if (period === 'year') {
        startOfPeriod = new Date(today.getFullYear(), 0, 1);
      }
      
      dateFilter = { userId: req.userId, date: { $gte: startOfPeriod, $lte: today } };
    } else if (startDate && endDate) {
      dateFilter = { 
        userId: req.userId,
        date: { 
          $gte: new Date(startDate), 
          $lte: new Date(endDate) 
        } 
      };
    }

    // Add category filter if provided
    if (category && category !== 'all') {
      dateFilter.category = category;
    }

    const expenses = await Expense.find(dateFilter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);
      
    const total = await Expense.countDocuments(dateFilter);
    const totalExpense = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);

    // Get expense distribution by category
    const categoryDistribution = await Expense.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.userId) } },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } }
    ]);
 
    res.json({
      expenses,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalItems: total,
      totalExpense,
      categoryDistribution
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all expenses for export (for authenticated user)
app.get('/api/expenses/export', auth, async (req, res) => {
  try {
    let dateFilter = { userId: req.userId };
    const { period, startDate, endDate, category } = req.query;
    
    if (period) {
      const today = new Date();
      let startOfPeriod = new Date();
      
      if (period === 'day') {
        startOfPeriod.setHours(0, 0, 0, 0);
      } else if (period === 'week') {
        const day = today.getDay();
        startOfPeriod.setDate(today.getDate() - day);
        startOfPeriod.setHours(0, 0, 0, 0);
      } else if (period === 'month') {
        startOfPeriod = new Date(today.getFullYear(), today.getMonth(), 1);
      } else if (period === 'year') {
        startOfPeriod = new Date(today.getFullYear(), 0, 1);
      }
      
      dateFilter = { userId: req.userId, date: { $gte: startOfPeriod, $lte: today } };
    } else if (startDate && endDate) {
      dateFilter = { 
        userId: req.userId,
        date: { 
          $gte: new Date(startDate), 
          $lte: new Date(endDate) 
        } 
      };
    }

    // Add category filter if provided
    if (category && category !== 'all') {
      dateFilter.category = category;
    }

    const expenses = await Expense.find(dateFilter).sort({ date: -1 });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Edit Expense (with authentication)
app.put('/api/expenses/:id', auth, async (req, res) => {
  try {
    const { item, amount, category, date } = req.body;
    
    // Check if the expense belongs to the user
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    if (expense.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to modify this expense' });
    }
    
    const updated = await Expense.findByIdAndUpdate(
      req.params.id, 
      { 
        item, 
        amount: Number(amount), // Ensure amount is stored as number
        category, 
        date: date ? new Date(date) : undefined 
      }, 
      { new: true }
    );
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Expense (with authentication)
app.delete('/api/expenses/:id', auth, async (req, res) => {
  try {
    // Check if the expense belongs to the user
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    if (expense.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this expense' });
    }
    
    await Expense.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get expense statistics
app.get('/api/expenses/stats', auth, async (req, res) => {
  try {
    // Monthly trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const userObjectId = new mongoose.Types.ObjectId(req.userId);
    
    const monthlyTrend = await Expense.aggregate([
      { 
        $match: { 
          userId: userObjectId,
          date: { $gte: sixMonthsAgo } 
        } 
      },
      {
        $group: {
          _id: { 
            year: { $year: "$date" },
            month: { $month: "$date" }
          },
          total: { $sum: "$amount" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);
    
    // Format the result for easier consumption by front-end
    const formattedMonthlyTrend = monthlyTrend.map(item => {
      const date = new Date(item._id.year, item._id.month - 1, 1);
      return {
        month: date.toLocaleString('default', { month: 'short' }),
        year: item._id.year,
        total: item.total
      };
    });
    
    // Category distribution
    const categoryDistribution = await Expense.aggregate([
      { $match: { userId: userObjectId } },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } }
    ]);
    
    res.json({
      monthlyTrend: formattedMonthlyTrend,
      categoryDistribution
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));