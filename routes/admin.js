const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { db } = require('../database/init');

const router = express.Router();

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'smart-car-wash-pro-secret-key-2024';

// Admin login
router.post('/login', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find admin by email
    const admin = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM admins WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('Admin found:', admin);
    console.log('Password from DB:', admin.password);
    console.log('Password from request:', password);

    // Check password
    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: admin.id, 
        email: admin.email, 
        name: admin.name,
        role: admin.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify JWT middleware
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid token.' });
  }
};

// Get dashboard analytics
router.get('/dashboard', verifyToken, async (req, res) => {
  try {
    // Get total orders
    const totalOrders = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM orders', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    // Get total revenue
    const totalRevenue = await new Promise((resolve, reject) => {
      db.get('SELECT SUM(price) as total FROM orders WHERE status != "cancelled"', (err, row) => {
        if (err) reject(err);
        else resolve(row.total || 0);
      });
    });

    // Get cumulative working time
    const totalWorkingTime = await new Promise((resolve, reject) => {
      db.get('SELECT SUM(duration_minutes) as total FROM orders WHERE status = "completed"', (err, row) => {
        if (err) reject(err);
        else resolve(row.total || 0);
      });
    });

    const totalDistance = await new Promise((resolve, reject) => {
      db.get(`SELECT SUM(distance_km) as total FROM orders WHERE status = 'completed'`, (err, row) => {
          if (err) reject(err);
          else resolve(row.total || 0);
      });
  });

    // Get orders by status
    const ordersByStatus = await new Promise((resolve, reject) => {
      db.all(`
        SELECT status, COUNT(*) as count 
        FROM orders 
        GROUP BY status
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Get recent orders
    const recentOrders = await new Promise((resolve, reject) => {
      db.all(`
        SELECT o.*, m.name as mobile_name
        FROM orders o
        LEFT JOIN mobiles m ON o.mobile_id = m.id
        ORDER BY o.created_at DESC
        LIMIT 10
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Get mobile units status
    const mobileStatus = await new Promise((resolve, reject) => {
      db.all(`
        SELECT m.*, o.vehicle_number, o.status as current_order_status
        FROM mobiles m
        LEFT JOIN orders o ON m.current_order_id = o.id
        ORDER BY m.name
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Get daily revenue for last 7 days
    const dailyRevenue = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          DATE(created_at, '+3 hours') as date,
          COUNT(*) as orders_count,
          SUM(price) as revenue
        FROM orders 
        WHERE created_at >= date('now', '-7 days')
        AND status != 'cancelled'
        GROUP BY DATE(created_at, '+3 hours')
        ORDER BY date DESC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({
      overview: {
        totalOrders,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalWorkingTime,
        totalDistance: Math.round(totalDistance * 10) / 10,
        averageOrderValue: totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0
      },
      ordersByStatus,
      recentOrders,
      mobileStatus,
      dailyRevenue
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Get activity logs
router.get('/logs', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, orderId } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT al.*, o.vehicle_number, m.name as mobile_name
      FROM activity_logs al
      LEFT JOIN orders o ON al.order_id = o.id
      LEFT JOIN mobiles m ON al.mobile_id = m.id
    `;
    
    const params = [];
    if (orderId) {
      query += ' WHERE al.order_id = ?';
      params.push(orderId);
    }
    
    query += ' ORDER BY al.timestamp DESC, al.id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const logs = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Get total count
    const totalCount = await new Promise((resolve, reject) => {
      let countQuery = 'SELECT COUNT(*) as count FROM activity_logs';
      const countParams = [];
      
      if (orderId) {
        countQuery += ' WHERE order_id = ?';
        countParams.push(orderId);
      }
      
      db.get(countQuery, countParams, (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Logs error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Get all orders for admin
router.get('/orders', verifyToken, async (req, res) => {
  try {
    const { status, mobileId, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT o.*, m.name as mobile_name
      FROM orders o
      LEFT JOIN mobiles m ON o.mobile_id = m.id
    `;

    const whereClauses = [];
    const params = [];

    if (status) {
      whereClauses.push('o.status = ?');
      // query += ' WHERE o.status = ?';
      params.push(status);
    }
    if (mobileId) {
      whereClauses.push('o.mobile_id = ?');
      params.push(mobileId);
    }

    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }
    
    query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const orders = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json(orders);

  } catch (error) {
    console.error('Orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Update order status (admin)
router.patch('/orders/:id/status', verifyToken, async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status, notes } = req.body;

    const validStatuses = ['pending', 'assigned', 'on_way', 'washing', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // --- התיקון מתחיל כאן ---
    // 1. שלוף את פרטי ההזמנה *לפני* כל פעולה אחרת.
    // זה ייתן לנו גישה ל-mobile_id ולמיקום, שנצטרך אותם בהמשך.
    const orderDetails = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, row) => {
          if (err) reject(err);
          else if (!row) reject(new Error('Order not found'));
          else resolve(row);
      });
  });
  
  // --- עטפנו את כל פעולות הכתיבה ל-DB ב-serialize כדי להבטיח סדר וביטחון ---
  db.serialize(async () => {
    try {
      db.run('BEGIN TRANSACTION');

      // עדכן את סטטוס ההזמנה
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [status, orderId],
          (err) => { if (err) reject(err); else resolve(); }
        );
      });

      // רשום את הפעילות בלוג
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO activity_logs (order_id, status, mobile_id, notes) VALUES (?, ?, ?, ?)',
          [orderId, status, orderDetails.mobile_id, notes || `Status updated to ${status} by admin`],
          (err) => { if (err) reject(err); else resolve(); }
        );
      });

      // אם ההזמנה הושלמה/בוטלה והייתה לה ניידת משויכת
      if ((status === 'completed' || status === 'cancelled') && orderDetails.mobile_id) {
        const mobileId = orderDetails.mobile_id;
        const io = req.app.get('io');
    
        // חפש את ההזמנה הבאה בתור עבור אותה ניידת
        const nextOrder = await new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM orders 
                 WHERE mobile_id = ? AND status = 'pending' 
                 ORDER BY requested_datetime ASC 
                 LIMIT 1`,
                [mobileId],
                (err, row) => { if (err) reject(err); else resolve(row); }
            );
        });
    
        if (nextOrder) {
            // אם יש הזמנה הבאה: עדכן אותה ואת הניידת
            console.log(`[QueueManager] Order #${orderId} finished. Assigning next order #${nextOrder.id} to mobile unit #${mobileId}.`);
            
            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE mobiles SET current_order_id = ?, location_lat = ?, location_lng = ? WHERE id = ?`,
                    [nextOrder.id, orderDetails.location_lat, orderDetails.location_lng, mobileId],
                    (err) => { if (err) reject(err); else resolve(); }
                );
            });
    
            const newStatusForNextOrder = 'assigned';
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [newStatusForNextOrder, nextOrder.id],
                    (err) => { if (err) reject(err); else resolve(); }
                );
            });
            
            await new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO activity_logs (order_id, status, mobile_id, notes) VALUES (?, ?, ?, ?)',
                    [nextOrder.id, newStatusForNextOrder, mobileId, 'Auto-assigned from queue.'],
                    (err) => { if (err) reject(err); else resolve(); }
                );
            });
            
            io.to(`order-${nextOrder.id}`).emit('status-update', { orderId: nextOrder.id, status: newStatusForNextOrder, timestamp: new Date() });
            io.emit('admin-status-update', { orderId: nextOrder.id, status: newStatusForNextOrder, timestamp: new Date() });
    
        } else {
            // אם אין הזמנה הבאה: שחרר את הניידת לחלוטין
            console.log(`[QueueManager] Order #${orderId} finished. No next order for mobile unit #${mobileId}. Setting unit to available.`);
            
            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE mobiles 
                     SET is_available = 1, current_order_id = NULL, available_from = datetime('now'), location_lat = ?, location_lng = ?
                     WHERE id = ?`,
                    [orderDetails.location_lat, orderDetails.location_lng, mobileId],
                    (err) => { if (err) reject(err); else resolve(); }
                );
            });
        }
      }
      
      db.run('COMMIT');

      // שלח עדכון לגבי ההזמנה המקורית
      const io = req.app.get('io');
      io.to(`order-${orderId}`).emit('status-update', { orderId, status, timestamp: new Date() });
      io.emit('admin-status-update', { orderId, status, timestamp: new Date() });

      res.json({ message: 'Status updated successfully', status, orderId: parseInt(orderId, 10) });

    } catch (transactionError) {
        db.run('ROLLBACK');
        // נעביר את השגיאה ל-catch החיצוני
        throw transactionError;
    }
  });

} catch (error) {
  console.error('Error updating status:', error);
  res.status(500).json({ error: 'Failed to update status' });
}
});
// Get mobile units management
router.get('/mobiles', verifyToken, async (req, res) => {
  try {
    const mobiles = await new Promise((resolve, reject) => {
      db.all(`
        SELECT m.*, o.vehicle_number, o.status as current_order_status
        FROM mobiles m
        LEFT JOIN orders o ON m.current_order_id = o.id
        ORDER BY m.name`, 
        (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json(mobiles);

  } catch (error) {
    console.error('Mobiles error:', error);
    res.status(500).json({ error: 'Failed to fetch mobile units' });
  }
});

// Update mobile unit status
router.patch('/mobiles/:id', verifyToken, async (req, res) => {
  try {
    const mobileId = req.params.id;
    const { is_available, location_lat, location_lng, available_from } = req.body;

    const updateFields = [];
    const updateValues = [];

    if (is_available !== undefined) {
      updateFields.push('is_available = ?');
      updateValues.push(is_available);
    }
    if (location_lat !== undefined) {
      updateFields.push('location_lat = ?');
      updateValues.push(location_lat);
    }
    if (location_lng !== undefined) {
      updateFields.push('location_lng = ?');
      updateValues.push(location_lng);
    }
    if (available_from !== undefined) {
      updateFields.push('available_from = ?');
      updateValues.push(available_from);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(mobileId);

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE mobiles SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ message: 'Mobile unit updated successfully' });

  } catch (error) {
    console.error('Mobile update error:', error);
    res.status(500).json({ error: 'Failed to update mobile unit' });
  }
});

module.exports = router;
