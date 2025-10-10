CREATE DATABASE smarthostel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- SmartHostel Schema (MySQL)

CREATE TABLE IF NOT EXISTS roles (
  role_id INT AUTO_INCREMENT PRIMARY KEY,
  name ENUM('Admin','Warden','Student') UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS registration_codes (
  code_id INT AUTO_INCREMENT PRIMARY KEY,
  role ENUM('Admin','Warden','Student') NOT NULL,
  code VARCHAR(64) NOT NULL UNIQUE,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role ENUM('Admin', 'Warden', 'Student') NOT NULL,
  email VARCHAR(120) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(60),
  last_name VARCHAR(60),
  phone VARCHAR(30),
  nic_number VARCHAR(20),        -- ✅ new column for NIC number
  profile_photo VARCHAR(255),    -- ✅ new column for photo URL or file path
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
  student_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNIQUE,
  guardian_name VARCHAR(120),
  guardian_phone VARCHAR(30),
  address VARCHAR(255),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS blocks (
  block_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS floors (
  floor_id INT AUTO_INCREMENT PRIMARY KEY,
  block_id INT NOT NULL,
  name VARCHAR(50) NOT NULL,
  UNIQUE KEY uq_block_floor (block_id, name),
  FOREIGN KEY (block_id) REFERENCES blocks(block_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rooms (
  room_id INT AUTO_INCREMENT PRIMARY KEY,
  floor_id INT NOT NULL,
  room_number VARCHAR(20) NOT NULL,
  capacity INT NOT NULL DEFAULT 2,
  status ENUM('Vacant','Occupied','Maintenance') DEFAULT 'Vacant',
  UNIQUE KEY uq_floor_room (floor_id, room_number),
  FOREIGN KEY (floor_id) REFERENCES floors(floor_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS allocations (
  allocation_id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  room_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  is_active TINYINT(1) DEFAULT 1,
  FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS fee_structures (
  fee_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  room_type VARCHAR(40) NULL,
  student_type VARCHAR(40) NULL,
  monthly_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  is_active TINYINT(1) DEFAULT 1
);

CREATE TABLE IF NOT EXISTS bills (
  bill_id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  month_year CHAR(7) NOT NULL, -- 'YYYY-MM'
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  discount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status ENUM('UNPAID','PARTIAL','PAID') DEFAULT 'UNPAID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  UNIQUE KEY uq_bill_student_month (student_id, month_year)
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id INT AUTO_INCREMENT PRIMARY KEY,
  bill_id INT NOT NULL,
  method ENUM('Cash','Card','UPI') NOT NULL,
  reference VARCHAR(120),
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bill_id) REFERENCES bills(bill_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attendance (
  attendance_id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  date DATE NOT NULL,
  session ENUM('Day','Night') NOT NULL,
  status ENUM('Present','Absent') NOT NULL,
  UNIQUE KEY uq_att (student_id, date, session),
  FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS staff (
  staff_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  role VARCHAR(60) NOT NULL, -- cleaner, cook, etc.
  phone VARCHAR(30),
  shift VARCHAR(60)
);

CREATE TABLE IF NOT EXISTS complaints (
  complaint_id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  title VARCHAR(120) NOT NULL,
  description TEXT,
  photo_url VARCHAR(255),
  status ENUM('Pending','In Progress','Resolved') DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL,
  assigned_to_staff_id INT NULL,
  FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to_staff_id) REFERENCES staff(staff_id) ON DELETE SET NULL
);


INSERT INTO registration_codes (role, code, is_active)
VALUES ('Admin','ADMIN-2025',1)
ON DUPLICATE KEY UPDATE is_active=1;

INSERT INTO registration_codes (role, code, is_active)
VALUES ('Warden','WARDEN-2025',1)
ON DUPLICATE KEY UPDATE is_active=1;

INSERT INTO registration_codes (role, code, is_active)
VALUES ('Student','STUDENT-2025',1)
ON DUPLICATE KEY UPDATE is_active=1;




-- Blocks
INSERT INTO blocks (name) VALUES ('A Block'), ('B Block');

-- Floors per block
INSERT INTO floors (block_id, name) VALUES
(1, 'Floor 1'), (1, 'Floor 2'), (1, 'Floor 3'), (1, 'Floor 4'), (1, 'Floor 5'),
(2, 'Floor 1'), (2, 'Floor 2'), (2, 'Floor 3'), (2, 'Floor 4'), (2, 'Floor 5');

-- Rooms (5 per floor)
INSERT INTO rooms (floor_id, room_number, capacity, status)
VALUES
-- Block A
(1, 'A101', 2, 'Vacant'), (1, 'A102', 2, 'Vacant'), (1, 'A103', 2, 'Vacant'), (1, 'A104', 2, 'Vacant'), (1, 'A105', 2, 'Vacant'),
(2, 'A201', 2, 'Vacant'), (2, 'A202', 2, 'Vacant'), (2, 'A203', 2, 'Vacant'), (2, 'A204', 2, 'Vacant'), (2, 'A205', 2, 'Vacant'),
(3, 'A301', 2, 'Vacant'), (3, 'A302', 2, 'Vacant'), (3, 'A303', 2, 'Vacant'), (3, 'A304', 2, 'Vacant'), (3, 'A305', 2, 'Vacant'),
(4, 'A401', 2, 'Vacant'), (4, 'A402', 2, 'Vacant'), (4, 'A403', 2, 'Vacant'), (4, 'A404', 2, 'Vacant'), (4, 'A405', 2, 'Vacant'),
(5, 'A501', 2, 'Vacant'), (5, 'A502', 2, 'Vacant'), (5, 'A503', 2, 'Vacant'), (5, 'A504', 2, 'Vacant'), (5, 'A505', 2, 'Vacant'),
-- Block B
(6, 'B101', 2, 'Vacant'), (6, 'B102', 2, 'Vacant'), (6, 'B103', 2, 'Vacant'), (6, 'B104', 2, 'Vacant'), (6, 'B105', 2, 'Vacant'),
(7, 'B201', 2, 'Vacant'), (7, 'B202', 2, 'Vacant'), (7, 'B203', 2, 'Vacant'), (7, 'B204', 2, 'Vacant'), (7, 'B205', 2, 'Vacant'),
(8, 'B301', 2, 'Vacant'), (8, 'B302', 2, 'Vacant'), (8, 'B303', 2, 'Vacant'), (8, 'B304', 2, 'Vacant'), (8, 'B305', 2, 'Vacant'),
(9, 'B401', 2, 'Vacant'), (9, 'B402', 2, 'Vacant'), (9, 'B403', 2, 'Vacant'), (9, 'B404', 2, 'Vacant'), (9, 'B405', 2, 'Vacant'),
(10, 'B501', 2, 'Vacant'), (10, 'B502', 2, 'Vacant'), (10, 'B503', 2, 'Vacant'), (10, 'B504', 2, 'Vacant'), (10, 'B505', 2, 'Vacant');

