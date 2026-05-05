const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const db = new sqlite3.Database('./smartbus.db');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// --- DATABASE SETUP ---
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        name TEXT, 
        email TEXT UNIQUE, 
        password TEXT, 
        phone TEXT DEFAULT '+91 00000 00000', 
        role TEXT DEFAULT 'customer'
    )`);

    db.run(`ALTER TABLE users ADD COLUMN phone TEXT DEFAULT '+91 00000 00000'`, (err) => {
        if (err) { console.log("Note: Phone column already exists."); }
        else { console.log("Phone column added! ✅"); }
    });
    
    db.run(`CREATE TABLE IF NOT EXISTS buses (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        bus_name TEXT, type TEXT, source TEXT, destination TEXT, departure_time TEXT, price INTEGER
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        user_id INTEGER, 
        bus_id INTEGER, 
        passenger_name TEXT, 
        seat_no TEXT, 
        status TEXT DEFAULT 'Confirmed', 
        booking_date DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // --- DUMMY BUS DATA (Ithu illana JOIN query-la data varathu machi) ---
    db.get("SELECT COUNT(*) as count FROM buses", (err, row) => {
        if (row && row.count === 0) {
            db.run(`INSERT INTO buses (bus_name, type, source, destination, departure_time, price) 
                    VALUES ('SETC AC Sleeper', 'AC', 'Trichy', 'Chennai', '10:00 PM', 850)`);
            console.log("Sample Bus Added! 🚌");
        }
    });

    console.log("SmartBus Database Ready! ✅");
});

// --- AUTH APIs ---
app.post('/api/register', (req, res) => {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "Fields fill pannu machi!" });

    db.run(`INSERT INTO users (name, email, password, phone) VALUES (?, ?, ?, ?)`, 
    [name, email, password, phone || '+91 00000 00000'], (err) => {
        if (err) return res.status(400).json({ error: "Email already exists!" });
        res.json({ success: true, message: "User Registered!" });
    });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ? AND password = ?`, [email, password], (err, row) => {
        if (row) res.json({ success: true, user: row });
        else res.status(401).json({ success: false, error: "Invalid credentials!" });
    });
});

// --- BOOKING API ---
app.post('/api/confirm-booking', (req, res) => {
    const { user_id, bus_id, passenger_name, seat_no } = req.body;
    if (!user_id || !bus_id || !passenger_name || !seat_no) return res.status(400).json({ error: "Data missing!" });

    const query = `INSERT INTO bookings (user_id, bus_id, passenger_name, seat_no) VALUES (?, ?, ?, ?)`;
    db.run(query, [user_id, bus_id, passenger_name, seat_no], function(err) {
        if (err) return res.status(500).json({ error: "DB Error" });
        res.json({ success: true, bookingId: this.lastID });
    });
});

// --- ADMIN APIs ---

// 1. Recent Bookings (Ithuthaan Dashboard-ku venum)
app.get('/api/admin/all-bookings', (req, res) => {
    const query = `
        SELECT b.id, b.passenger_name, b.seat_no, bus.bus_name, bus.source, bus.destination, bus.price 
        FROM bookings b 
        JOIN buses bus ON b.bus_id = bus.id
        ORDER BY b.id DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 2. Stats
app.get('/api/admin/stats', (req, res) => {
    const query = `SELECT (SELECT COUNT(*) FROM users) as totalUsers, 
                   (SELECT COUNT(*) FROM bookings) as totalBookings, 
                   (SELECT SUM(bus.price) FROM bookings b JOIN buses bus ON b.bus_id = bus.id) as totalRevenue`;
    db.get(query, (err, row) => res.json({ totalUsers: row.totalUsers || 0, totalBookings: row.totalBookings || 0, totalRevenue: row.totalRevenue || 0 }));
});

// 3. User List
app.get('/api/admin/all-users', (req, res) => {
    db.all("SELECT id, name, email, phone, role FROM users", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 4. Bus Management
app.get('/api/admin/buses', (req, res) => {
    db.all("SELECT * FROM buses", [], (err, rows) => res.json(rows));
});

app.post('/api/admin/add-bus', (req, res) => {
    const { bus_name, type, source, destination, departure_time, price } = req.body;
    db.run(`INSERT INTO buses (bus_name, type, source, destination, departure_time, price) VALUES (?, ?, ?, ?, ?, ?)`, 
    [bus_name, type, source, destination, departure_time, price], function(err) {
        res.json({ success: true, id: this.lastID });
    });
});

app.delete('/api/admin/delete-bus/:id', (req, res) => {
    db.run(`DELETE FROM buses WHERE id = ?`, [req.params.id], () => res.json({ success: true }));
});

app.listen(3000, () => console.log("Server running on http://localhost:3000 🔥"));