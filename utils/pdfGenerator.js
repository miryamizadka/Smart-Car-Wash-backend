const puppeteer = require('puppeteer');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs').promises;

/**
 * Generate professional PDF invoice for car wash order
 * @param {number} orderId - Order ID
 * @param {Object} orderData - Order data
 * @returns {string} PDF file path
 */
const generatePDF = async (orderId, orderData) => {
  try {
    // Ensure PDFs directory exists
    const pdfsDir = path.join(__dirname, '../pdfs');
    await fs.mkdir(pdfsDir, { recursive: true });

    // Generate QR code
    const qrCodeData = `Order #${orderId} - Track at localhost:3001`;
    const qrCodeDataURL = await QRCode.toDataURL(qrCodeData, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Generate HTML content
    const htmlContent = generateInvoiceHTML(orderId, orderData, qrCodeDataURL);

    // Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Generate PDF
    const pdfPath = path.join(pdfsDir, `order-${orderId}.pdf`);
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    });

    await browser.close();

    console.log(`✅ PDF generated: ${pdfPath}`);
    return pdfPath;

  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

/**
 * Generate HTML content for invoice
 * @param {number} orderId - Order ID
 * @param {Object} orderData - Order data
 * @param {string} qrCodeDataURL - QR code data URL
 * @returns {string} HTML content
 */
const generateInvoiceHTML = (orderId, orderData, qrCodeDataURL) => {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const serviceTypeMap = {
    'exterior': 'Exterior Wash',
    'interior': 'Interior Clean',
    'exterior+interior': 'Exterior + Interior',
    'polish': 'Polish Service',
    'wax': 'Wax Service'
  };

  const vehicleTypeMap = {
    'sedan': 'Sedan',
    'suv': 'SUV',
    'truck': 'Truck',
    'van': 'Van',
    'motorcycle': 'Motorcycle'
  };

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Smart Car Wash Pro - Invoice #${orderId}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Arial', sans-serif;
                line-height: 1.6;
                color: #000;
                background: #fff;
            }
            
            .invoice-container {
                max-width: 800px;
                margin: 0 auto;
                padding: 40px;
                background: #fff;
            }
            
            .header {
                text-align: center;
                border-bottom: 3px solid #000;
                padding-bottom: 30px;
                margin-bottom: 40px;
            }
            
            .logo {
                font-size: 36px;
                font-weight: bold;
                color: #000;
                margin-bottom: 10px;
                letter-spacing: 2px;
            }
            
            .tagline {
                font-size: 14px;
                color: #666;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            
            .invoice-details {
                display: flex;
                justify-content: space-between;
                margin-bottom: 40px;
            }
            
            .invoice-info {
                flex: 1;
            }
            
            .invoice-info h2 {
                font-size: 24px;
                margin-bottom: 20px;
                color: #000;
                border-bottom: 2px solid #000;
                padding-bottom: 10px;
            }
            
            .info-row {
                display: flex;
                margin-bottom: 8px;
                font-size: 14px;
            }
            
            .info-label {
                font-weight: bold;
                width: 120px;
                color: #000;
            }
            
            .info-value {
                color: #333;
            }
            
            .order-details {
                margin-bottom: 40px;
            }
            
            .order-details h3 {
                font-size: 18px;
                margin-bottom: 20px;
                color: #000;
                border-bottom: 1px solid #ccc;
                padding-bottom: 10px;
            }
            
            .details-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
            }
            
            .detail-section {
                background: #f9f9f9;
                padding: 20px;
                border: 1px solid #ddd;
            }
            
            .detail-section h4 {
                font-size: 16px;
                margin-bottom: 15px;
                color: #000;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            
            .pricing-section {
                background: #000;
                color: #fff;
                padding: 30px;
                margin: 40px 0;
                text-align: center;
            }
            
            .pricing-section h3 {
                font-size: 24px;
                margin-bottom: 20px;
                text-transform: uppercase;
                letter-spacing: 2px;
            }
            
            .price-display {
                font-size: 48px;
                font-weight: bold;
                margin: 20px 0;
            }
            
            .duration-display {
                font-size: 18px;
                opacity: 0.9;
            }
            
            .qr-section {
                text-align: center;
                margin: 40px 0;
                padding: 30px;
                border: 2px solid #000;
            }
            
            .qr-section h4 {
                font-size: 16px;
                margin-bottom: 20px;
                color: #000;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            
            .qr-code {
                margin: 20px 0;
            }
            
            .qr-instructions {
                font-size: 14px;
                color: #666;
                margin-top: 15px;
            }
            
            .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #ccc;
                text-align: center;
                font-size: 12px;
                color: #666;
            }
            
            .status-badge {
                display: inline-block;
                padding: 8px 16px;
                background: #000;
                color: #fff;
                font-size: 12px;
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 1px;
                border-radius: 4px;
            }
        </style>
    </head>
    <body>
        <div class="invoice-container">
            <div class="header">
                <div class="logo">SMART CAR WASH PRO</div>
                <div class="tagline">Professional Mobile Car Wash Services</div>
            </div>
            
            <div class="invoice-details">
                <div class="invoice-info">
                    <h2>INVOICE</h2>
                    <div class="info-row">
                        <span class="info-label">Invoice #:</span>
                        <span class="info-value">${orderId}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Date:</span>
                        <span class="info-value">${currentDate}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Status:</span>
                        <span class="info-value">
                            <span class="status-badge">${orderData.status.toUpperCase()}</span>
                        </span>
                    </div>
                </div>
                
                <div class="invoice-info">
                    <h2>ORDER DETAILS</h2>
                    <div class="info-row">
                        <span class="info-label">Vehicle:</span>
                        <span class="info-value">${orderData.vehicleNumber}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Type:</span>
                        <span class="info-value">${vehicleTypeMap[orderData.vehicleType] || orderData.vehicleType}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Service:</span>
                        <span class="info-value">${serviceTypeMap[orderData.serviceType] || orderData.serviceType}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Dirt Level:</span>
                        <span class="info-value">${orderData.dirtLevel}/5</span>
                    </div>
                </div>
            </div>
            
            <div class="order-details">
                <h3>SERVICE INFORMATION</h3>
                <div class="details-grid">
                    <div class="detail-section">
                        <h4>Service Details</h4>
                        <div class="info-row">
                            <span class="info-label">Service Type:</span>
                            <span class="info-value">${serviceTypeMap[orderData.serviceType] || orderData.serviceType}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Dirt Level:</span>
                            <span class="info-value">${orderData.dirtLevel}/5</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Requested Time:</span>
                            <span class="info-value">${new Date(orderData.requestedDateTime).toLocaleString()}</span>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h4>Mobile Unit</h4>
                        <div class="info-row">
                            <span class="info-label">Assigned Unit:</span>
                            <span class="info-value">${orderData.mobile.name}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Distance:</span>
                            <span class="info-value">${orderData.mobile.distance.toFixed(1)} km</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Est. Arrival:</span>
                            <span class="info-value">${new Date(orderData.mobile.estimatedArrival).toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="pricing-section">
                <h3>TOTAL AMOUNT</h3>
                <div class="price-display">₪${orderData.price}</div>
                <div class="duration-display">Estimated Duration: ${orderData.duration} minutes</div>
            </div>
            
            <div class="qr-section">
                <h4>TRACK YOUR ORDER</h4>
                <div class="qr-code">
                    <img src="${qrCodeDataURL}" alt="QR Code" style="width: 200px; height: 200px;">
                </div>
                <div class="qr-instructions">
                    Scan this QR code to track your order status in real-time<br>
                    Or visit: localhost:3001/track/${orderId}
                </div>
            </div>
            
            <div class="footer">
                <p>Thank you for choosing Smart Car Wash Pro 2.0</p>
                <p>For support, contact us at support@carwash.com</p>
                <p>Generated on ${new Date().toLocaleString()}</p>
            </div>
        </div>
    </body>
    </html>
  `;
};

module.exports = { generatePDF };
