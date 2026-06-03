# D03 AMS Backend Deployment Guide for cPanel

## Prerequisites

1. **cPanel Account** with:
   - MySQL Database created
   - Node.js Selector (if available) or use SQLite for simpler deployment

2. **Local Setup**:
   - Install Node.js on your computer
   - Clone/push your code to the backend folder

## Option 1: MySQL Deployment (Recommended for Production)

### Step 1: Create MySQL Database in cPanel

1. Log in to cPanel
2. Go to **MySQL Database Wizard**
3. Create database: `thams_db`
4. Create user: `thams_user` (with a strong password)
5. Add user to database with ALL privileges

### Step 2: Import MySQL Schema

1. Go to **phpMyAdmin**
2. Select your `thams_db` database
3. Click **Import**
4. Upload the file: `mysql-schema.sql`
5. Click **Go**

### Step 3: Create Environment File

Create a `.env` file in the `thams-backend` folder with:

```env
PORT=3001
DB_TYPE=mysql
DB_HOST=localhost
DB_USER=thams_user
DB_PASS=your_strong_password
DB_NAME=thams_db
JWT_SECRET=thams-secret-key-2024
```

Replace `your_strong_password` with the actual MySQL password you created.

### Step 4: Install Dependencies

In your terminal (SSH to cPanel or local):

```bash
cd thams-backend
npm install
```

### Step 5: Start the Server

If using cPanel Node.js Selector:
1. Go to **Setup Node.js App** in cPanel
2. Create new application:
   - Node.js version: 18 or 20
   - Application mode: Production
   - Application root: thams-backend
   - Application URL: your subdomain
3. Start the application

If using PM2:
```bash
npm install -g pm2
pm2 start server.js --name thams-backend
pm2 startup
```

---

## Option 2: SQLite Deployment (Simpler)

If MySQL is not available or you want simpler setup:

### Step 1: Use SQLite (No Database Setup Needed)

The backend uses SQLite by default. Just make sure the `thams-backend` folder is accessible.

### Step 2: Start Server

```bash
cd thams-backend
node server.js
```

Or with PM2:
```bash
pm2 start server.js
```

---

## Frontend Deployment

### Step 1: Build the React App

```bash
cd thams-frontend
npm run build
```

### Step 2: Upload to cPanel

1. Go to **File Manager**
2. Navigate to `public_html`
3. Upload the contents of `dist` folder to `public_html`

### Step 3: Configure API URL

In `thams-frontend/src/App.jsx`, find:
```javascript
const API_URL = 'http://localhost:3001/api'
```

Change to your production URL:
```javascript
const API_URL = 'https://yourdomain.com/api'
```

Then rebuild:
```bash
npm run build
```

---

## Troubleshooting

### Port Issues
If port 3001 is not available, change in `.env`:
```env
PORT=3002
```

### Database Connection Errors
- Verify MySQL credentials in `.env`
- Check that database user has proper privileges
- Verify database exists in phpMyAdmin

### Email Not Working
- Check SMTP configuration in `.env`
- Verify email credentials are correct
- Check cPanel email settings

### Common Errors

1. **"ER_ACCESS_DENIED_ERROR"**
   - Wrong MySQL username or password
   - User doesn't have permission for the database

2. **"ER_DB_DROP_EXISTS"**
   - Database already exists - this is normal, tables will be created

3. **Port already in use**
   - Another process is using the port
   - Change PORT in `.env`

---

## Security Notes

1. **Never commit `.env` file to git**
2. **Use strong passwords** for MySQL and JWT_SECRET
3. **Enable SSL** for your domain in cPanel
4. **Keep Node.js updated** to latest LTS version