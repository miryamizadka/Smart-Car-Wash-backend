const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../database/init');
const { 
  calculateDuration, 
  calculatePrice, 
  findBestMobile, 
  generateOrderSummary 
} = require('../utils/calculations');
const { generatePDF } = require('../utils/pdfGenerator');

const router = express.Router();

// Validation middleware
const validateOrder = [
  body('vehicle_number').notEmpty().withMessage('Vehicle number is required'),
  body('vehicle_type').isIn(['sedan', 'suv', 'truck', 'van', 'motorcycle']).withMessage('Invalid vehicle type'),
  body('service_type').custom(value => {
    const validServices = ['exterior', 'interior', 'exterior+interior', 'polish', 'wax'];
    const selectedServices = value.split('+');
    const isValid = selectedServices.every(service => validServices.includes(service));    
    if (!isValid) {
        throw new Error('Invalid service type combination');
    }
    return true;
}).withMessage('Invalid service type'),  
  body('requested_datetime').isISO8601().withMessage('Invalid date format'),
  body('location_lat').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('location_lng').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  body('dirt_level').isInt({ min: 1, max: 5 }).withMessage('Dirt level must be between 1-5'),
  body('customer_name').optional().isString(),
  body('customer_phone').optional().isString(),
  body('customer_email').optional().isEmail()
];

router.post('/estimate', validateOrder, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const orderData = req.body;

        const mobiles = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM mobiles', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        const activeOrders = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM orders WHERE status NOT IN ('completed', 'cancelled')", (err, rows) => {
                if (err) reject(err); else resolve(rows);
            });
        });

        const bestMobile = findBestMobile(mobiles, orderData.location_lat, orderData.location_lng, activeOrders);

        if (!bestMobile) {
            return res.status(404).json({ error: 'No available mobile units found for estimation.' });
        }

        const orderSummary = generateOrderSummary(orderData, bestMobile);

        res.json({
            price: orderSummary.price,
            duration: orderSummary.duration,
            distance: bestMobile.distance,
            mobileName: bestMobile.name
        });

    } catch (error) {
        console.error('Error calculating estimate:', error);
        res.status(500).json({ error: 'Failed to calculate price estimate' });
    }
});

// Create new order
router.post('/', validateOrder, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const orderData = req.body;
    
    // Get all available mobiles
    const mobiles = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM mobiles', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const activeOrders = await new Promise((resolve, reject) => {
        db.all("SELECT * FROM orders WHERE status NOT IN ('completed', 'cancelled')", (err, rows) => {
            if (err) reject(err); else resolve(rows);
        });
    });

    // Find best mobile unit
    const bestMobile = findBestMobile(mobiles, orderData.location_lat, orderData.location_lng, activeOrders);
    
    if (!bestMobile) {
      return res.status(400).json({ 
        error: 'No available mobile units at this time' 
      });
    }

    // Generate order summary
    const orderSummary = generateOrderSummary(orderData, bestMobile);
    
    // Save order to database
    const orderId = await new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT INTO orders (
          vehicle_number, vehicle_type, service_type, requested_datetime,
          location_lat, location_lng, location_address, vehicle_image,
          dirt_level, price, duration_minutes, distance_km, mobile_id, status,
          customer_name, customer_phone, customer_email
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        orderData.vehicle_number,
        orderData.vehicle_type,
        orderData.service_type,
        orderData.requested_datetime,
        orderData.location_lat,
        orderData.location_lng,
        orderData.location_address || '',
        orderData.vehicle_image || '',
        orderData.dirt_level,
        orderSummary.price,
        orderSummary.duration,
        bestMobile.distance,
        bestMobile.id,
        'pending',
        orderData.customer_name || '',
        orderData.customer_phone || '',
        orderData.customer_email || ''
      ], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
      
      stmt.finalize();
    });

    // Update mobile availability
    await new Promise((resolve, reject) => {
      const estimatedEndTime = new Date(Date.now() + (orderSummary.duration * 60000));
      db.run(
        'UPDATE mobiles SET is_available = 0, current_order_id = ?, available_from = ? WHERE id = ?',
        [orderId, estimatedEndTime.toISOString(), bestMobile.id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Log activity
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO activity_logs (order_id, status, mobile_id, notes) VALUES (?, ?, ?, ?)',
        [orderId, 'pending', bestMobile.id, 'Order created and mobile assigned'],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    if (bestMobile.is_available === 1 && new Date(bestMobile.available_from) <= new Date()) {
        // אם כן, הפעל את הטיימר לעדכון סטטוס אוטומטי
        console.log(`[Auto-Update] Scheduling automatic status change for order #${orderId} because mobile unit #${bestMobile.id} is available now.`);

    // Set a timer to automatically change status after 3 minutes
    const THREE_MINUTES = 3 * 60 * 1000;
    setTimeout(() => {
      const newStatus = 'assigned'; // או 'on_way', לבחירתך
      console.log(`[Auto-Update] Updating order #${orderId} to status: ${newStatus}`);

      db.serialize(() => {
        // 1. Update the order status in the database
        db.run(
          'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = ?',
          [newStatus, orderId, 'pending'], // רק אם הסטטוס עדיין pending
          function(err) {
            if (err) {
              console.error(`[Auto-Update] Error updating order #${orderId}:`, err);
              return;
            }
            // אם אף שורה לא עודכנה (כי המנהל שינה סטטוס בינתיים), אל תמשיך
            if (this.changes === 0) {
                console.log(`[Auto-Update] Order #${orderId} was already updated manually. Aborting auto-update.`);
                return;
            }
          
            // 2. Add a new activity log
            db.run(
              'INSERT INTO activity_logs (order_id, status, mobile_id, notes) VALUES (?, ?, ?, ?)',
              [orderId, newStatus, bestMobile.id, 'Order automatically confirmed and assigned'],
              (err) => {
                if (err) {
                  console.error(`[Auto-Update] Error logging activity for order #${orderId}:`, err);
                }
              }
            );
            
            // 3. Emit a real-time update to the client
            io.to(`order-${orderId}`).emit('status-update', { orderId, status: newStatus, timestamp: new Date() });
            io.emit('admin-status-update', { orderId, status: newStatus, timestamp: new Date() }); // עדכון גם לדשבורד של האדמין
            console.log(`[Auto-Update] Successfully updated and notified for order #${orderId}.`);
          }
        );
      });
    }, THREE_MINUTES);
    } else {
        console.log(`[Auto-Update] Order #${orderId} assigned to a busy unit's queue. No automatic status change scheduled. Manual admin action required.`);
    }


    // Generate PDF
    const pdfPath = await generatePDF(orderId, orderSummary);

    // Return order details with PDF path
    const response = {
      ...orderSummary,
      orderId,
      pdfPath: `/pdfs/order-${orderId}.pdf`,
      trackingUrl: `http://localhost:3001/track/${orderId}`
    };

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('order-created', response);

    res.status(201).json(response);

  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Get order details
router.get('/:id', async (req, res) => {
  try {
    const orderId = req.params.id;
    
    const order = await new Promise((resolve, reject) => {
      db.get(`
        SELECT o.*, m.name as mobile_name, m.location_lat as mobile_lat, m.location_lng as mobile_lng
        FROM orders o
        LEFT JOIN mobiles m ON o.mobile_id = m.id
        WHERE o.id = ?
      `, [orderId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Update order status
router.patch('/:id/status', async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status, notes } = req.body;

    const validStatuses = ['pending', 'assigned', 'on_way', 'washing', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Update order status
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, orderId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Log activity
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO activity_logs (order_id, status, notes) VALUES (?, ?, ?)',
        [orderId, status, notes || 'Status updated'],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // If completed, free up mobile unit
    if (status === 'completed') {
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE mobiles SET is_available = 1, current_order_id = NULL WHERE current_order_id = ?',
          [orderId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`order-${orderId}`).emit('status-update', { orderId, status, timestamp: new Date() });

    res.json({ message: 'Status updated successfully', status });

  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Get order tracking info
router.get('/:id/track', async (req, res) => {
  try {
    const orderId = req.params.id;
    
    const order = await new Promise((resolve, reject) => {
      db.get(`
        SELECT o.*, m.name as mobile_name, m.location_lat as mobile_lat, m.location_lng as mobile_lng
        FROM orders o
        LEFT JOIN mobiles m ON o.mobile_id = m.id
        WHERE o.id = ?
      `, [orderId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Get recent activity logs
    const logs = await new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM activity_logs WHERE order_id = ? ORDER BY timestamp DESC LIMIT 10',
        [orderId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({
      order: {
        id: order.id,
        status: order.status,
        vehicleNumber: order.vehicle_number,
        serviceType: order.service_type,
        price: order.price,
        duration: order.duration_minutes,
        requestedDateTime: order.requested_datetime,
        mobile: {
          name: order.mobile_name,
          location: {
            lat: order.mobile_lat,
            lng: order.mobile_lng
          }
        }
      },
      logs
    });

  } catch (error) {
    console.error('Error fetching tracking info:', error);
    res.status(500).json({ error: 'Failed to fetch tracking info' });
  }
});

module.exports = router;
