// Smart Car Wash Pro 2.0 - Configuration
module.exports = {
  // Server configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // JWT configuration
  jwtSecret: process.env.JWT_SECRET || 'smart-car-wash-pro-secret-key-2024-super-secure',
  jwtExpiresIn: '24h',
  
  // Database configuration
  database: {
    path: process.env.DB_PATH || './database/carwash.db'
  },
  
  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true
  },
  
  // File upload configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB
    uploadPath: process.env.UPLOAD_PATH || './uploads',
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  },
  
  // PDF generation configuration
  pdf: {
    outputPath: process.env.PDF_PATH || './pdfs',
    format: 'A4',
    margin: {
      top: '20mm',
      right: '20mm',
      bottom: '20mm',
      left: '20mm'
    }
  },
  
  // Business logic configuration
  business: {
    basePrice: 50, // NIS
    dirtLevelMultiplier: 20, // NIS per dirt level
    distanceMultiplier: 2, // NIS per kilometer
    baseTime: 30, // minutes
    dirtTimeMultiplier: 10, // minutes per dirt level
    interiorTime: 15, // additional minutes
    polishTime: 15, // additional minutes
    waxTime: 10 // additional minutes
  }
};
