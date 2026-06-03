-- D03 AMS MySQL Schema for cPanel Hosting
-- This schema matches the SQLite database used in development
-- Run this SQL in your MySQL database (phpMyAdmin in cPanel)

-- ==========================================
-- Create Database
-- ==========================================
CREATE DATABASE IF NOT EXISTS thams_db;
USE thams_db;

-- ==========================================
-- Users Table
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role ENUM('it_admin', 'procurement', 'vendor', 'employee') DEFAULT 'employee',
    department VARCHAR(255),
    phone VARCHAR(50),
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ==========================================
-- Vendors Table
-- ==========================================
CREATE TABLE IF NOT EXISTS vendors (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    status ENUM('active', 'inactive', 'pending') DEFAULT 'pending',
    rating INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ==========================================
-- SLA Agreements Table
-- ==========================================
CREATE TABLE IF NOT EXISTS sla_agreements (
    id VARCHAR(36) PRIMARY KEY,
    vendor_id VARCHAR(36),
    name VARCHAR(255) NOT NULL,
    content TEXT,
    signature_name VARCHAR(255),
    signature_data TEXT,
    signature_status ENUM('pending', 'agreed', 'disagreed') DEFAULT 'pending',
    sla_response_date DATETIME,
    delivery_timeline_days INT,
    warranty_months INT DEFAULT 3,
    response_time_hours INT,
    penalties_per_day DECIMAL(10,2),
    specifications TEXT,
    quality_standards TEXT,
    replacement_policy TEXT,
    maintenance_expectations TEXT,
    status ENUM('draft', 'active', 'expired') DEFAULT 'draft',
    start_date DATE,
    end_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL
);

-- ==========================================
-- Devices Table
-- ==========================================
CREATE TABLE IF NOT EXISTS devices (
    id VARCHAR(36) PRIMARY KEY,
    request_id VARCHAR(36),
    asset_tag VARCHAR(100) UNIQUE NOT NULL,
    serial_number VARCHAR(100),
    model VARCHAR(255),
    brand VARCHAR(100),
    ram_gb INT,
    storage_gb INT,
    processor VARCHAR(255),
    purchase_date DATE,
    warranty_months INT DEFAULT 12,
    warranty_expiry DATE,
    actual_delivery_date DATE,
    expected_delivery_date DATE,
    vendor_id VARCHAR(36),
    condition ENUM('new', 'good', 'fair', 'poor', 'damaged') DEFAULT 'new',
    status ENUM('available', 'allocated', 'maintenance', 'retired', 'delivered', 'pending_delivery_confirm') DEFAULT 'available',
    qr_code TEXT,
    device_images TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL
);

-- ==========================================
-- Device Allocations Table
-- ==========================================
CREATE TABLE IF NOT EXISTS device_allocations (
    id VARCHAR(36) PRIMARY KEY,
    device_id VARCHAR(36) NOT NULL,
    employee_id VARCHAR(36),
    employee_name TEXT,
    employee_email TEXT,
    work_email TEXT,
    department TEXT,
    job_title TEXT,
    assigned_by VARCHAR(36),
    issue_date DATE,
    return_date DATE,
    issue_condition ENUM('new', 'good', 'fair', 'poor', 'damaged'),
    return_condition ENUM('new', 'good', 'fair', 'poor', 'damaged'),
    acknowledgment TEXT,
    status ENUM('active', 'returned') DEFAULT 'active',
    report_token TEXT,
    report_submitted_at DATETIME,
    issue_report TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ==========================================
-- Device Reports Table
-- ==========================================
CREATE TABLE IF NOT EXISTS device_reports (
    id VARCHAR(36) PRIMARY KEY,
    device_id VARCHAR(36) NOT NULL,
    report_type VARCHAR(100),
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- ==========================================
-- Purchase Requests Table
-- ==========================================
CREATE TABLE IF NOT EXISTS purchase_requests (
    id VARCHAR(36) PRIMARY KEY,
    requester_id VARCHAR(36),
    requester_name VARCHAR(255),
    requester_email VARCHAR(255),
    request_type VARCHAR(100),
    description TEXT,
    quantity INT DEFAULT 1,
    preferred_vendor VARCHAR(255),
    estimated_budget DECIMAL(10, 2),
    status ENUM('pending', 'vendor_notified', 'accepted', 'rejected', 'ordered', 'delivered', 'cancelled') DEFAULT 'pending',
    vendor_response TEXT,
    delivery_date DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ==========================================
-- Warranty Claims Table
-- ==========================================
CREATE TABLE IF NOT EXISTS warranty_claims (
    id VARCHAR(36) PRIMARY KEY,
    device_id VARCHAR(36) NOT NULL,
    vendor_id VARCHAR(36),
    type ENUM('repair', 'replacement', 'refund') DEFAULT 'repair',
    description TEXT,
    status ENUM('pending', 'approved', 'in_progress', 'resolved', 'rejected') DEFAULT 'pending',
    claim_date DATE,
    resolution_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL
);

-- ==========================================
-- Maintenance Records Table
-- ==========================================
CREATE TABLE IF NOT EXISTS maintenance_records (
    id VARCHAR(36) PRIMARY KEY,
    device_id VARCHAR(36) NOT NULL,
    maintenance_type VARCHAR(100),
    description TEXT,
    performed_by VARCHAR(255),
    scheduled_date DATE,
    completed_date DATE,
    cost DECIMAL(10, 2),
    status ENUM('scheduled', 'in_progress', 'completed', 'cancelled') DEFAULT 'scheduled',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- ==========================================
-- Notifications Table
-- ==========================================
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    title VARCHAR(255) NOT NULL,
    message TEXT,
    type VARCHAR(50),
    is_read BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================================
-- Vendor Products Table
-- ==========================================
CREATE TABLE IF NOT EXISTS vendor_products (
    id VARCHAR(36) PRIMARY KEY,
    vendor_id VARCHAR(36) NOT NULL,
    product_name VARCHAR(255),
    description TEXT,
    specifications TEXT,
    unit_price DECIMAL(10, 2),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
);

-- ==========================================
-- Password Resets Table
-- ==========================================
CREATE TABLE IF NOT EXISTS password_resets (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- Employee Reports Table
-- ==========================================
CREATE TABLE IF NOT EXISTS employee_reports (
    id VARCHAR(36) PRIMARY KEY,
    device_id VARCHAR(36) NOT NULL,
    employee_id VARCHAR(36),
    report_type VARCHAR(100),
    description TEXT,
    status ENUM('pending', 'sent_to_vendor', 'under_repair', 'repair_pending', 'repair_completed', 'repair_pending_confirmation', 'awaiting_employee_confirmation', 'resolved_internal', 'returned', 'repair_rejected') DEFAULT 'pending',
    resolution_notes TEXT,
    resolution_date DATETIME,
    returned_to_company DATETIME,
    vendor_id VARCHAR(36),
    repair_completed DATE,
    report_token VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL
);

-- ==========================================
-- Audit Logs Table
-- ==========================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id VARCHAR(36),
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ==========================================
-- Create Indexes for Performance
-- ==========================================
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_vendor ON devices(vendor_id);
CREATE INDEX idx_device_allocations_device ON device_allocations(device_id);
CREATE INDEX idx_device_allocations_status ON device_allocations(status);
CREATE INDEX idx_employee_reports_status ON employee_reports(status);
CREATE INDEX idx_employee_reports_vendor ON employee_reports(vendor_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_vendors_email ON vendors(email);

-- ==========================================
-- Insert Default Admin User
-- Password: admin123 (will need to be hashed with bcrypt)
-- ==========================================
-- NOTE: Before inserting, hash the password using bcrypt
-- Default password hash for 'admin123' is: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
INSERT INTO users (id, name, email, password, role, department) VALUES
('admin-001', 'System Admin', 'admin@trainingheights.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'it_admin', 'IT');

-- ==========================================
-- Note for cPanel Deployment
-- ==========================================
-- 1. Create a MySQL database in cPanel
-- 2. Import this schema using phpMyAdmin
-- 3. Update the backend connection in server.js to use MySQL instead of SQLite
-- 4. Update the DB_HOST, DB_USER, DB_PASSWORD, DB_NAME in your .env file