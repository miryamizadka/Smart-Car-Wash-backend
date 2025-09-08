# Smart Car Wash Pro 2.0 - Backend

This repository contains the backend API for the Smart Car Wash Pro application. It handles order processing, user authentication, mobile unit assignments, real-time updates, and PDF generation.

---

### 🔗 **Link to Frontend Repository**
[[smart-car-wash-frontend](https://github.com/your-username/smart-car-wash-frontend)](https://github.com/miryamizadka/Smart-Car-Wash-frontend.git)

---

### ✨ Features

*   **RESTful API** built with Node.js and Express.
*   **SQLite Database** for persistent data storage.
*   **JWT-based Authentication** for the admin panel.
*   **Real-time Communication** with Socket.io for live tracking.
*   **Smart Queuing Logic** for assigning mobile units efficiently.
*   **Automated PDF Invoice Generation** using Puppeteer.
*   **File Uploads** for vehicle images using Multer.
*   **Comprehensive Logging** of all order status changes.

### 🛠️ Tech Stack

*   **Node.js** & **Express.js**
*   **SQLite3** for the database
*   **Socket.io** for WebSockets
*   **Puppeteer** for PDF generation
*   **jsonwebtoken** & **bcryptjs** for security
*   **Multer** for handling file uploads

### 🚀 Getting Started

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/smart-car-wash-backend.git
    cd smart-car-wash-backend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Create an environment file:**
    Create a `.env` file in the `backend` root and add the following:
    ```env
    NODE_ENV=development
    PORT=3000
    JWT_SECRET=a-very-secret-key
    CORS_ORIGIN=http://localhost:3001
    ```

4.  **Start the development server:**
    ```bash
    npm run dev
    ```
    The server will start on `http://localhost:3000`. The database `carwash.db` will be created automatically with initial data on the first run.

### 🔑 Admin Credentials (Default)
*   **Email:** `admin@carwash.com`
*   **Password:** `password`

---
### 📋 API Endpoints

*   `POST /api/orders`: Create a new order.
*   `POST /api/orders/estimate`: Get a price and time estimate.
*   `GET /api/orders/:id/track`: Get tracking info for an order.
*   `POST /api/admin/login`: Admin login.
*   `GET /api/admin/dashboard`: Get dashboard analytics.
*   `GET /api/admin/orders`: Get a list of orders with filters.
*   `PATCH /api/admin/orders/:id/status`: Update an order's status.
*   `GET /api/admin/mobiles`: Get all mobile units.
*   ...and more.
