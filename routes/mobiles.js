const express = require('express');
const { db } = require('../database/init');

const router = express.Router();

// Get all mobile units
router.get('/', async (req, res) => {
  try {
    const mobiles = await new Promise((resolve, reject) => {
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

    res.json(mobiles);
  } catch (error) {
    console.error('Error fetching mobiles:', error);
    res.status(500).json({ error: 'Failed to fetch mobile units' });
  }
});

// Get available mobile units
router.get('/available', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    const mobiles = await new Promise((resolve, reject) => {
      db.all(`
        SELECT * FROM mobiles 
        WHERE is_available = 1 
        AND available_from <= datetime('now')
        ORDER BY available_from ASC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Calculate distances if coordinates provided
    if (lat && lng) {
      const mobilesWithDistance = mobiles.map(mobile => {
        const distance = calculateDistance(
          parseFloat(lat), 
          parseFloat(lng),
          mobile.location_lat, 
          mobile.location_lng
        );
        return {
          ...mobile,
          distance: Math.round(distance * 10) / 10 // Round to 1 decimal
        };
      });

      // Sort by distance
      mobilesWithDistance.sort((a, b) => a.distance - b.distance);
      res.json(mobilesWithDistance);
    } else {
      res.json(mobiles);
    }

  } catch (error) {
    console.error('Error fetching available mobiles:', error);
    res.status(500).json({ error: 'Failed to fetch available mobile units' });
  }
});

// Get mobile unit by ID
router.get('/:id', async (req, res) => {
  try {
    const mobileId = req.params.id;
    
    const mobile = await new Promise((resolve, reject) => {
      db.get(`
        SELECT m.*, o.vehicle_number, o.status as current_order_status
        FROM mobiles m
        LEFT JOIN orders o ON m.current_order_id = o.id
        WHERE m.id = ?
      `, [mobileId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!mobile) {
      return res.status(404).json({ error: 'Mobile unit not found' });
    }

    res.json(mobile);
  } catch (error) {
    console.error('Error fetching mobile:', error);
    res.status(500).json({ error: 'Failed to fetch mobile unit' });
  }
});

// Update mobile unit location
router.patch('/:id/location', async (req, res) => {
  try {
    const mobileId = req.params.id;
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE mobiles SET location_lat = ?, location_lng = ? WHERE id = ?',
        [lat, lng, mobileId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ message: 'Location updated successfully' });

  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// Update mobile unit availability
router.patch('/:id/availability', async (req, res) => {
  try {
    const mobileId = req.params.id;
    const { is_available, available_from } = req.body;

    const updateFields = ['is_available = ?'];
    const updateValues = [is_available];

    if (available_from) {
      updateFields.push('available_from = ?');
      updateValues.push(available_from);
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

    res.json({ message: 'Availability updated successfully' });

  } catch (error) {
    console.error('Error updating availability:', error);
    res.status(500).json({ error: 'Failed to update availability' });
  }
});

// Helper function to calculate distance
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

module.exports = router;
