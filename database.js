
const path = require('path');
const fs = require('fs-extra');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, 'app_data.db');
const backupsDir = path.join(__dirname, 'backups');
let db;

function init() {
  fs.ensureDirSync(backupsDir);
  const dbExists = fs.existsSync(dbPath);
  db = new Database(dbPath);

  if (!dbExists) {
    console.log('Creating database schema...');
    // Use exec for multi-statement SQL
    db.exec(`
      CREATE TABLE Users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('Admin', 'Lawyer', 'Employee'))
      );
      CREATE TABLE Clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT UNIQUE,
        address TEXT
      );
      CREATE TABLE Cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_number TEXT UNIQUE NOT NULL,
        client_id INTEGER,
        description TEXT,
        status TEXT DEFAULT 'Open',
        FOREIGN KEY (client_id) REFERENCES Clients(id) ON DELETE SET NULL
      );
      CREATE TABLE Appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER,
        title TEXT NOT NULL,
        date DATETIME NOT NULL,
        location TEXT,
        FOREIGN KEY (case_id) REFERENCES Cases(id) ON DELETE CASCADE
      );
      CREATE TABLE Invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER,
        amount REAL NOT NULL,
        due_date DATE,
        status TEXT DEFAULT 'Unpaid',
        FOREIGN KEY (case_id) REFERENCES Cases(id) ON DELETE CASCADE
      );
    `);
    
    // Insert default admin user
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('admin123', salt);
    const stmt = db.prepare('INSERT INTO Users (username, password, role) VALUES (?, ?, ?)');
    stmt.run('admin', hash, 'Admin');
    console.log('Default admin user created.');
  }
}

function attemptLogin(username, password) {
  const stmt = db.prepare('SELECT * FROM Users WHERE username = ?');
  const user = stmt.get(username);

  if (!user) {
    throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة.');
  }

  const passwordMatch = bcrypt.compareSync(password, user.password);
  if (!passwordMatch) {
    throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة.');
  }

  // Don't send password hash to renderer process
  const { password: _, ...safeUser } = user;
  return safeUser;
}

function getDashboardStats() {
    const casesCount = db.prepare('SELECT COUNT(*) as count FROM Cases').get().count;
    const upcomingAppointments = db.prepare("SELECT COUNT(*) as count FROM Appointments WHERE date > datetime('now')").get().count;
    const activeClients = db.prepare('SELECT COUNT(*) as count FROM Clients').get().count;
    
    return {
        casesCount,
        upcomingAppointments,
        activeClients
    };
}


function backupDatabase() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupsDir, `backup-${timestamp}.db`);
    try {
        db.backup(backupPath)
            .then(() => console.log('Backup successful!'))
            .catch((err) => console.error('Backup failed:', err));
        return { success: true, path: backupPath };
    } catch (err) {
        console.error('Failed to initiate backup:', err);
        throw err;
    }
}

function close() {
    if (db) {
        db.close();
    }
}

// Client Management
function getClients() {
  return db.prepare('SELECT * FROM Clients ORDER BY name').all();
}

function getClientList() {
    return db.prepare('SELECT id, name FROM Clients ORDER BY name').all();
}

function addClient({ name, phone, email, address }) {
  const stmt = db.prepare('INSERT INTO Clients (name, phone, email, address) VALUES (?, ?, ?, ?)');
  const result = stmt.run(name, phone, email, address);
  return { id: result.lastInsertRowid, name, phone, email, address };
}

function updateClient({ id, name, phone, email, address }) {
  const stmt = db.prepare('UPDATE Clients SET name = ?, phone = ?, email = ?, address = ? WHERE id = ?');
  stmt.run(name, phone, email, address, id);
  return { id, name, phone, email, address };
}

function deleteClient(id) {
  // Set client_id to NULL in related cases before deleting the client
  const updateCasesStmt = db.prepare('UPDATE Cases SET client_id = NULL WHERE client_id = ?');
  updateCasesStmt.run(id);

  const stmt = db.prepare('DELETE FROM Clients WHERE id = ?');
  const result = stmt.run(id);
  return { success: result.changes > 0 };
}


// Case Management
function getCases() {
    const query = `
        SELECT 
            c.id, 
            c.case_number, 
            c.description, 
            c.status, 
            cl.name as client_name 
        FROM Cases c
        LEFT JOIN Clients cl ON c.client_id = cl.id
        ORDER BY c.id DESC
    `;
    return db.prepare(query).all();
}

function addCase({ case_number, client_id, description, status }) {
    const stmt = db.prepare('INSERT INTO Cases (case_number, client_id, description, status) VALUES (?, ?, ?, ?)');
    const result = stmt.run(case_number, client_id, description, status);
    return { id: result.lastInsertRowid, case_number, client_id, description, status };
}

function updateCase({ id, case_number, client_id, description, status }) {
    const stmt = db.prepare('UPDATE Cases SET case_number = ?, client_id = ?, description = ?, status = ? WHERE id = ?');
    stmt.run(case_number, client_id, description, status, id);
    return { id, case_number, client_id, description, status };
}

function deleteCase(id) {
    const stmt = db.prepare('DELETE FROM Cases WHERE id = ?');
    const result = stmt.run(id);
    return { success: result.changes > 0 };
}


module.exports = {
  init,
  close,
  attemptLogin,
  getDashboardStats,
  backupDatabase,
  // Clients
  getClients,
  getClientList,
  addClient,
  updateClient,
  deleteClient,
  // Cases
  getCases,
  addCase,
  updateCase,
  deleteCase,
};
