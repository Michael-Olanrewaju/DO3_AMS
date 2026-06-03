require('dotenv').config();
const express = require('express');
const cors = require('cors');
const initSqlJs = require('sql.js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// ==========================================
// DATABASE CONFIGURATION
// ==========================================
// Set DB_TYPE to 'mysql' for cPanel MySQL deployment, 'sqlite' for local development
const DB_TYPE = process.env.DB_TYPE || 'sqlite';

// MySQL Configuration (for cPanel deployment)
const mysqlConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'thams_user',
  password: process.env.DB_PASS || 'your_password',
  database: process.env.DB_NAME || 'thams_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let db; // SQLite database
let pool; // MySQL pool
let isMySQL = DB_TYPE === 'mysql';
let queryFn, insertFn; // Abstracted query functions

// ==========================================
// EMAIL CONFIGURATION
// ==========================================
const emailConfigs = [
  {
    host: 'mail.trainingheights.com',
    port: 465,
    secure: true,
    tls: { rejectUnauthorized: false },
    auth: { user: 'admin.sla@trainingheights.com', pass: 'Certi7yied-5LA' }
  },
  {
    host: 'mail.trainingheights.com',
    port: 587,
    secure: false,
    tls: { rejectUnauthorized: false },
    auth: { user: 'admin.sla@trainingheights.com', pass: 'Certi7yied-5LA' }
  },
  {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    tls: { rejectUnauthorized: false },
    auth: { user: 'admin.sla@trainingheights.com', pass: 'Certi7yied-5LA' }
  }
];

// Create email transporter
// Create transporter with first available config
let transporter = nodemailer.createTransport(emailConfigs[0]);

// Function to try sending email with fallback configs
async function trySendEmail(mailOptions) {
  const errors = [];

  for (let i = 0; i < emailConfigs.length; i++) {
    try {
      const testTransporter = nodemailer.createTransport(emailConfigs[i]);
      const info = await testTransporter.sendMail(mailOptions);
      // Update global transporter to working config
      transporter = testTransporter;
      console.log(`Email sent successfully using config ${i + 1}: ${emailConfigs[i].host}:${emailConfigs[i].port}`);
      return { success: true, response: info.response };
    } catch (error) {
      console.log(`Config ${i + 1} failed (${emailConfigs[i].host}:${emailConfigs[i].port}):`, error.code || error.message);
      errors.push({ config: i + 1, error: error.message });
    }
  }

  console.error('All email configs failed:', errors);
  return { success: false, errors };
}

// Function to send password setup email
async function sendPasswordSetupEmail(email, name, resetToken) {
  const resetLink = `http://localhost:5173/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: '"D03 AMS System" <admin.sla@trainingheights.com>',
    to: email,
    subject: 'Set Your Password - D03 AMS Vendor Portal',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome to D03 AMS Vendor Portal</h2>
        <p>Dear ${name},</p>
        <p>Your vendor registration has been approved. Please set up your password to access the vendor portal.</p>
        <p><a href="${resetLink}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Set Password</a></p>
        <p>Or copy and paste this link: ${resetLink}</p>
        <p>This link will expire in 24 hours.</p>
        <p>If you did not request this, please ignore this email.</p>
        <p style="margin-top: 20px; color: #6b7280; font-size: 12px;">
          Best regards,<br/>
          D03 AMS Administration
        </p>
      </div>
    `
  };

  try {
    await trySendEmail(mailOptions);
    console.log(`Password setup email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error.message);
    return false;
  }
}

// Function to generate asset tag based on model/brand
function generateAssetTag(model, brand) {
  const year = new Date().getFullYear().toString().slice(-2); // Get last 2 digits of year (e.g., 26)
  const modelLower = (model || '').toLowerCase();
  const brandLower = (brand || '').toLowerCase();

  // Determine prefix based on model/brand
  let prefix = 'TH';
  if (modelLower.includes('macbook') || brandLower.includes('macbook') || brandLower.includes('apple')) {
    prefix = 'TH-MAC';
  } else if (modelLower.includes('hp') || brandLower.includes('hp') || brandLower.includes('hewlett')) {
    prefix = 'TH-HP';
  } else if (modelLower.includes('dell') || brandLower.includes('dell')) {
    prefix = 'TH-DELL';
  } else {
    // For other devices, use model name (first word, up to 6 chars)
    const modelWord = modelLower.split(/[\s-]/)[0] || 'DEV';
    prefix = 'TH-' + modelWord.substring(0, 6).toUpperCase();
  }

  // Get current year for counting
  const currentYear = new Date().getFullYear();

  // Count existing devices with same prefix and year
  let count = 1;
  const existingDevices = runQuery(
    "SELECT asset_tag FROM devices WHERE asset_tag LIKE ? AND asset_tag LIKE ?",
    [`${prefix}%`, `%${year}%`]
  );

  if (existingDevices.length > 0) {
    // Find the highest number for this prefix+year
    existingDevices.forEach(d => {
      const match = d.asset_tag.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num >= count) count = num + 1;
      }
    });
  }

  // Format: TH-HP26-01 (2-digit year + 2-digit sequential)
  return `${prefix}${year}-${count.toString().padStart(2, '0')}`;
}

// Function to send device allocation email to employee
async function sendDeviceAllocationEmail(email, name, device, reportUrl) {
  const deviceInfo = {
    asset_tag: device?.asset_tag || 'N/A',
    brand: device?.brand || 'N/A',
    model: device?.model || 'N/A',
    serial_number: device?.serial_number || 'N/A',
    processor: device?.processor || 'N/A',
    ram_gb: device?.ram_gb || 'N/A',
    storage_gb: device?.storage_gb || 'N/A'
  };

  const mailOptions = {
    from: '"D03 AMS System" <admin.sla@trainingheights.com>',
    to: email,
    subject: 'Device Assigned to You - D03 AMS',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Device Assigned to You</h2>
        <p>Dear ${name || 'Employee'},</p>
        <p>A device has been assigned to you. Please verify and confirm receipt of the device.</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Asset Tag:</strong> ${deviceInfo.asset_tag}</p>
          <p><strong>Brand:</strong> ${deviceInfo.brand}</p>
          <p><strong>Model:</strong> ${deviceInfo.model}</p>
          <p><strong>Serial Number:</strong> ${deviceInfo.serial_number}</p>
          <p><strong>Processor:</strong> ${deviceInfo.processor}</p>
          <p><strong>RAM:</strong> ${deviceInfo.ram_gb} GB</p>
          <p><strong>Storage:</strong> ${deviceInfo.storage_gb} GB</p>
        </div>
        <p>Please verify that you have received this device and report any issues using the link below:</p>
        <p><a href="${reportUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify Device Receipt</a></p>
        <p>Or copy and paste this link: ${reportUrl}</p>
        <p>This link will expire in 7 days.</p>
        <p>If you did not receive this device, please contact your IT administrator immediately.</p>
        <p style="margin-top: 20px; color: #6b7280; font-size: 12px;">
          Best regards,<br/>
          D03 AMS Administration
        </p>
      </div>
    `
  };

  try {
    console.log('Attempting to send email to:', email);
    const result = await trySendEmail(mailOptions);
    if (result.success) {
      console.log(`Device allocation email sent successfully to ${email}. Response:`, result.response);
      return true;
    } else {
      console.log(`DEV: Manual report link for ${email}: ${reportUrl}`);
      return false;
    }
  } catch (error) {
    console.error('Error sending email:', error.code, error.message);
    console.log(`DEV: Manual report link for ${email}: ${reportUrl}`);
    return false;
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const JWT_SECRET = 'thams-secret-key-2024';
const DB_PATH = path.join(__dirname, 'thams.db');

async function initDatabase() {
  // Initialize SQLite (default)
  // For MySQL deployment, use DB_TYPE=mysql environment variable
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      department TEXT,
      phone TEXT,
      vendor_id TEXT,
      employee_id TEXT,
      job_title TEXT,
      work_email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company_location TEXT,
      address TEXT,
      rating INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      on_time_delivery REAL DEFAULT 0,
      quality_score REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sla_agreements (
      id TEXT PRIMARY KEY,
      vendor_id TEXT,
      title TEXT NOT NULL,
      ceo_name TEXT,
      ceo_signature TEXT,
      delivery_timeline_days INTEGER,
      warranty_months INTEGER DEFAULT 3,
      response_time_hours INTEGER,
      penalties_per_day REAL,
      specifications TEXT,
      quality_standards TEXT,
      replacement_policy TEXT,
      maintenance_expectations TEXT,
      status TEXT DEFAULT 'draft',
      start_date TEXT,
      end_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      asset_tag TEXT UNIQUE,
      serial_number TEXT,
      model TEXT,
      brand TEXT,
      ram_gb INTEGER,
      storage_gb INTEGER,
      processor TEXT,
      purchase_date TEXT,
      warranty_months INTEGER DEFAULT 12,
      warranty_expiry TEXT,
      actual_delivery_date TEXT,
      expected_delivery_date TEXT,
      vendor_id TEXT,
      condition TEXT DEFAULT 'new',
      status TEXT DEFAULT 'available',
      qr_code TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS device_allocations (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      employee_id TEXT,
      employee_name TEXT,
      employee_email TEXT,
      work_email TEXT,
      department TEXT,
      job_title TEXT,
      issue_date TEXT,
      return_date TEXT,
      issue_condition TEXT,
      return_condition TEXT,
      acknowledgment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(id)
    )
  `);

  // Add missing columns to device_allocations if they don't exist
  function addColumnIfNotExists(table, column, type) {
    const stmt = db.prepare(`PRAGMA table_info(${table})`);
    let exists = false;
    while (stmt.step()) {
      const row = stmt.getAsObject();
      if (row.name === column) {
        exists = true;
        break;
      }
    }
    stmt.free();
    if (!exists) {
      db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
  }
  addColumnIfNotExists('device_allocations', 'assigned_by', 'TEXT');
  addColumnIfNotExists('device_allocations', 'status', "TEXT DEFAULT 'active'");
  addColumnIfNotExists('device_allocations', 'report_token', 'TEXT');
  addColumnIfNotExists('device_allocations', 'employee_name', 'TEXT');
  addColumnIfNotExists('device_allocations', 'employee_email', 'TEXT');
  addColumnIfNotExists('device_allocations', 'work_email', 'TEXT');
  addColumnIfNotExists('device_allocations', 'department', 'TEXT');
  addColumnIfNotExists('device_allocations', 'job_title', 'TEXT');

  // Add missing columns to devices table
  addColumnIfNotExists('devices', 'warranty_months', 'INTEGER DEFAULT 12');
  addColumnIfNotExists('devices', 'warranty_expiry', 'TEXT');
  addColumnIfNotExists('devices', 'purchase_date', 'TEXT');
  addColumnIfNotExists('devices', 'actual_delivery_date', 'TEXT');
  addColumnIfNotExists('devices', 'qr_code', 'TEXT');
  addColumnIfNotExists('devices', 'device_images', 'TEXT');

  db.run(`
    CREATE TABLE IF NOT EXISTS device_reports (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      report_token TEXT UNIQUE,
      report_type TEXT DEFAULT 'acknowledgment',
      description TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(id),
      FOREIGN KEY (employee_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS purchase_requests (
      id TEXT PRIMARY KEY,
      request_number TEXT UNIQUE,
      vendor_id TEXT,
      requested_by TEXT,
      specifications TEXT,
      quantity INTEGER DEFAULT 1,
      status TEXT DEFAULT 'pending',
      quotation TEXT,
      delivery_date TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id),
      FOREIGN KEY (requested_by) REFERENCES users(id)
    )
  `);

  // Add missing columns to purchase_requests if they don't exist
  try { db.run("ALTER TABLE purchase_requests ADD COLUMN product_name TEXT"); } catch {}
  try { db.run("ALTER TABLE purchase_requests ADD COLUMN ram_specs TEXT"); } catch {}
  try { db.run("ALTER TABLE purchase_requests ADD COLUMN processor_specs TEXT"); } catch {}
  try { db.run("ALTER TABLE purchase_requests ADD COLUMN vendor_response TEXT"); } catch {}
  try { db.run("ALTER TABLE devices ADD COLUMN device_images TEXT"); } catch {}
  try { db.run("ALTER TABLE devices ADD COLUMN request_id TEXT"); } catch {}
  try { db.run("ALTER TABLE devices ADD COLUMN expected_delivery_date TEXT"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN job_title TEXT"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN employee_id TEXT"); } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN work_email TEXT"); } catch {}
  try { db.run("ALTER TABLE device_allocations ADD COLUMN assigned_by TEXT"); } catch {}
  try { db.run("ALTER TABLE device_allocations ADD COLUMN status TEXT DEFAULT 'active'"); } catch {}
  try { db.run("ALTER TABLE device_allocations ADD COLUMN report_token TEXT"); } catch {}
  try { db.run("ALTER TABLE device_allocations ADD COLUMN report_submitted_at DATETIME"); } catch {}
  try { db.run("ALTER TABLE device_allocations ADD COLUMN issue_report TEXT"); } catch {}

  db.run(`
    CREATE TABLE IF NOT EXISTS warranty_claims (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      vendor_id TEXT,
      claim_number TEXT UNIQUE,
      type TEXT DEFAULT 'repair',
      description TEXT,
      status TEXT DEFAULT 'pending',
      resolution_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(id),
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    )
  `);

  // Add missing columns to warranty_claims if they don't exist
  try { db.run("ALTER TABLE warranty_claims ADD COLUMN warranty_start_date TEXT"); } catch {}
  try { db.run("ALTER TABLE warranty_claims ADD COLUMN warranty_expiry_date TEXT"); } catch {}

  db.run(`
    CREATE TABLE IF NOT EXISTS maintenance_records (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      schedule_date TEXT,
      completion_date TEXT,
      type TEXT DEFAULT 'preventive',
      description TEXT,
      cost REAL,
      technician TEXT,
      status TEXT DEFAULT 'scheduled',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      vendor_id TEXT,
      title TEXT NOT NULL,
      message TEXT,
      type TEXT DEFAULT 'general',
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS vendor_products (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      category TEXT DEFAULT 'other',
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      token TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS employee_reports (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      report_type TEXT DEFAULT 'other',
      description TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      resolution_notes TEXT,
      resolution_date DATETIME,
      vendor_id TEXT,
      repair_completed DATE,
      returned_to_company DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(id),
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Check if default users exist - wrap in try-catch to handle duplicates gracefully
  try {
    const stmt = db.prepare('SELECT id FROM users WHERE email = ?');
    stmt.bind(['admin@trainingheights.com']);
    let userExists = false;
    if (stmt.step()) {
      userExists = true;
    }
    stmt.free();

    if (!userExists) {
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      db.run(
        'INSERT INTO users (id, name, email, password, role, department) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), 'System Admin', 'admin@trainingheights.com', hashedPassword, 'it_admin', 'IT']
      );
      db.run(
        'INSERT INTO users (id, name, email, password, role, department) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), 'Procurement Officer', 'procurement@trainingheights.com', hashedPassword, 'procurement', 'Procurement']
      );
    }
  } catch (e) {
    // Users likely already exist, continue
    console.log('Default users may already exist, continuing...');
  }

  saveDatabase();
  console.log('Database initialized successfully');

  // Run migrations to add missing columns
  runMigrations();
}

function runMigrations() {
  try {
    // Add vendor_id to employee_reports if not exists
    db.run("ALTER TABLE employee_reports ADD COLUMN vendor_id TEXT");
  } catch (e) {
    // Column may already exist
  }
  try {
    db.run("ALTER TABLE employee_reports ADD COLUMN repair_completed DATE");
  } catch (e) {}
  try {
    db.run("ALTER TABLE employee_reports ADD COLUMN returned_to_company DATE");
  } catch (e) {}
  try {
    db.run("ALTER TABLE notifications ADD COLUMN vendor_id TEXT");
  } catch (e) {}
  try {
    db.run("ALTER TABLE device_allocations ADD COLUMN report_token TEXT");
  } catch (e) {}
  console.log('Database migrations completed');
}

function saveDatabase() {
  if (!isMySQL && db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// ==========================================
// MYSQL DATABASE FUNCTIONS
// ==========================================

async function initMySQL() {
  const mysql = require('mysql2/promise');
  pool = await mysql.createPool(mysqlConfig);
  console.log('MySQL database connected');
}

async function runQueryMySQL(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function runInsertMySQL(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

// ==========================================
// ABSTRACTED DATABASE FUNCTIONS
// ==========================================

function runQuery(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function runInsert(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
}

// ==========================================
// MYSQL HELPER FUNCTIONS (for future use)
// ==========================================
async function runQueryMySQL(sql, params = []) {
  if (!pool) {
    throw new Error('MySQL not initialized. Set DB_TYPE=mysql in environment.');
  }
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function runInsertMySQL(sql, params = []) {
  if (!pool) {
    throw new Error('MySQL not initialized. Set DB_TYPE=mysql in environment.');
  }
  const [result] = await pool.execute(sql, params);
  return result;
}

// Auth Middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const users = runQuery('SELECT * FROM users WHERE id = ?', [decoded.userId]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = users[0];
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Routes

// Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    const users = runQuery('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = users[0];

    // Check if vendor hasn't set password yet
    if (user.password === 'PENDING_RESET') {
      return res.status(401).json({ error: 'Please set your password first. Use the forgot password link to create one.' });
    }

    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, vendor_id: user.vendor_id } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Register
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password, role, department, phone } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);
    const id = uuidv4();
    runInsert(
      'INSERT INTO users (id, name, email, password, role, department, phone) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, email, hashedPassword, role || 'employee', department, phone]
    );
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard Stats
app.get('/api/dashboard/stats', authMiddleware, (req, res) => {
  try {
    const totalDevices = runQuery('SELECT COUNT(*) as count FROM devices')[0]?.count || 0;
    const availableDevices = runQuery('SELECT COUNT(*) as count FROM devices WHERE status = ?', ['available'])[0]?.count || 0;
    const allocatedDevices = runQuery('SELECT COUNT(*) as count FROM devices WHERE status = ?', ['allocated'])[0]?.count || 0;
    const underWarranty = runQuery('SELECT COUNT(*) as count FROM devices WHERE warranty_expiry >= date("now")')[0]?.count || 0;
    const dueMaintenance = runQuery('SELECT COUNT(*) as count FROM devices WHERE status = ?', ['maintenance'])[0]?.count || 0;
    const totalVendors = runQuery('SELECT COUNT(*) as count FROM vendors WHERE status IN (?, ?)', ['active', 'pending_registration'])[0]?.count || 0;
    const pendingRequests = runQuery('SELECT COUNT(*) as count FROM purchase_requests WHERE status = ?', ['pending'])[0]?.count || 0;

    res.json({
      totalDevices,
      availableDevices,
      allocatedDevices,
      underWarranty,
      dueMaintenance,
      totalVendors,
      pendingRequests
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Vendor Management
app.get('/api/vendors', authMiddleware, (req, res) => {
  try {
    const vendors = runQuery('SELECT * FROM vendors ORDER BY created_at DESC');
    res.json(vendors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/vendors', authMiddleware, (req, res) => {
  try {
    const { name, email, phone, address } = req.body;
    const id = uuidv4();
    runInsert(
      'INSERT INTO vendors (id, name, email, phone, address, status) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, email, phone, address, 'pending']
    );
    res.status(201).json({ message: 'Vendor created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/vendors/:id', authMiddleware, (req, res) => {
  try {
    const { name, email, phone, address, rating, status } = req.body;
    runInsert(
      'UPDATE vendors SET name = ?, email = ?, phone = ?, address = ?, rating = ?, status = ? WHERE id = ?',
      [name, email, phone, address, rating, status, req.params.id]
    );
    res.json({ message: 'Vendor updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/vendors/:id', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'it_admin') {
      return res.status(403).json({ error: 'Access denied. Only administrators can delete vendors.' });
    }
    runInsert('DELETE FROM vendors WHERE id = ?', [req.params.id]);
    res.json({ message: 'Vendor deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Device Management
app.get('/api/devices', authMiddleware, (req, res) => {
  try {
    const devices = runQuery(`
      SELECT d.*, v.name as vendor_name
      FROM devices d
      LEFT JOIN vendors v ON d.vendor_id = v.id
      ORDER BY d.created_at DESC
    `);
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get device by ID (public - for employee report page)
app.get('/api/devices/:id', (req, res) => {
  try {
    const devices = runQuery('SELECT * FROM devices WHERE id = ?', [req.params.id]);
    if (devices.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json(devices[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/devices', authMiddleware, async (req, res) => {
  try {
    const { serial_number, model, brand, ram_gb, storage_gb, processor, purchase_date, vendor_id, warranty_months } = req.body;
    const id = uuidv4();
    const asset_tag = generateAssetTag(model, brand);

    const warranty_expiry = new Date(purchase_date);
    warranty_expiry.setMonth(warranty_expiry.getMonth() + (warranty_months || 3));

    const qrData = JSON.stringify({ asset_tag, serial_number, model });
    const qr_code = await QRCode.toDataURL(qrData);

    runInsert(
      `INSERT INTO devices (id, asset_tag, serial_number, model, brand, ram_gb, storage_gb, processor, purchase_date, warranty_expiry, vendor_id, qr_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, asset_tag, serial_number, model, brand, ram_gb, storage_gb, processor, purchase_date, warranty_expiry.toISOString().split('T')[0], vendor_id, qr_code]
    );

    res.status(201).json({ message: 'Device created successfully', device: { asset_tag, qr_code } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/devices/:id', authMiddleware, (req, res) => {
  try {
    const { serial_number, model, brand, ram_gb, storage_gb, processor, vendor_id, condition, status, warranty_months, purchase_date, actual_delivery_date } = req.body;

    // Get current device to check status change
    const currentDevice = runQuery('SELECT status, warranty_months FROM devices WHERE id = ?', [req.params.id]);
    const currentStatus = currentDevice[0]?.status;
    const currentWarrantyMonths = currentDevice[0]?.warranty_months || 12;

    // If status changing to 'delivered', auto-update warranty dates
    let actualDeliveryDate = actual_delivery_date;
    let warrantyExpiry = null;

    if (status === 'delivered' && currentStatus !== 'delivered') {
      // Set actual delivery date to today if not provided
      actualDeliveryDate = actual_delivery_date || new Date().toISOString().split('T')[0];

      // Calculate warranty expiry based on warranty_months
      const deliveryDate = new Date(actualDeliveryDate);
      const months = warranty_months || currentWarrantyMonths;
      deliveryDate.setMonth(deliveryDate.getMonth() + months);
      warrantyExpiry = deliveryDate.toISOString().split('T')[0];
    }

    runInsert(
      `UPDATE devices SET serial_number = ?, model = ?, brand = ?, ram_gb = ?, storage_gb = ?, processor = ?, vendor_id = ?, condition = ?, status = ?, warranty_months = ?, purchase_date = ?, actual_delivery_date = ?, warranty_expiry = ? WHERE id = ?`,
      [serial_number, model, brand, ram_gb, storage_gb, processor, vendor_id, condition, status, warranty_months || currentWarrantyMonths, purchase_date, actualDeliveryDate, warrantyExpiry, req.params.id]
    );
    res.json({ message: 'Device updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/devices/:id', authMiddleware, (req, res) => {
  try {
    runInsert('DELETE FROM devices WHERE id = ?', [req.params.id]);
    res.json({ message: 'Device deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Procurement/Admin: Confirm device delivery
app.put('/api/devices/:id/confirm-delivery', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'procurement' && req.user.role !== 'it_admin') {
      return res.status(403).json({ error: 'Access denied. Only procurement or IT admin can confirm delivery.' });
    }

    // Get current device status and request_id
    const device = runQuery('SELECT status, warranty_expiry, request_id FROM devices WHERE id = ?', [req.params.id]);
    if (device.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Only allow confirming pending_delivery_confirm status
    if (device[0].status !== 'pending_delivery_confirm') {
      return res.status(400).json({ error: 'Device is not pending delivery confirmation' });
    }

    // Calculate warranty expiry if not set (default 12 months from now)
    let warrantyExpiry = device[0].warranty_expiry;
    if (!warrantyExpiry) {
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 12);
      warrantyExpiry = expiryDate.toISOString().split('T')[0];
    }

    // Update status to delivered
    const actualDeliveryDate = new Date().toISOString().split('T')[0];
    runInsert(
      'UPDATE devices SET status = ?, actual_delivery_date = ?, warranty_expiry = ? WHERE id = ?',
      ['delivered', actualDeliveryDate, warrantyExpiry, req.params.id]
    );

    // Check if all devices for this request are now delivered, then update request status
    if (device[0].request_id) {
      const pendingDevices = runQuery(
        "SELECT COUNT(*) as count FROM devices WHERE request_id = ? AND status = 'pending_delivery_confirm'",
        [device[0].request_id]
      );
      const request = runQuery('SELECT quantity FROM purchase_requests WHERE id = ?', [device[0].request_id]);

      // If no more pending devices and we have the expected quantity, mark request as delivered
      if (pendingDevices[0].count === 0 && request.length > 0) {
        runInsert('UPDATE purchase_requests SET status = ? WHERE id = ?', ['delivered', device[0].request_id]);
      }
    }

    // Notify vendor
    const deviceInfo = runQuery('SELECT vendor_id, asset_tag, model FROM devices WHERE id = ?', [req.params.id]);
    if (deviceInfo.length > 0 && deviceInfo[0].vendor_id) {
      const vendor = runQuery('SELECT email, name FROM vendors WHERE id = ?', [deviceInfo[0].vendor_id]);
      if (vendor.length > 0) {
        const vendorUsers = runQuery('SELECT id FROM users WHERE email = ?', [vendor[0].email]);
        if (vendorUsers.length > 0) {
          runInsert(
            'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), vendorUsers[0].id, 'Delivery Confirmed', `Your delivered device (${deviceInfo[0].asset_tag} - ${deviceInfo[0].model}) has been confirmed by procurement.`, 'delivery']
          );
        }
      }
    }

    res.json({ message: 'Device delivery confirmed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Device Allocation
app.get('/api/allocations', authMiddleware, (req, res) => {
  try {
    const allocations = runQuery(`
      SELECT da.*, d.asset_tag, d.model,
             COALESCE(da.employee_name, u.name) as employee_name,
             COALESCE(da.employee_email, u.email) as employee_email,
             COALESCE(da.department, u.department) as department,
             COALESCE(da.job_title, u.job_title) as job_title,
             COALESCE(da.work_email, u.work_email) as work_email
      FROM device_allocations da
      JOIN devices d ON da.device_id = d.id
      LEFT JOIN users u ON da.employee_id = u.id
      ORDER BY da.created_at DESC
    `);
    res.json(allocations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Allocation
app.put('/api/allocations/:id', authMiddleware, async (req, res) => {
  try {
    const { device_id, employee_id, employee_name, employee_email, work_email, department, job_title, issue_date, issue_condition, status, return_date } = req.body;

    console.log('PUT /api/allocations/:id received:', { device_id, employee_id, employee_name, employee_email, work_email, department, job_title, issue_date, issue_condition });

    // Get current allocation to check if employee changed
    const currentAlloc = runQuery('SELECT employee_id FROM device_allocations WHERE id = ?', [req.params.id]);
    const employeeChanged = currentAlloc.length > 0 && currentAlloc[0].employee_id !== employee_id;
    console.log('Current allocation:', currentAlloc, 'Employee changed:', employeeChanged);

    // Generate new report token for the allocation
    const reportToken = uuidv4();

    runInsert(
      `UPDATE device_allocations SET device_id = ?, employee_id = ?, employee_name = ?, employee_email = ?, work_email = ?, department = ?, job_title = ?, issue_date = ?, issue_condition = ?, status = ?, return_date = ?, report_token = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [device_id, employee_id, employee_name || '', employee_email || '', work_email || '', department || '', job_title || '', issue_date, issue_condition, status || 'active', return_date || null, reportToken, req.params.id]
    );

    // Always send notification email if work_email is provided
    if (work_email) {
      const device = runQuery('SELECT * FROM devices WHERE id = ?', [device_id]);

      if (device.length > 0) {
        const employeeTargetEmail = work_email || employee_email;
        const reportUrl = `http://localhost:5173/report-issue?token=${reportToken}&device_id=${device_id}&email=${encodeURIComponent(employeeTargetEmail)}`;

        // Store report token
        runInsert('INSERT OR IGNORE INTO device_reports (id, device_id, employee_id, report_token) VALUES (?, ?, ?, ?)',
          [uuidv4(), device_id, employee_id || 'unknown', reportToken]);

        const deviceDetails = `Asset Tag: ${device[0].asset_tag}, Model: ${device[0].model}, Serial: ${device[0].serial_number}, Brand: ${device[0].brand}, Processor: ${device[0].processor}, RAM: ${device[0].ram_gb}GB, Storage: ${device[0].storage_gb}GB`;

        // Send email notification
        const isReallocation = employeeChanged;
        const mailOptions = {
          from: '"D03 AMS System" <admin.sla@trainingheights.com>',
          to: employeeTargetEmail,
          subject: isReallocation ? `Device Reallocated to You - Action Required` : `Device Assigned to You - Action Required`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">${isReallocation ? 'Device Reallocated to You' : 'New Device Assigned to You'}</h2>
              <p>Dear ${employee_name || 'Employee'},</p>
              <p>${isReallocation ? 'A device has been reassigned to you. Your previous device allocation has been transferred to you.' : 'A device has been assigned to you. Please verify and acknowledge receipt.'}</p>
              <h3>Device Details:</h3>
              <p>${deviceDetails}</p>
              <p><strong>Issue Date:</strong> ${issue_date}</p>
              <p><strong>Condition:</strong> ${issue_condition || 'New'}</p>
              <p style="margin-top: 20px;">
                <a href="${reportUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify & Acknowledge Receipt</a>
              </p>
              <p style="margin-top: 20px; color: #666;">If the button doesn't work, copy this link:<br>${reportUrl}</p>
            </div>
          `
        };

        console.log('Sending reallocation email to:', employeeTargetEmail);

        try {
          await trySendEmail(mailOptions);
          console.log('Reallocation email sent to:', employeeTargetEmail);
        } catch (emailErr) {
          console.log('Error sending reallocation email:', emailErr.message);
          console.log('DEV: Device verification link for', employeeTargetEmail, ':', reportUrl);
        }
      }
    }

    res.json({ message: 'Allocation updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Allocation
app.delete('/api/allocations/:id', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'it_admin') {
      return res.status(403).json({ error: 'Access denied. Only administrators can delete allocations.' });
    }
    // First get the device_id to update its status
    const allocation = runQuery('SELECT device_id FROM device_allocations WHERE id = ?', [req.params.id]);
    if (allocation.length > 0) {
      runInsert('UPDATE devices SET status = ? WHERE id = ?', ['available', allocation[0].device_id]);
    }
    runInsert('DELETE FROM device_allocations WHERE id = ?', [req.params.id]);
    res.json({ message: 'Allocation deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/allocations', authMiddleware, async (req, res) => {
  try {
    const { device_id, employee_id, employee_name, employee_email, work_email, issue_date, issue_condition, acknowledgment } = req.body;
    const id = uuidv4();

    runInsert(
      'INSERT INTO device_allocations (id, device_id, employee_id, employee_name, employee_email, work_email, department, job_title, issue_date, issue_condition, acknowledgment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, device_id, employee_id || 'unknown', employee_name || '', employee_email || '', work_email || '', department || '', job_title || '', issue_date, issue_condition, acknowledgment]
    );

    runInsert('UPDATE devices SET status = ?, condition = ? WHERE id = ?', ['allocated', issue_condition, device_id]);

    // Send notification email to employee
    const device = runQuery('SELECT * FROM devices WHERE id = ?', [device_id]);
    const employeeTargetEmail = work_email || employee_email;

    if (device.length > 0 && employeeTargetEmail) {
      const reportToken = uuidv4();
      const reportUrl = `http://localhost:5173/report-issue?token=${reportToken}&device_id=${device_id}&email=${encodeURIComponent(employeeTargetEmail)}`;

      runInsert('INSERT OR IGNORE INTO device_reports (id, device_id, employee_id, report_token) VALUES (?, ?, ?, ?)',
        [uuidv4(), device_id, employee_id || 'unknown', reportToken]);

      const deviceDetails = `Asset Tag: ${device[0].asset_tag}, Model: ${device[0].model}, Serial: ${device[0].serial_number}, Brand: ${device[0].brand}, Processor: ${device[0].processor}, RAM: ${device[0].ram_gb}GB, Storage: ${device[0].storage_gb}GB`;

      const mailOptions = {
        from: '"D03 AMS System" <admin.sla@trainingheights.com>',
        to: employeeTargetEmail,
        subject: 'Device Assigned to You - Action Required',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">New Device Assigned</h2>
            <p>Dear ${employee_name || 'Employee'},</p>
            <p>A device has been assigned to you. Please verify and acknowledge receipt.</p>
            <h3>Device Details:</h3>
            <p>${deviceDetails}</p>
            <p><strong>Issue Date:</strong> ${issue_date}</p>
            <p><strong>Condition:</strong> ${issue_condition || 'New'}</p>
            <p style="margin-top: 20px;">
              <a href="${reportUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify & Acknowledge Receipt</a>
            </p>
            <p style="margin-top: 20px; color: #666;">If the button doesn't work, copy this link:<br>${reportUrl}</p>
          </div>
        `
      };

      console.log('Sending allocation email to:', employeeTargetEmail);

      try {
        await trySendEmail(mailOptions);
        console.log('Allocation email sent to:', employeeTargetEmail);
      } catch (emailErr) {
        console.log('Error sending allocation email:', emailErr.message);
        console.log('DEV: Device verification link for', employeeTargetEmail, ':', reportUrl);
      }
    }

    res.status(201).json({ message: 'Device allocated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/allocations/:id/return', authMiddleware, (req, res) => {
  try {
    const { return_date, return_condition } = req.body;

    const allocation = runQuery('SELECT device_id FROM device_allocations WHERE id = ?', [req.params.id]);
    if (allocation.length === 0) {
      return res.status(404).json({ error: 'Allocation not found' });
    }

    runInsert(
      'UPDATE device_allocations SET return_date = ?, return_condition = ? WHERE id = ?',
      [return_date, return_condition, req.params.id]
    );

    runInsert('UPDATE devices SET status = ?, condition = ? WHERE id = ?', ['available', return_condition, allocation[0].device_id]);

    res.json({ message: 'Device returned successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Purchase Requests
app.get('/api/requests', authMiddleware, (req, res) => {
  try {
    const requests = runQuery(`
      SELECT pr.*, v.name as vendor_name, u.name as requested_by_name
      FROM purchase_requests pr
      LEFT JOIN vendors v ON pr.vendor_id = v.id
      LEFT JOIN users u ON pr.requested_by = u.id
      ORDER BY pr.created_at DESC
    `);
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/requests', authMiddleware, (req, res) => {
  try {
    const { vendor_id, product_name, specifications, ram_specs, processor_specs, quantity, notes } = req.body;
    const id = uuidv4();
    const request_number = 'PR-' + Date.now().toString(36).toUpperCase();

    runInsert(
      'INSERT INTO purchase_requests (id, request_number, vendor_id, requested_by, product_name, specifications, ram_specs, processor_specs, quantity, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, request_number, vendor_id, req.user.id, product_name || '', specifications || '', ram_specs || '', processor_specs || '', quantity, notes || '']
    );

    res.status(201).json({ message: 'Request created successfully', request_number });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/requests/:id', authMiddleware, (req, res) => {
  try {
    const { status, quotation, delivery_date, vendor_id } = req.body;
    console.log('PUT /api/requests/:id', { id: req.params.id, vendor_id, status });

    if (vendor_id) {
      // Update request with new vendor
      db.run(
        'UPDATE purchase_requests SET status = ?, quotation = ?, delivery_date = ?, vendor_id = ? WHERE id = ?',
        [status || 'pending', quotation || null, delivery_date || null, vendor_id, req.params.id]
      );
      saveDatabase();

      // Notify new vendor - use vendor_id directly
      const vendor = runQuery('SELECT email, name FROM vendors WHERE id = ?', [vendor_id]);
      console.log('Vendor lookup:', vendor);
      if (vendor.length > 0) {
        // Try to find vendor user account for backward compatibility
        const vendorUser = runQuery('SELECT id FROM users WHERE email = ?', [vendor[0].email]);
        console.log('Vendor user lookup:', vendorUser);
        if (vendorUser.length > 0) {
          // Use both user_id and vendor_id for backward compatibility
          db.run(
            'INSERT INTO notifications (id, user_id, vendor_id, title, message, type) VALUES (?, ?, ?, ?, ?, ?)',
            [uuidv4(), vendorUser[0].id, vendor_id, 'New Purchase Request', `You have been assigned a new purchase request. Please log in to respond.`, 'request']
          );
        } else {
          // Use vendor_id only
          db.run(
            'INSERT INTO notifications (id, vendor_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), vendor_id, 'New Purchase Request', `You have been assigned a new purchase request. Please log in to respond.`, 'request']
          );
        }
        saveDatabase();
      }
    } else {
      db.run(
        'UPDATE purchase_requests SET status = ?, quotation = ?, delivery_date = ? WHERE id = ?',
        [status, quotation || null, delivery_date || null, req.params.id]
      );
      saveDatabase();
    }
    res.json({ message: 'Request updated successfully' });
  } catch (error) {
    console.error('Error in PUT /api/requests/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete Purchase Request
app.delete('/api/requests/:id', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'it_admin') {
      return res.status(403).json({ error: 'Access denied. Only administrators can delete purchase requests.' });
    }

    // Check if request exists
    const request = runQuery('SELECT id FROM purchase_requests WHERE id = ?', [req.params.id]);
    if (request.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Delete the request
    runInsert('DELETE FROM purchase_requests WHERE id = ?', [req.params.id]);

    res.json({ message: 'Request deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Warranty Claims
app.get('/api/warranty-claims', authMiddleware, (req, res) => {
  try {
    const claims = runQuery(`
      SELECT wc.*, d.asset_tag, d.model, v.name as vendor_name
      FROM warranty_claims wc
      JOIN devices d ON wc.device_id = d.id
      LEFT JOIN vendors v ON wc.vendor_id = v.id
      ORDER BY wc.created_at DESC
    `);
    res.json(claims);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/warranty-claims', authMiddleware, (req, res) => {
  try {
    const { device_id, vendor_id, type, description } = req.body;
    const id = uuidv4();
    const claim_number = 'WC-' + Date.now().toString(36).toUpperCase();

    runInsert(
      'INSERT INTO warranty_claims (id, device_id, vendor_id, claim_number, type, description) VALUES (?, ?, ?, ?, ?, ?)',
      [id, device_id, vendor_id, claim_number, type, description]
    );

    res.status(201).json({ message: 'Warranty claim created successfully', claim_number });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/warranty-claims/:id', authMiddleware, (req, res) => {
  try {
    const { status, resolution_notes } = req.body;
    runInsert(
      'UPDATE warranty_claims SET status = ?, resolution_notes = ? WHERE id = ?',
      [status, resolution_notes, req.params.id]
    );
    res.json({ message: 'Warranty claim updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Maintenance Records
app.get('/api/maintenance', authMiddleware, (req, res) => {
  try {
    const records = runQuery(`
      SELECT m.*, d.asset_tag, d.model
      FROM maintenance_records m
      JOIN devices d ON m.device_id = d.id
      ORDER BY m.schedule_date DESC
    `);
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/maintenance', authMiddleware, (req, res) => {
  try {
    const { device_id, schedule_date, type, description, technician } = req.body;
    const id = uuidv4();

    runInsert(
      'INSERT INTO maintenance_records (id, device_id, schedule_date, type, description, technician) VALUES (?, ?, ?, ?, ?, ?)',
      [id, device_id, schedule_date, type, description, technician]
    );

    runInsert('UPDATE devices SET status = ? WHERE id = ?', ['maintenance', device_id]);

    res.status(201).json({ message: 'Maintenance scheduled successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/maintenance/:id', authMiddleware, (req, res) => {
  try {
    const { status, completion_date, cost, notes } = req.body;

    const record = runQuery('SELECT device_id FROM maintenance_records WHERE id = ?', [req.params.id]);

    runInsert(
      'UPDATE maintenance_records SET status = ?, completion_date = ?, cost = ?, notes = ? WHERE id = ?',
      [status, completion_date, cost, notes, req.params.id]
    );

    if (status === 'completed' && record.length > 0) {
      runInsert('UPDATE devices SET status = ? WHERE id = ?', ['available', record[0].device_id]);
    }

    res.json({ message: 'Maintenance updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SLA Agreements
app.get('/api/sla', authMiddleware, (req, res) => {
  try {
    const agreements = runQuery(`
      SELECT s.*, v.name as vendor_name
      FROM sla_agreements s
      LEFT JOIN vendors v ON s.vendor_id = v.id
      ORDER BY s.created_at DESC
    `);
    res.json(agreements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sla', authMiddleware, (req, res) => {
  try {
    const { vendor_id, title, ceo_name, ceo_signature, delivery_timeline_days, warranty_months, response_time_hours, specifications, quality_standards, replacement_policy, maintenance_expectations, start_date, end_date, status } = req.body;
    const id = uuidv4();

    runInsert(
      `INSERT INTO sla_agreements (id, vendor_id, title, ceo_name, ceo_signature, delivery_timeline_days, warranty_months, response_time_hours, specifications, quality_standards, replacement_policy, maintenance_expectations, start_date, end_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, vendor_id || null, title, ceo_name, ceo_signature, delivery_timeline_days, warranty_months, response_time_hours, specifications, quality_standards, replacement_policy, maintenance_expectations, start_date, end_date, status || 'draft']
    );

    res.status(201).json({ message: 'SLA agreement created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update SLA Agreement
app.put('/api/sla/:id', authMiddleware, (req, res) => {
  try {
    const { vendor_id, title, ceo_name, ceo_signature, delivery_timeline_days, warranty_months, response_time_hours, specifications, quality_standards, replacement_policy, maintenance_expectations, start_date, end_date, status } = req.body;

    runInsert(
      `UPDATE sla_agreements SET vendor_id = ?, title = ?, ceo_name = ?, ceo_signature = ?, delivery_timeline_days = ?, warranty_months = ?, response_time_hours = ?, specifications = ?, quality_standards = ?, replacement_policy = ?, maintenance_expectations = ?, start_date = ?, end_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [vendor_id || null, title, ceo_name, ceo_signature, delivery_timeline_days, warranty_months, response_time_hours, specifications, quality_standards, replacement_policy, maintenance_expectations, start_date, end_date, status || 'draft', req.params.id]
    );

    res.json({ message: 'SLA agreement updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete SLA Agreement
app.delete('/api/sla/:id', authMiddleware, (req, res) => {
  try {
    runInsert('DELETE FROM sla_agreements WHERE id = ?', [req.params.id]);
    res.json({ message: 'SLA agreement deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Users
app.get('/api/users', authMiddleware, (req, res) => {
  try {
    const users = runQuery('SELECT id, name, email, role, department, phone, created_at FROM users ORDER BY name');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/:id', authMiddleware, (req, res) => {
  try {
    // Only it_admin can delete users
    if (req.user.role !== 'it_admin') {
      return res.status(403).json({ error: 'Access denied. Only IT Admin can delete users.' });
    }
    // Prevent deleting yourself
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    runInsert('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:id', authMiddleware, (req, res) => {
  try {
    // Only it_admin can update users
    if (req.user.role !== 'it_admin') {
      return res.status(403).json({ error: 'Access denied. Only IT Admin can update users.' });
    }
    const { name, email, role, department, phone, password } = req.body;

    if (password) {
      const hashedPassword = bcrypt.hashSync(password, 10);
      runInsert(
        'UPDATE users SET name = ?, email = ?, role = ?, department = ?, phone = ?, password = ? WHERE id = ?',
        [name, email, role, department, phone, hashedPassword, req.params.id]
      );
    } else {
      runInsert(
        'UPDATE users SET name = ?, email = ?, role = ?, department = ?, phone = ? WHERE id = ?',
        [name, email, role, department, phone, req.params.id]
      );
    }
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/employees', authMiddleware, (req, res) => {
  try {
    const users = runQuery('SELECT id, name, email, department, phone FROM users WHERE role = ? ORDER BY name', ['employee']);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reports
app.get('/api/reports/warranty-expiry', authMiddleware, (req, res) => {
  try {
    const devices = runQuery(`
      SELECT asset_tag, model, brand, warranty_expiry, julianday(warranty_expiry) - julianday('now') as days_remaining
      FROM devices
      WHERE warranty_expiry BETWEEN date('now') AND date('now', '+30 days')
      ORDER BY warranty_expiry
    `);
    res.json(devices.map(d => ({ ...d, days_remaining: Math.round(d.days_remaining) })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Warranty Details Report - All devices with warranty info
app.get('/api/reports/warranty-details', authMiddleware, (req, res) => {
  try {
    const devices = runQuery(`
      SELECT d.id, d.asset_tag, d.model, d.brand, d.serial_number, d.warranty_expiry,
             wc.claim_number, wc.status as warranty_status, wc.type as warranty_type,
             v.name as vendor_name,
             CASE WHEN d.warranty_expiry < date('now') THEN 'Expired'
                  WHEN d.warranty_expiry BETWEEN date('now') AND date('now', '+90 days') THEN 'Expiring Soon'
                  ELSE 'Active' END as warranty_status_display,
             julianday(d.warranty_expiry) - julianday('now') as days_remaining
      FROM devices d
      LEFT JOIN warranty_claims wc ON d.id = wc.device_id
      LEFT JOIN vendors v ON d.vendor_id = v.id
      ORDER BY d.warranty_expiry
    `);
    res.json(devices.map(d => ({ ...d, days_remaining: Math.round(d.days_remaining || 0) })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reports/device-condition', authMiddleware, (req, res) => {
  try {
    const stats = runQuery(`
      SELECT condition, COUNT(*) as count
      FROM devices
      GROUP BY condition
    `);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reports/vendor-performance', authMiddleware, (req, res) => {
  try {
    const vendors = runQuery(`
      SELECT name, rating, on_time_delivery, quality_score, status
      FROM vendors
      WHERE status = 'active'
    `);
    res.json(vendors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reports/device-allocation', authMiddleware, (req, res) => {
  try {
    const allocations = runQuery(`
      SELECT d.asset_tag, d.model, u.name as employee_name, u.department, da.issue_date, da.return_date
      FROM device_allocations da
      JOIN devices d ON da.device_id = d.id
      JOIN users u ON da.employee_id = u.id
      ORDER BY da.issue_date DESC
    `);
    res.json(allocations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Notifications
app.get('/api/notifications', authMiddleware, (req, res) => {
  try {
    const userRole = req.user.role;
    let notifications;

    if (userRole === 'vendor') {
      // Get vendor ID to find notifications
      const vendors = runQuery('SELECT id, email FROM vendors WHERE email = ?', [req.user.email]);
      if (vendors.length > 0) {
        const vendorId = vendors[0].id;

        // Find user ID if exists, or use vendor's user record
        const vendorUsers = runQuery('SELECT id FROM users WHERE email = ?', [vendors[0].email]);
        const targetUserId = vendorUsers.length > 0 ? vendorUsers[0].id : null;

        // Get notifications by vendor_id OR user_id (for backward compatibility)
        if (targetUserId) {
          notifications = runQuery(
            'SELECT * FROM notifications WHERE vendor_id = ? OR user_id = ? ORDER BY created_at DESC LIMIT 50',
            [vendorId, targetUserId]
          );
        } else {
          notifications = runQuery(
            'SELECT * FROM notifications WHERE vendor_id = ? ORDER BY created_at DESC LIMIT 50',
            [vendorId]
          );
        }
      } else {
        notifications = [];
      }
    } else {
      // IT Admin and Procurement see their notifications plus system-wide notifications
      notifications = runQuery(
        'SELECT * FROM notifications WHERE user_id = ? OR (user_id IS NULL AND type IN (?, ?, ?)) ORDER BY created_at DESC LIMIT 50',
        [req.user.id, 'system', 'warranty', 'allocation']
      );
    }
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/notifications/:id/read', authMiddleware, (req, res) => {
  try {
    runInsert('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/notifications/read-all', authMiddleware, (req, res) => {
  try {
    const userRole = req.user.role;
    if (userRole === 'vendor') {
      // Get vendor ID
      const vendors = runQuery('SELECT id FROM vendors WHERE email = ?', [req.user.email]);
      if (vendors.length > 0) {
        const vendorId = vendors[0].id;
        // Also get user ID for backward compatibility
        const vendorUsers = runQuery('SELECT id FROM users WHERE email = ?', [req.user.email]);
        const targetUserId = vendorUsers.length > 0 ? vendorUsers[0].id : null;

        if (targetUserId) {
          runInsert('UPDATE notifications SET is_read = 1 WHERE vendor_id = ? OR user_id = ?', [vendorId, targetUserId]);
        } else {
          runInsert('UPDATE notifications SET is_read = 1 WHERE vendor_id = ?', [vendorId]);
        }
      }
    } else {
      runInsert('UPDATE notifications SET is_read = 1 WHERE user_id = ? OR (user_id IS NULL AND type IN (?, ?, ?))', [req.user.id, 'system', 'warranty', 'allocation']);
    }
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Audit Logs
app.get('/api/audit-logs', authMiddleware, (req, res) => {
  try {
    const logs = runQuery(`
      SELECT al.*, u.name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 100
    `);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// NEW VENDOR REGISTRATION & SLA ROUTES
// ==========================================

// Get SLA Agreement (public - for vendor registration)
app.get('/api/public/sla', (req, res) => {
  try {
    // Get the latest active SLA from database
    const slaList = runQuery('SELECT * FROM sla_agreements ORDER BY created_at DESC LIMIT 1');

    if (slaList.length > 0) {
      const sla = slaList[0];
      res.json({
        id: sla.id,
        title: sla.title || 'Service Level Agreement (SLA)',
        ceo_name: sla.ceo_name || 'Dr Orlando Olumide Odejide',
        ceo_signature: sla.ceo_signature || null,
        content: `SERVICE LEVEL AGREEMENT

This Service Level Agreement ("SLA") is entered into between D03 Group of Company ("Organization") and the Vendor ("Provider").

1. DELIVERY TIMELINE
The Provider shall deliver goods within ${sla.delivery_timeline_days || 14} days from the date of purchase order.

2. WARRANTY TERMS
All equipment supplied shall carry a minimum warranty period of ${sla.warranty_months || 3} months from the date of delivery.

3. RESPONSE TIME
The Provider shall respond to any issue or complaint within ${sla.response_time_hours || 24} hours.

4. QUALITY STANDARDS
${sla.quality_standards || 'All goods supplied must meet the quality standards specified in the purchase order. Defective items will be replaced at no additional cost.'}

5. REPLACEMENT POLICY
${sla.replacement_policy || 'Defective or non-functional items will be replaced within 5 business days of reporting.'}

6. MAINTENANCE EXPECTATIONS
${sla.maintenance_expectations || 'The Provider shall provide basic maintenance support for the warranty period.'}

7. AGREEMENT ACKNOWLEDGMENT
By signing this SLA, the Provider acknowledges and agrees to all terms and conditions stated herein.`,
        delivery_timeline_days: sla.delivery_timeline_days,
        warranty_months: sla.warranty_months,
        response_time_hours: sla.response_time_hours
      });
    } else {
      // Fallback to default
      const defaultSLA = {
        id: 'default',
        title: 'Service Level Agreement (SLA)',
        ceo_name: 'Dr Orlando Olumide Odejide',
        ceo_signature: null,
        content: `SERVICE LEVEL AGREEMENT

This Service Level Agreement ("SLA") is entered into between D03 Group of Company ("Organization") and the Vendor ("Provider").

1. DELIVERY TIMELINE
The Provider shall deliver goods within 14 days from the date of purchase order.

2. WARRANTY TERMS
All equipment supplied shall carry a minimum warranty period of 3 months from the date of delivery.

3. RESPONSE TIME
The Provider shall respond to any issue or complaint within 24 hours.

4. QUALITY STANDARDS
All goods supplied must meet the quality standards specified in the purchase order.

5. REPLACEMENT POLICY
Defective items will be replaced within 5 business days.

6. MAINTENANCE EXPECTATIONS
Basic maintenance support for the warranty period.

7. AGREEMENT ACKNOWLEDGMENT
By signing this SLA, the Provider acknowledges and agrees to all terms and conditions.`,
        delivery_timeline_days: 14,
        warranty_months: 3,
        response_time_hours: 24
      };
      res.json(defaultSLA);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit SLA Agreement (vendor agrees/disagrees/requests modify)
app.post('/api/vendor/sla-response', async (req, res) => {
  try {
    const { vendor_id, signature_data, response, signature_name } = req.body;

    if (response === 'agreed') {
      // Check if vendor exists
      const existingVendor = runQuery('SELECT * FROM vendors WHERE id = ?', [vendor_id]);
      if (existingVendor.length > 0) {
        runInsert('UPDATE vendors SET status = ? WHERE id = ?', ['pending_registration', vendor_id]);
      }

      // Create SLA agreement record
      const id = uuidv4();
      runInsert(
        `INSERT INTO sla_agreements (id, vendor_id, title, content, signature_name, signature_data, signature_status, sla_response_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, vendor_id, 'Service Level Agreement', 'SLA Content', signature_name || 'DR Orlando Olumide Odejide', signature_data, 'agreed', new Date().toISOString(), 'active']
      );
    } else if (response === 'disagreed') {
      runInsert('UPDATE vendors SET status = ? WHERE id = ?', ['rejected', vendor_id]);
      runInsert(
        `INSERT INTO sla_agreements (id, vendor_id, title, signature_name, signature_status, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), vendor_id, 'Service Level Agreement', signature_name || 'DR Orlando Olumide Odejide', 'disagreed', 'draft']
      );
    } else if (response === 'request_modify') {
      runInsert(
        `INSERT INTO sla_agreements (id, vendor_id, title, signature_name, signature_status, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), vendor_id, 'Service Level Agreement', signature_name || 'DR Orlando Olumide Odejide', 'request_modify', 'draft']
      );
    }

    res.json({ message: 'SLA response submitted successfully', status: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Register Vendor (after SLA agreement)
app.post('/api/vendor/register', async (req, res) => {
  try {
    const { name, email, phone, company_location, address, products, sla_agreement_id } = req.body;

    const vendorId = uuidv4();
    const userId = uuidv4();

    // Create vendor record
    runInsert(
      'INSERT INTO vendors (id, name, email, phone, company_location, address, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [vendorId, name, email, phone, company_location, address, 'pending_registration']
    );

    // Create user account for vendor (without password - will be set via email)
    runInsert(
      'INSERT INTO users (id, name, email, password, role, vendor_id) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, name, email, 'PENDING_RESET', 'vendor', vendorId]
    );

    // Insert products
    if (products && products.length > 0) {
      products.forEach(product => {
        runInsert(
          'INSERT INTO vendor_products (id, vendor_id, product_name, category, description) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), vendorId, product.name, product.category, product.description]
        );
      });
    }

    // Update SLA agreement
    if (sla_agreement_id) {
      runInsert('UPDATE sla_agreements SET vendor_id = ? WHERE id = ?', [vendorId, sla_agreement_id]);
    }

    // Generate password reset token and send email
    const token = uuidv4();
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);

    runInsert(
      'INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)',
      [email, token, expires.toISOString()]
    );

    // Create notification for admin
    runInsert(
      'INSERT INTO notifications (id, title, message, type) VALUES (?, ?, ?, ?)',
      [uuidv4(), 'New Vendor Registration', `New vendor "${name}" has registered and awaiting approval.`, 'general']
    );

    // Send password setup email
    await sendPasswordSetupEmail(email, name, token);

    res.status(201).json({
      message: 'Vendor registered successfully. Please check your email to set your password.',
      vendor_id: vendorId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Request Password Reset (send email)
app.post('/api/auth/forgot-password', (req, res) => {
  try {
    const { email } = req.body;

    // Check if user/vendor exists
    const users = runQuery('SELECT * FROM users WHERE email = ?', [email]);
    const vendors = runQuery('SELECT * FROM vendors WHERE email = ?', [email]);

    if (users.length === 0 && vendors.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    // Generate reset token
    const token = uuidv4();
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);

    runInsert(
      'INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)',
      [email, token, expires.toISOString()]
    );

    // In production, send email here
    // For now, return the token (in production, you'd send via email)
    res.json({ message: 'Password reset link sent to your email', reset_token: token });
  } catch (error) {
    res.status(500).json({ error: error.message.message });
  }
});

// Reset Password with Token
app.post('/api/auth/reset-password', (req, res) => {
  try {
    const { token, password } = req.body;

    const resets = runQuery('SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expires_at > datetime("now")', [token]);

    if (resets.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const email = resets[0].email;
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Update user password
    runInsert('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email]);

    // Update vendor status to active if this is a vendor
    runInsert('UPDATE vendors SET status = ? WHERE email = ?', ['active', email]);

    // Mark token as used
    runInsert('UPDATE password_resets SET used = 1 WHERE token = ?', [token]);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// VENDOR DASHBOARD ROUTES
// ==========================================

// Get Vendor's Pending Requests
app.get('/api/vendor/requests', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const vendors = runQuery('SELECT id FROM vendors WHERE email = ?', [req.user.email]);
    if (vendors.length === 0) {
      return res.status(404).json({ error: 'Vendor profile not found' });
    }

    const vendorId = vendors[0].id;
    const requests = runQuery(`
      SELECT pr.*, u.name as requested_by_name,
        (SELECT COUNT(*) FROM devices d WHERE d.request_id = pr.id) as devices_submitted
      FROM purchase_requests pr
      LEFT JOIN users u ON pr.requested_by = u.id
      WHERE pr.vendor_id = ?
      ORDER BY pr.created_at DESC
    `, [vendorId]);

    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Accept or Reject Request
app.put('/api/vendor/requests/:id/respond', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { response, vendor_notes } = req.body;

    if (response === 'accepted') {
      runInsert(
        'UPDATE purchase_requests SET status = ?, vendor_response = ? WHERE id = ?',
        ['accepted', vendor_notes, req.params.id]
      );

      // Notify procurement
      const request = runQuery('SELECT requested_by FROM purchase_requests WHERE id = ?', [req.params.id]);
      if (request.length > 0) {
        runInsert(
          'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), request[0].requested_by, 'Request Accepted', 'A vendor has accepted your purchase request', 'response']
        );
      }
    } else if (response === 'rejected') {
      runInsert(
        'UPDATE purchase_requests SET status = ?, vendor_response = ? WHERE id = ?',
        ['rejected', vendor_notes, req.params.id]
      );

      // Notify procurement and admins
      const admins = runQuery("SELECT id FROM users WHERE role IN ('it_admin', 'procurement')");
      admins.forEach(admin => {
        runInsert(
          'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), admin.id, 'Request Rejected', `Vendor rejected purchase request. Reason: ${vendor_notes || 'No reason provided'}`, 'response']
        );
      });
    }

    res.json({ message: 'Response submitted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit Device Details (after accepting request)
app.post('/api/vendor/devices', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { request_id, serial_number, model, brand, ram_gb, storage_gb, processor, condition, expected_delivery_date, device_images } = req.body;

    // Verify the request is assigned to this vendor before allowing device submission
    const requestCheck = runQuery('SELECT status, vendor_id, quantity FROM purchase_requests WHERE id = ?', [request_id]);
    if (requestCheck.length === 0) {
      return res.status(404).json({ error: 'Purchase request not found' });
    }

    // Get vendor ID
    const vendors = runQuery('SELECT id FROM vendors WHERE email = ?', [req.user.email]);
    if (vendors.length === 0) {
      return res.status(404).json({ error: 'Vendor profile not found' });
    }
    const vendorId = vendors[0].id;

    // Check if this vendor is assigned to the request
    if (requestCheck[0].vendor_id !== vendorId) {
      return res.status(403).json({ error: 'This request is not assigned to you.' });
    }

    // If request is already accepted or pending, allow submission
    if (requestCheck[0].status === 'rejected' || requestCheck[0].status === 'cancelled') {
      return res.status(400).json({ error: 'This request has been cancelled or rejected and cannot accept device submissions.' });
    }

    // Check how many devices have already been submitted for this request
    const devicesSubmitted = runQuery('SELECT COUNT(*) as count FROM devices WHERE request_id = ?', [request_id]);
    const submittedCount = devicesSubmitted[0]?.count || 0;
    const requestedQuantity = requestCheck[0].quantity || 1;

    // Check if vendor has already submitted all requested devices
    if (submittedCount >= requestedQuantity) {
      return res.status(400).json({ error: `All ${requestedQuantity} devices for this request have already been submitted.` });
    }

    const id = uuidv4();
    const asset_tag = generateAssetTag(model, brand);

    const warranty_expiry = new Date();
    warranty_expiry.setMonth(warranty_expiry.getMonth() + 12);

    const qrData = JSON.stringify({ asset_tag, serial_number, model });
    const qr_code = QRCode.toDataURLSync ? QRCode.toDataURLSync(qrData) : null;

    runInsert(
      `INSERT INTO devices (id, request_id, vendor_id, asset_tag, serial_number, model, brand, ram_gb, storage_gb, processor, condition, status, expected_delivery_date, warranty_expiry, qr_code, device_images)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, request_id, vendorId, asset_tag, serial_number, model, brand, ram_gb, storage_gb, processor, condition, 'pending_delivery_confirm', expected_delivery_date, warranty_expiry.toISOString().split('T')[0], qr_code, device_images || null]
    );

    // Create warranty claim automatically
    const warrantyClaimId = uuidv4();
    const claimNumber = 'WC-' + Date.now().toString(36).toUpperCase();
    runInsert(
      'INSERT INTO warranty_claims (id, device_id, vendor_id, claim_number, type, description, status, warranty_start_date, warranty_expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [warrantyClaimId, id, vendorId, claimNumber, 'auto', 'Auto-created warranty claim for delivered device', 'active', expected_delivery_date || new Date().toISOString().split('T')[0], warranty_expiry.toISOString().split('T')[0]]
    );

    // Notify procurement and admins about new warranty
    const admins = runQuery("SELECT id FROM users WHERE role IN ('it_admin', 'procurement')");
    admins.forEach(admin => {
      runInsert(
        'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), admin.id, 'Device Delivered - Warranty Created', `A new device (${asset_tag} - ${model}) has been delivered and warranty claim ${claimNumber} has been created. Warranty expires on ${warranty_expiry.toISOString().split('T')[0]}`, 'warranty']
      );
    });

    // Update request status
    runInsert('UPDATE purchase_requests SET status = ? WHERE id = ?', ['delivered', request_id]);

    res.status(201).json({ message: 'Device details submitted successfully', asset_tag, warranty_claim: claimNumber });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Vendor's Devices
app.get('/api/vendor/devices', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const vendors = runQuery('SELECT id FROM vendors WHERE email = ?', [req.user.email]);
    if (vendors.length === 0) {
      return res.status(404).json({ error: 'Vendor profile not found' });
    }

    const devices = runQuery(
      'SELECT * FROM devices WHERE vendor_id = ? ORDER BY created_at DESC',
      [vendors[0].id]
    );

    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// PROCUREMENT REQUEST ROUTES
// ==========================================

// Create Purchase Request (simplified - fields optional)
app.post('/api/procurement/requests', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'procurement' && req.user.role !== 'it_admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { vendor_id, product_name, specifications, ram_specs, processor_specs, quantity, notes } = req.body;
    const id = uuidv4();
    const request_number = 'PR-' + Date.now().toString(36).toUpperCase();

    runInsert(
      `INSERT INTO purchase_requests (id, request_number, vendor_id, requested_by, product_name, specifications, ram_specs, processor_specs, quantity, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, request_number, vendor_id, req.user.id, product_name, specifications, ram_specs, processor_specs, quantity, notes, 'pending']
    );

    // Notify vendor
    const vendor = runQuery('SELECT email, name FROM vendors WHERE id = ?', [vendor_id]);
    if (vendor.length > 0) {
      // Create notification with vendor_id
      runInsert(
        'INSERT INTO notifications (id, vendor_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), vendor_id, 'New Purchase Request', `You have a new purchase request for ${product_name || 'equipment'}. Please log in to respond.`, 'request']
      );
      // Also try to find vendor user account and notify them
      const vendorUsers = runQuery('SELECT id FROM users WHERE email = ?', [vendor[0].email]);
      if (vendorUsers.length > 0) {
        runInsert(
          'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), vendorUsers[0].id, 'New Purchase Request', `You have a new purchase request for ${product_name || 'equipment'}. Please log in to respond.`, 'request']
        );
      }
    }

    res.status(201).json({ message: 'Request created successfully', request_number });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get All Requests (for procurement/admin)
app.get('/api/procurement/requests', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'procurement' && req.user.role !== 'it_admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const requests = runQuery(`
      SELECT pr.*, v.name as vendor_name, v.email as vendor_email, u.name as requested_by_name,
        (SELECT COUNT(*) FROM devices d WHERE d.request_id = pr.id) as devices_submitted
      FROM purchase_requests pr
      LEFT JOIN vendors v ON pr.vendor_id = v.id
      LEFT JOIN users u ON pr.requested_by = u.id
      ORDER BY pr.created_at DESC
    `);

    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// EMPLOYEE ALLOCATION ROUTES
// ==========================================

// Allocate Device to Employee
app.post('/api/procurement/allocations', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'procurement' && req.user.role !== 'it_admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { device_id, employee_name, employee_email, employee_id, department, job_title, work_email, issue_date, issue_condition } = req.body;

    // Do NOT create employee user in users table - store employee info directly in allocation
    // Use UUID as employee_id to identify the employee for reporting purposes
    const employeeUserId = uuidv4();

    // Get device info for email
    const deviceResult = runQuery('SELECT asset_tag, model, brand, serial_number, processor, ram_gb, storage_gb FROM devices WHERE id = ?', [device_id]);
    const device = deviceResult && deviceResult.length > 0 ? deviceResult[0] : null;

    if (!device) {
      console.log('Device not found for allocation:', device_id);
      return res.status(400).json({ error: 'Device not found' });
    }

    console.log('Creating allocation for device:', device.asset_tag, 'to employee:', work_email);

    // Generate report token for employee
    const reportToken = uuidv4();

    // Create allocation
    const allocationId = uuidv4();
    runInsert(
      'INSERT INTO device_allocations (id, device_id, employee_id, employee_name, employee_email, work_email, department, job_title, assigned_by, issue_date, issue_condition, status, report_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [allocationId, device_id, employeeUserId, employee_name, work_email, work_email, department, job_title, req.user.id, issue_date || new Date().toISOString().split('T')[0], issue_condition || 'new', 'active', reportToken]
    );

    const reportUrl = `http://localhost:5173/report-issue?token=${reportToken}&device_id=${device_id}&email=${encodeURIComponent(work_email)}`;

    // Update device status
    runInsert('UPDATE devices SET status = ? WHERE id = ?', ['allocated', device_id]);

    // Notify employee via email - include device details and report link
    runInsert(
      'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), employeeUserId, 'Device Assigned', `A device (${device?.asset_tag} - ${device?.model}) has been assigned to you. Serial: ${device?.serial_number}, Brand: ${device?.brand}, Processor: ${device?.processor}`, 'allocation']
    );

    // Send email notification to employee
    console.log('Sending allocation email to:', work_email, 'name:', employee_name);
    try {
      const emailResult = await sendDeviceAllocationEmail(work_email, employee_name, device, reportUrl);
      console.log('Email send result:', emailResult);
    } catch (emailErr) {
      console.error('Email sending failed:', emailErr.message);
      console.log('DEV: Manual report link:', reportUrl);
    }

    res.status(201).json({ message: 'Device allocated successfully', allocation_id: allocationId, report_url: reportUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// EMPLOYEE ISSUE REPORTING ROUTES
// ==========================================

// Employee Report Issue
app.post('/api/employee/reports', authMiddleware, (req, res) => {
  try {
    const { device_id, report_type, description } = req.body;

    const id = uuidv4();
    runInsert(
      'INSERT INTO employee_reports (id, device_id, employee_id, report_type, description, status) VALUES (?, ?, ?, ?, ?, ?)',
      [id, device_id, req.user.id, report_type, description, 'pending']
    );

    // Notify procurement
    const procurementUsers = runQuery("SELECT id FROM users WHERE role = 'procurement'");
    procurementUsers.forEach(user => {
      runInsert(
        'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), user.id, 'New Device Issue Report', `An employee has reported an issue with a device. Please review.`, 'report']
      );
    });

    res.status(201).json({ message: 'Report submitted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Employee's Reports
app.get('/api/employee/reports', authMiddleware, (req, res) => {
  try {
    const reports = runQuery(`
      SELECT er.*, d.asset_tag, d.model, d.brand
      FROM employee_reports er
      JOIN devices d ON er.device_id = d.id
      WHERE er.employee_id = ?
      ORDER BY er.created_at DESC
    `, [req.user.id]);

    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get All Reports (for procurement)
app.get('/api/procurement/reports', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'procurement' && req.user.role !== 'it_admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Don't join with users table - employee_id may be UUID now
    const reports = runQuery(`
      SELECT er.*, d.asset_tag, d.model, d.brand, d.serial_number,
             da.employee_name, da.employee_email, da.work_email
      FROM employee_reports er
      JOIN devices d ON er.device_id = d.id
      LEFT JOIN device_allocations da ON er.device_id = da.device_id AND da.status = 'active'
      ORDER BY er.created_at DESC
    `);

    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Employee Report (IT Admin only)
app.delete('/api/procurement/reports/:id', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'it_admin') {
      return res.status(403).json({ error: 'Access denied. Only IT Admin can delete reports.' });
    }

    // Check if report exists
    const report = runQuery('SELECT id FROM employee_reports WHERE id = ?', [req.params.id]);
    if (report.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    runInsert('DELETE FROM employee_reports WHERE id = ?', [req.params.id]);
    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resolve Report (send to vendor or internal)
app.put('/api/procurement/reports/:id/resolve', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'procurement' && req.user.role !== 'it_admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { resolution, resolution_notes, vendor_id } = req.body;

    if (resolution === 'send_to_vendor') {
      // Update report status
      runInsert(
        'UPDATE employee_reports SET status = ?, resolution_notes = ?, resolution_date = datetime("now"), vendor_id = ? WHERE id = ?',
        ['sent_to_vendor', resolution_notes, vendor_id, req.params.id]
      );

      // Get report and device details for notification
      const report = runQuery(`
        SELECT er.*, d.asset_tag, d.model, d.serial_number, d.brand
        FROM employee_reports er
        JOIN devices d ON er.device_id = d.id
        WHERE er.id = ?
      `, [req.params.id]);

      if (report.length > 0 && vendor_id) {
        const vendor = runQuery('SELECT email, name FROM vendors WHERE id = ?', [vendor_id]);
        if (vendor.length > 0) {
          // Create vendor user notification (using vendor email to find user)
          const vendorUsers = runQuery('SELECT id FROM users WHERE email = ?', [vendor[0].email]);
          if (vendorUsers.length > 0) {
            runInsert(
              'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
              [uuidv4(), vendorUsers[0].id, 'Device Issue - Action Required',
                `Device ${report[0].asset_tag} - ${report[0].model} (Serial: ${report[0].serial_number}) has an issue reported: ${report[0].description}. Please review and resolve.`, 'vendor_issue']
            );
          }
        }
      }
    } else if (resolution === 'resolved_internal') {
      runInsert(
        'UPDATE employee_reports SET status = ?, resolution_notes = ?, resolution_date = datetime("now") WHERE id = ?',
        ['resolved_internal', resolution_notes, req.params.id]
      );
    } else if (resolution === 'resolution_rejected') {
      // Procurement rejected vendor's resolution - send back to vendor
      runInsert(
        'UPDATE employee_reports SET status = ?, resolution_notes = ?, resolution_date = datetime("now") WHERE id = ?',
        ['repair_rejected', resolution_notes, req.params.id]
      );

      // Get report details for notification
      const report = runQuery(`
        SELECT er.*, d.asset_tag, d.model, d.serial_number, d.brand, er.vendor_id
        FROM employee_reports er
        JOIN devices d ON er.device_id = d.id
        WHERE er.id = ?
      `, [req.params.id]);

      // Notify vendor about rejection
      if (report.length > 0 && report[0].vendor_id) {
        const vendor = runQuery('SELECT email, name FROM vendors WHERE id = ?', [report[0].vendor_id]);
        if (vendor.length > 0) {
          const vendorUsers = runQuery('SELECT id FROM users WHERE email = ?', [vendor[0].email]);
          if (vendorUsers.length > 0) {
            runInsert(
              'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
              [uuidv4(), vendorUsers[0].id, 'Resolution Rejected - Action Required',
                `Your resolution for device ${report[0].asset_tag} - ${report[0].model} has been rejected by procurement. Reason: ${resolution_notes}. Please review and resubmit.`, 'vendor_issue']
            );
          }
        }
      }
    }

    res.json({ message: 'Report resolved successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Vendor: Mark repair as complete
app.put('/api/vendor/reports/:id/repair-complete', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get vendor ID
    const vendors = runQuery('SELECT id FROM vendors WHERE email = ?', [req.user.email]);
    if (vendors.length === 0) {
      return res.status(404).json({ error: 'Vendor profile not found' });
    }
    const vendorId = vendors[0].id;

    // Check if report belongs to this vendor
    const report = runQuery('SELECT * FROM employee_reports WHERE id = ? AND vendor_id = ?', [req.params.id, vendorId]);
    if (report.length === 0) {
      return res.status(404).json({ error: 'Report not found or not assigned to you' });
    }

    // Update status to repair_pending_confirmation (requires procurement confirmation)
    runInsert(
      'UPDATE employee_reports SET status = ?, repair_completed = datetime("now") WHERE id = ?',
      ['repair_pending_confirmation', req.params.id]
    );

    // Notify procurement
    const admins = runQuery("SELECT id FROM users WHERE role IN ('it_admin', 'procurement')");
    admins.forEach(admin => {
      runInsert(
        'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), admin.id, 'Repair Completed - Confirmation Required', `Vendor has completed repairs for device report ${req.params.id}. Please confirm before clearing the issue.`, 'report']
      );
    });

    res.json({ message: 'Repair marked as complete. Waiting for procurement confirmation.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Procurement/Admin: Mark device as returned to company/employee
app.put('/api/procurement/reports/:id/return', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'procurement' && req.user.role !== 'it_admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { return_notes } = req.body;

    // Get report details first to update device status
    const report = runQuery(`
      SELECT er.*, da.employee_email, da.employee_name, d.asset_tag, d.model
      FROM employee_reports er
      JOIN devices d ON er.device_id = d.id
      LEFT JOIN device_allocations da ON er.device_id = da.device_id AND da.status = 'active'
      WHERE er.id = ?
    `, [req.params.id]);

    // Update status to returned
    runInsert(
      'UPDATE employee_reports SET status = ?, resolution_notes = ?, returned_to_company = datetime("now") WHERE id = ?',
      ['returned', return_notes || 'Device returned to employee', req.params.id]
    );

    // Update device status back to allocated (if it was allocated) or available
    if (report.length > 0) {
      const deviceId = report[0].device_id;
      // Check if there's an active allocation
      const allocation = runQuery('SELECT id FROM device_allocations WHERE device_id = ? AND status = ?', [deviceId, 'active']);
      if (allocation.length > 0) {
        // Device is still allocated to an employee - set to allocated
        runInsert('UPDATE devices SET status = ? WHERE id = ?', ['allocated', deviceId]);
      } else {
        // No active allocation - set to available
        runInsert('UPDATE devices SET status = ? WHERE id = ?', ['available', deviceId]);
      }
    }

    if (report.length > 0 && report[0].employee_email) {
      // Notify employee
      runInsert(
        'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), report[0].employee_id, 'Device Returned', `Your device (${report[0].asset_tag} - ${report[0].model}) has been repaired and returned to you.`, 'allocation']
      );
    }

    res.json({ message: 'Device marked as returned to employee' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Procurement/Admin: Confirm issue resolution (after vendor completes repair)
app.put('/api/procurement/reports/:id/confirm-resolution', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'procurement' && req.user.role !== 'it_admin') {
      return res.status(403).json({ error: 'Access denied. Only procurement or IT admin can confirm issue resolution.' });
    }

    const { return_notes } = req.body;

    // Get current report status
    const report = runQuery('SELECT status, device_id FROM employee_reports WHERE id = ?', [req.params.id]);
    if (report.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    console.log('Confirm resolution - Report ID:', req.params.id, 'Current status:', report[0].status);

    // Only allow confirming repair_pending_confirmation status
    if (report[0].status !== 'repair_pending_confirmation') {
      return res.status(400).json({ error: 'This report is not pending confirmation. Current status: ' + report[0].status });
    }

    // Get report details
    const reportDetails = runQuery(`
      SELECT er.*, da.employee_email, da.employee_name, da.id as allocation_id, d.asset_tag, d.model
      FROM employee_reports er
      JOIN devices d ON er.device_id = d.id
      LEFT JOIN device_allocations da ON er.device_id = da.device_id AND da.status = 'active'
      WHERE er.id = ?
    `, [req.params.id]);

    // Generate confirmation token for employee
    const confirmToken = uuidv4();

    // Update status to awaiting_employee_confirmation
    runInsert(
      'UPDATE employee_reports SET status = ?, resolution_notes = ?, returned_to_company = datetime("now") WHERE id = ?',
      ['awaiting_employee_confirmation', return_notes || 'Awaiting employee to confirm device condition', req.params.id]
    );

    // Generate confirmation URL for employee
    const confirmUrl = `http://localhost:5173/confirm-device?report_id=${req.params.id}&token=${confirmToken}&device_id=${reportDetails[0].device_id}`;

    // Store confirmation token
    runInsert('UPDATE employee_reports SET report_token = ? WHERE id = ?', [confirmToken, req.params.id]);

    // Notify vendor that issue is confirmed (awaiting employee)
    if (reportDetails.length > 0 && reportDetails[0].vendor_id) {
      const vendor = runQuery('SELECT email, name FROM vendors WHERE id = ?', [reportDetails[0].vendor_id]);
      if (vendor.length > 0) {
        const vendorUsers = runQuery('SELECT id FROM users WHERE email = ?', [vendor[0].email]);
        if (vendorUsers.length > 0) {
          runInsert(
            'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), vendorUsers[0].id, 'Issue Confirmed - Awaiting Employee', `The issue for device ${reportDetails[0].asset_tag} has been confirmed by procurement. Awaiting employee confirmation.`, 'report']
          );
        }
      }
    }

    // Notify employee to confirm device condition
    if (reportDetails.length > 0 && reportDetails[0].employee_email) {
      // Try to send email
      const mailOptions = {
        from: '"D03 AMS System" <admin.sla@trainingheights.com>',
        to: reportDetails[0].employee_email,
        subject: 'Please Confirm Device Condition - D03 AMS',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Device Repaired - Please Confirm Condition</h2>
            <p>Dear ${reportDetails[0].employee_name || 'Employee'},</p>
            <p>Your device has been repaired and confirmed by procurement. Please verify and confirm the condition of your device.</p>
            <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p><strong>Asset Tag:</strong> ${reportDetails[0].asset_tag}</p>
              <p><strong>Model:</strong> ${reportDetails[0].model}</p>
              <p><strong>Resolution Notes:</strong> ${return_notes || 'Device has been repaired'}</p>
            </div>
            <p><a href="${confirmUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Confirm Device Condition</a></p>
            <p>Or copy and paste this link: ${confirmUrl}</p>
            <p>This link will expire in 7 days.</p>
            <p style="margin-top: 20px; color: #6b7280; font-size: 12px;">
              Best regards,<br/>
              D03 AMS Administration
            </p>
          </div>
        `
      };

      try {
        trySendEmail(mailOptions);
        console.log('Device confirmation email sent to:', reportDetails[0].employee_email);
      } catch (emailErr) {
        console.log('Error sending confirmation email:', emailErr.message);
        console.log('DEV: Device confirmation link:', confirmUrl);
      }

      runInsert(
        'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), reportDetails[0].employee_id, 'Confirm Device Condition', `Your device (${reportDetails[0].asset_tag} - ${reportDetails[0].model}) has been repaired. Please confirm its condition.`, 'allocation']
      );
    }

    res.json({ message: 'Issue resolution confirmed. Awaiting employee to confirm device condition.', confirm_url: confirmUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Employee confirms device condition (via email link or logged in)
app.put('/api/employee/reports/:id/confirm-condition', authMiddleware, (req, res) => {
  try {
    const { condition_confirmed, condition_notes } = req.body;

    // Get report details
    const report = runQuery(`
      SELECT er.*, da.id as allocation_id, da.employee_name, d.asset_tag, d.model
      FROM employee_reports er
      JOIN devices d ON er.device_id = d.id
      LEFT JOIN device_allocations da ON er.device_id = da.device_id AND da.status = 'active'
      WHERE er.id = ? AND er.employee_id = ?
    `, [req.params.id, req.user.id]);

    if (report.length === 0) {
      return res.status(404).json({ error: 'Report not found or you are not authorized to confirm this report' });
    }

    // Only allow confirming awaiting_employee_confirmation status
    if (report[0].status !== 'awaiting_employee_confirmation') {
      return res.status(400).json({ error: 'This report is not awaiting your confirmation' });
    }

    // Update status to returned (fully resolved)
    runInsert(
      'UPDATE employee_reports SET status = ?, resolution_notes = ?, resolution_date = datetime("now") WHERE id = ?',
      ['returned', condition_notes || 'Employee confirmed device condition', req.params.id]
    );

    // Update device status back to allocated
    if (report.length > 0) {
      const deviceId = report[0].device_id;
      runInsert('UPDATE devices SET status = ? WHERE id = ?', ['allocated', deviceId]);

      // Update allocation with repair information
      if (report[0].allocation_id) {
        runInsert(
          'UPDATE device_allocations SET return_condition = ?, return_date = datetime("now"), issue_report = ? WHERE id = ?',
          [condition_confirmed ? 'good' : 'needs_review', condition_notes || 'Employee confirmed device condition', report[0].allocation_id]
        );
      }
    }

    // Notify procurement that employee confirmed
    const admins = runQuery("SELECT id FROM users WHERE role IN ('it_admin', 'procurement')");
    admins.forEach(admin => {
      runInsert(
        'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), admin.id, 'Employee Confirmed Device', `Employee has confirmed the condition of device ${report[0].asset_tag}. Status: ${condition_confirmed ? 'Good' : 'Needs Review'}`, 'allocation']
      );
    });

    res.json({ message: 'Device condition confirmed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// PUBLIC EMPLOYEE REPORTING (via email link)
// ==========================================

// Verify token exists (without email check - for initial verification)
app.get('/api/public/verify-token', (req, res) => {
  try {
    const { token, email, device_id } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Find allocation with this token - join with devices but NOT users (employee_id may be UUID)
    const allocation = runQuery(`
      SELECT da.*, d.asset_tag, d.model, d.brand, d.serial_number, d.processor, d.ram_gb, d.storage_gb
      FROM device_allocations da
      JOIN devices d ON da.device_id = d.id
      WHERE da.report_token = ? AND da.status = 'active'
    `, [token]);

    if (allocation.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired verification link' });
    }

    const alloc = allocation[0];

    // If email provided, verify it matches (case insensitive)
    if (email && alloc.work_email && alloc.work_email.toLowerCase() !== email?.toLowerCase()) {
      return res.status(403).json({ error: 'Email does not match the allocation' });
    }

    // If device_id provided, verify it matches
    if (device_id && alloc.device_id !== device_id) {
      return res.status(403).json({ error: 'Device ID does not match' });
    }

    res.json({
      valid: true,
      allocation: alloc
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit report without auth (via email link)
app.post('/api/public/report', (req, res) => {
  try {
    const { token, email, device_id, issue_condition, report_type, description } = req.body;

    if (!token || !email) {
      return res.status(400).json({ error: 'Token and email are required' });
    }

    // Find allocation with this token - don't join with users table (employee_id may be UUID)
    const allocation = runQuery(`
      SELECT da.*, d.asset_tag, d.model, d.serial_number
      FROM device_allocations da
      JOIN devices d ON da.device_id = d.id
      WHERE da.report_token = ? AND da.status = 'active'
    `, [token]);

    if (allocation.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired verification link' });
    }

    const alloc = allocation[0];

    // Verify the email matches - check both work_email and employee_email fields
    const allocEmail = (alloc.work_email || alloc.employee_email || '').toLowerCase();
    if (allocEmail !== email?.toLowerCase()) {
      return res.status(403).json({ error: 'Email does not match the allocation' });
    }

    // Verify device_id matches if provided
    if (device_id && alloc.device_id !== device_id) {
      return res.status(403).json({ error: 'Device ID does not match' });
    }

    // Update allocation with issue condition and mark as confirmed
    runInsert(
      'UPDATE device_allocations SET issue_condition = ?, report_submitted_at = datetime("now"), issue_report = ? WHERE id = ?',
      [issue_condition || alloc.issue_condition, description || '', alloc.id]
    );

    // If there's a report type and description, create an employee report
    if (report_type && description) {
      const id = uuidv4();
      runInsert(
        'INSERT INTO employee_reports (id, device_id, employee_id, report_type, description, status) VALUES (?, ?, ?, ?, ?, ?)',
        [id, alloc.device_id, alloc.employee_id, report_type, description, 'pending']
      );

      // Notify procurement
      const procurementUsers = runQuery("SELECT id FROM users WHERE role = 'procurement'");
      procurementUsers.forEach(user => {
        runInsert(
          'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), user.id, 'New Device Issue Report', `An employee has reported an issue with device ${alloc.asset_tag}. Please review.`, 'report']
        );
      });
    }

    res.status(201).json({ message: 'Device verification and report submitted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// VENDOR PRODUCTS ROUTES
// ==========================================

app.get('/api/vendor-products', authMiddleware, (req, res) => {
  try {
    const products = runQuery('SELECT * FROM vendor_products ORDER BY created_at DESC');
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/vendors/:id/products', authMiddleware, (req, res) => {
  try {
    const products = runQuery('SELECT * FROM vendor_products WHERE vendor_id = ?', [req.params.id]);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// VENDOR STATS FOR DASHBOARD
// ==========================================

app.get('/api/vendor/dashboard/stats', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const vendors = runQuery('SELECT id FROM vendors WHERE email = ?', [req.user.email]);
    if (vendors.length === 0) {
      return res.status(404).json({ error: 'Vendor profile not found' });
    }

    const vendorId = vendors[0].id;

    const pendingRequests = runQuery('SELECT COUNT(*) as count FROM purchase_requests WHERE vendor_id = ? AND status = ?', [vendorId, 'pending'])[0]?.count || 0;
    const acceptedRequests = runQuery('SELECT COUNT(*) as count FROM purchase_requests WHERE vendor_id = ? AND status = ?', [vendorId, 'accepted'])[0]?.count || 0;
    const deliveredDevices = runQuery('SELECT COUNT(*) as count FROM devices WHERE vendor_id = ? AND status = ?', [vendorId, 'delivered'])[0]?.count || 0;

    res.json({
      pendingRequests,
      acceptedRequests,
      deliveredDevices
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get issues sent to vendor
app.get('/api/vendor/issues', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const vendors = runQuery('SELECT id FROM vendors WHERE email = ?', [req.user.email]);
    if (vendors.length === 0) {
      return res.status(404).json({ error: 'Vendor profile not found' });
    }

    const vendorId = vendors[0].id;

    const issues = runQuery(`
      SELECT er.*, d.asset_tag, d.model, d.serial_number, d.brand, d.condition as device_condition
      FROM employee_reports er
      JOIN devices d ON er.device_id = d.id
      WHERE er.vendor_id = ? AND er.status IN ('sent_to_vendor', 'under_repair', 'repair_pending', 'repair_completed', 'repair_pending_confirmation', 'repair_rejected')
      ORDER BY er.created_at DESC
    `, [vendorId]);

    res.json(issues);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Vendor resolve issue
app.put('/api/vendor/issues/:id/resolve', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { resolution_notes, expected_return_date, resolution_status } = req.body;

    // Get vendor ID
    const vendors = runQuery('SELECT id FROM vendors WHERE email = ?', [req.user.email]);
    if (vendors.length === 0) {
      return res.status(404).json({ error: 'Vendor profile not found' });
    }
    const vendorId = vendors[0].id;

    // Check if report belongs to this vendor
    const report = runQuery('SELECT * FROM employee_reports WHERE id = ? AND vendor_id = ?', [req.params.id, vendorId]);
    if (report.length === 0) {
      return res.status(404).json({ error: 'Report not found or not assigned to you' });
    }

    // If vendor marks as resolved, set to repair_pending_confirmation (requires procurement approval)
    // NOT resolved_vendor - procurement must verify first
    let newStatus = resolution_status;
    if (resolution_status === 'resolved_vendor') {
      newStatus = 'repair_pending_confirmation';
    }

    // Update the report with status and notes
    runInsert(
      'UPDATE employee_reports SET status = ?, resolution_notes = ?, resolution_date = datetime("now") WHERE id = ?',
      [newStatus, resolution_notes || '', req.params.id]
    );

    // If device needs repair (under_repair or repair_pending), update device status
    if (resolution_status === 'under_repair' || resolution_status === 'repair_pending') {
      const reportData = runQuery('SELECT device_id FROM employee_reports WHERE id = ?', [req.params.id]);
      if (reportData.length > 0) {
        runInsert('UPDATE devices SET status = ? WHERE id = ?', ['maintenance', reportData[0].device_id]);
      }
    }
    // If resolved, keep device in maintenance until procurement confirms

    // Notify procurement about the update - needs verification
    const admins = runQuery("SELECT id FROM users WHERE role IN ('it_admin', 'procurement')");
    admins.forEach(admin => {
      let statusMessage = '';
      if (resolution_status === 'resolved_vendor') {
        statusMessage = 'Vendor reports issue resolved - REQUIRES PROCUREMENT VERIFICATION';
      } else if (resolution_status === 'under_repair') {
        statusMessage = 'Under repair - Needs more time';
      } else if (resolution_status === 'repair_pending') {
        statusMessage = 'Pending - Waiting for parts';
      }
      runInsert(
        'INSERT INTO notifications (id, user_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), admin.id, 'Vendor Issue Update - Verification Required', `Vendor updated issue status: ${statusMessage}. ${resolution_notes ? 'Notes: ' + resolution_notes : ''} Expected return: ${expected_return_date || 'TBD'}. Please verify and confirm resolution.`, 'resolution']
      );
    });

    if (resolution_status === 'resolved_vendor') {
      res.json({ message: 'Issue marked as resolved. Waiting for procurement to verify and confirm.' });
    } else {
      res.json({ message: 'Issue updated successfully' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3001;

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`D03 AMS Backend running on port ${PORT}`);
  });
});