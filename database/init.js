const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs'); 
const dbPath = path.join(__dirname, 'carwash.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Orders table
      db.run(`
        CREATE TABLE IF NOT EXISTS orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          vehicle_number TEXT NOT NULL,
          vehicle_type TEXT NOT NULL,
          service_type TEXT NOT NULL,
          requested_datetime DATETIME NOT NULL,
          location_lat REAL NOT NULL,
          location_lng REAL NOT NULL,
          location_address TEXT,
          vehicle_image TEXT,
          dirt_level INTEGER NOT NULL CHECK (dirt_level >= 1 AND dirt_level <= 5),
          price REAL NOT NULL,
          duration_minutes INTEGER NOT NULL,
          distance_km REAL,
          mobile_id INTEGER,
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'on_way', 'washing', 'completed', 'cancelled')),
          customer_name TEXT,
          customer_phone TEXT,
          customer_email TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (mobile_id) REFERENCES mobiles (id)
        )
      `);

      // Mobiles table
      db.run(`
        CREATE TABLE IF NOT EXISTS mobiles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          location_lat REAL NOT NULL,
          location_lng REAL NOT NULL,
          available_from DATETIME NOT NULL,
          is_available BOOLEAN DEFAULT true,
          current_order_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (current_order_id) REFERENCES orders (id)
        )
      `);

      // Activity logs table
      db.run(`
        CREATE TABLE IF NOT EXISTS activity_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          status TEXT NOT NULL,
          mobile_id INTEGER,
          notes TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_id) REFERENCES orders (id),
          FOREIGN KEY (mobile_id) REFERENCES mobiles (id)
        )
      `);

      // Admins table
      db.run(`
        CREATE TABLE IF NOT EXISTS admins (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT DEFAULT 'admin',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insert default admin - הסיסמה היא 'password'
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync("password", salt);
      
      db.run(
        'INSERT OR IGNORE INTO admins (email, password, name) VALUES (?, ?, ?)',
        ['admin@carwash.com', hashedPassword, 'Admin User']
      );

      // Insert sample mobile units
      const sampleMobiles = [
        { name: 'Mobile Unit Alpha', lat: 32.0853, lng: 34.7818, available_from: new Date().toISOString() },
        { name: 'Mobile Unit Beta', lat: 32.0753, lng: 34.7918, available_from: new Date(Date.now() + 30*60000).toISOString() },
        { name: 'Mobile Unit Gamma', lat: 32.0953, lng: 34.7718, available_from: new Date(Date.now() + 60*60000).toISOString() },
        { name: 'Mobile Unit Delta', lat: 32.0653, lng: 34.8018, available_from: new Date(Date.now() + 90*60000).toISOString() },
        { name: 'Mobile Unit Epsilon', lat: 32.1053, lng: 34.7618, available_from: new Date(Date.now() + 120*60000).toISOString() }
      ];

      

      const insertMobile = db.prepare(`
        INSERT OR IGNORE INTO mobiles (name, location_lat, location_lng, available_from) 
        VALUES (?, ?, ?, ?)
      `);

      sampleMobiles.forEach(mobile => {
        insertMobile.run(mobile.name, mobile.lat, mobile.lng, mobile.available_from);
      });

      insertMobile.finalize((err) => {
        if (err) {
          return reject(err);
        }
        console.log('✅ Database initialized successfully');
        resolve();
      });
    });
  });
};

module.exports = { db, initDatabase };