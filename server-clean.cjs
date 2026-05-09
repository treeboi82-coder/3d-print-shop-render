const http = require('http');
const pathLib = require('path'); // renamed to avoid conflict
const fs = require('fs').promises;
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const NodeRSA = require('node-rsa');

const PORT = process.env.PORT || 4242;
const uploadsDir = pathLib.join(process.cwd(), 'uploads');
const JWT_SECRET = 'your-secret-key-change-in-production';
const SALT_ROUNDS = 10;
const MAX_LOGIN_ATTEMPTS = 3;
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB limit for 3D files

let orders = [];
let loginAttempts = {}; // Track failed attempts by IP
let loginLogs = []; // Undeletable login logs

// Initialize RSA key pair
const rsa = new NodeRSA({ b: 2048 });
const publicKey = rsa.exportKey('public');
const privateKey = rsa.exportKey('private');

// Admin credentials (stored hashed)
let adminCredentials = {
  username: '3d print shop admin',
  passwordHash: null // Will be set on first run
};

// Login logs file
const loginLogsFile = 'login-logs.json';

// Load login logs
async function loadLoginLogs() {
  try {
    const content = await fs.readFile(loginLogsFile, 'utf8');
    loginLogs = JSON.parse(content);
  } catch {
    loginLogs = [];
  }
  return loginLogs;
}

// Save login logs
async function saveLoginLogs() {
  await fs.writeFile(loginLogsFile, JSON.stringify(loginLogs, null, 2));
}

// Log login attempt
async function logLoginAttempt(ip, username, success, reason) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ip: ip,
    username: username,
    success: success,
    reason: reason
  };
  loginLogs.push(logEntry);
  await saveLoginLogs();
}

// Check if IP is locked out
function isLockedOut(ip) {
  const attempts = loginAttempts[ip] || [];
  const recentAttempts = attempts.filter(attempt => 
    Date.now() - attempt.timestamp < 15 * 60 * 1000 // 15 minutes window
  );
  return recentAttempts.length >= MAX_LOGIN_ATTEMPTS;
}

// Record failed attempt
function recordFailedAttempt(ip) {
  if (!loginAttempts[ip]) {
    loginAttempts[ip] = [];
  }
  loginAttempts[ip].push({ timestamp: Date.now() });
  
  // Clear old attempts (older than 15 minutes)
  loginAttempts[ip] = loginAttempts[ip].filter(attempt => 
    Date.now() - attempt.timestamp < 15 * 60 * 1000
  );
}

// Clear attempts on successful login
function clearFailedAttempts(ip) {
  delete loginAttempts[ip];
}

// Init
async function initialize() {
  await fs.mkdir(uploadsDir, { recursive: true });
  await loadLoginLogs();
  
  // Set initial password if not set
  if (!adminCredentials.passwordHash) {
    adminCredentials.passwordHash = await bcrypt.hash('3dprintshopadmin@#', SALT_ROUNDS);
    console.log('Initial admin password set to: 3dprintshopadmin@#');
  }
}

// Load orders
async function loadOrders() {
  try {
    const content = await fs.readFile('orders.json', 'utf8');
    orders = JSON.parse(content);
  } catch {
    orders = [];
  }
  return orders; // ✅ FIX
}

// Save orders
async function saveOrders() {
  await fs.writeFile('orders.json', JSON.stringify(orders, null, 2));
}

// Parse JSON body helper
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

// Save file
async function saveUploadedFile(orderId, fileName, base64) {
  const dir = pathLib.join(uploadsDir, orderId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    pathLib.join(dir, fileName),
    Buffer.from(base64, 'base64')
  );
}

// Get file
async function getUploadedFile(orderId, fileName) {
  try {
    return await fs.readFile(pathLib.join(uploadsDir, orderId, fileName));
  } catch {
    return null;
  }
}

// Calculate shipping cost based on governorate
function calculateShippingCost(governorate) {
  const shippingCosts = {
    'Amman': 2.0,
    'Irbid': 3.0,
    'Zarqa': 2.5,
    'Balqa': 3.0,
    'Ajloun': 4.0,
    'Jerash': 4.0,
    'Mafraq': 5.0,
    'Karak': 5.0,
    'Tafilah': 6.0,
    'Ma\'an': 6.0,
    'Aqaba': 7.0,
    'Madaba': 3.0
  };
  
  return shippingCosts[governorate] || 3.0; // Default to 3 JOD for unknown governorates
}

// Server
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-dashboard-token');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  try {

    // CREATE ORDER
    if (pathname === '/orders' && req.method === 'POST') {
      const body = await parseBody(req);

      if (!body.clientName || !body.clientPhone) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: 'Missing fields' }));
      }

      // File validation
      if (body.fileName) {
        const fileName = String(body.fileName).toLowerCase();
        const fileSize = Number(body.fileSize || 0);

        // Check file size limit (50MB for 3D files)
        if (fileSize > MAX_FILE_SIZE) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB` }));
        }

        // Validate 3D file extensions
        const validExtensions = ['.stl', '.obj', '.3mf', '.ply', '.step', '.stp', '.iges', '.igs'];
        const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
        
        if (!validExtensions.includes(fileExtension)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Invalid file type. Only 3D files (.stl, .obj, .3mf, .ply, .step, .stp, .iges, .igs) are allowed.' }));
        }

        // Validate file content (check for malicious patterns in base64)
        if (body.fileBase64) {
          const base64Content = String(body.fileBase64);
          
          // Check for suspicious patterns that might indicate malicious content
          const suspiciousPatterns = [
            /<script/i,
            /javascript:/i,
            /<iframe/i,
            /<object/i,
            /<embed/i,
            /eval\(/i,
            /document\./i,
            /window\./i
          ];

          for (const pattern of suspiciousPatterns) {
            if (pattern.test(base64Content)) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ error: 'File contains suspicious content and cannot be uploaded.' }));
            }
          }
        }
      }

      // Calculate shipping cost
      const shippingCost = calculateShippingCost(body.governorate);
      const basePrice = Number(body.unitPrice || 0) * Number(body.quantity || 1);
      const totalOrderPrice = basePrice + shippingCost;

      const newOrder = {
        id: crypto.randomUUID(),
        clientName: body.clientName,
        clientPhone: body.clientPhone,
        printMaterial: body.printMaterial || 'Standard',
        paymentMethod: body.paymentMethod || 'Cash on Delivery',
        paymentStatus: body.paymentStatus || 'Unpaid',
        quantity: Number(body.quantity || 1),
        color: body.color || '',
        governorate: body.governorate || '',
        unitPrice: Number(body.unitPrice || 0),
        shippingCost: shippingCost,
        totalPrice: totalOrderPrice,
        createdAt: new Date().toISOString(),
        fileName: body.fileName || '',
        fileSize: Number(body.fileSize || 0),
        fileType: body.fileType || '',
        weightGrams: Number(body.weightGrams || 0),
        deliveryAddress: body.deliveryAddress || ''
      };

      if (body.fileBase64 && body.fileName) {
        await saveUploadedFile(newOrder.id, body.fileName, body.fileBase64);
      }

      orders.unshift(newOrder);
      await saveOrders();

      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(newOrder));
    }

    // GET ORDERS
    if (pathname === '/dashboard/orders' && req.method === 'GET') {
      // Check authentication with JWT
      const token = req.headers['x-dashboard-token'];
      if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Unauthorized dashboard request.' }));
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'admin') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Forbidden: Admin access required.' }));
        }
      } catch (error) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid or expired token.' }));
      }
      
      await loadOrders();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ orders }));
    }

    // DASHBOARD AUTH
    if (pathname === '/dashboard-auth' && req.method === 'POST') {
      const body = await parseBody(req);
      const username = String(body.username || '');
      const password = String(body.password || '');
      const ip = req.socket.remoteAddress || 'unknown';

      // Check if IP is locked out
      if (isLockedOut(ip)) {
        await logLoginAttempt(ip, username, false, 'Account locked out - too many failed attempts');
        res.writeHead(429, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Account locked out. Please try again in 15 minutes.' }));
      }

      // Validate credentials
      if (!username || !password) {
        recordFailedAttempt(ip);
        await logLoginAttempt(ip, username, false, 'Missing credentials');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Username and password are required.' }));
      }

      if (username !== adminCredentials.username) {
        recordFailedAttempt(ip);
        await logLoginAttempt(ip, username, false, 'Invalid username');
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid username or password.' }));
      }

      // Verify password using bcrypt
      const passwordMatch = await bcrypt.compare(password, adminCredentials.passwordHash);
      
      if (!passwordMatch) {
        recordFailedAttempt(ip);
        await logLoginAttempt(ip, username, false, 'Invalid password');
        const attemptsLeft = MAX_LOGIN_ATTEMPTS - (loginAttempts[ip]?.length || 0);
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ 
          error: `Invalid username or password. ${attemptsLeft} attempts remaining before lockout.` 
        }));
      }

      // Clear failed attempts on successful login
      clearFailedAttempts(ip);
      await logLoginAttempt(ip, username, true, 'Successful login');

      // Generate JWT token
      const token = jwt.sign(
        { username: adminCredentials.username, role: 'admin' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ token, username: adminCredentials.username }));
    }

    // GET PAYMENT CONFIG
    if (pathname === '/payment-config' && req.method === 'GET') {
      // Check if this is a dashboard request (has token header)
      const token = req.headers['x-dashboard-token'];
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          if (decoded.role !== 'admin') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Forbidden: Admin access required.' }));
          }
        } catch (error) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Invalid or expired token.' }));
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        methods: [
          { id: 'cash-on-delivery', label: 'Cash on Delivery', type: 'manual', enabled: true },
          { id: 'cliq', label: 'Cliq', type: 'online', enabled: true },
          { id: 'zain-cash', label: 'Zain Cash', type: 'online', enabled: true },
          { id: 'orange-money', label: 'Orange Money', type: 'online', enabled: true }
        ],
        gateway: {
          stripeEnabled: false,
          amount: 1000,
          currency: 'jod'
        }
      }));
    }

    // UPDATE PAYMENT CONFIG
    if (pathname === '/payment-config' && req.method === 'PUT') {
      // Check authentication with JWT
      const token = req.headers['x-dashboard-token'];
      if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Unauthorized dashboard request.' }));
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'admin') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Forbidden: Admin access required.' }));
        }
      } catch (error) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid or expired token.' }));
      }

      const body = await parseBody(req);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        methods: body.methods || [
          { id: 'cash-on-delivery', label: 'Cash on Delivery', type: 'manual', enabled: true },
          { id: 'cliq', label: 'Cliq', type: 'online', enabled: true },
          { id: 'zain-cash', label: 'Zain Cash', type: 'online', enabled: true },
          { id: 'orange-money', label: 'Orange Money', type: 'online', enabled: true }
        ],
        gateway: body.gateway || {
          stripeEnabled: false,
          amount: 1000,
          currency: 'jod'
        }
      }));
    }

    // GET SHIPPING COSTS
    if (pathname === '/shipping-costs' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        'Amman': 2.0,
        'Irbid': 3.0,
        'Zarqa': 2.5,
        'Balqa': 3.0,
        'Ajloun': 4.0,
        'Jerash': 4.0,
        'Mafraq': 5.0,
        'Karak': 5.0,
        'Tafilah': 6.0,
        'Ma\'an': 6.0,
        'Aqaba': 7.0,
        'Madaba': 3.0
      }));
    }

    // PROCESS PAYMENT - Cliq
    if (pathname === '/payment/cliq' && req.method === 'POST') {
      const body = await parseBody(req);
      const { orderId, amount, phoneNumber } = body;

      if (!orderId || !amount || !phoneNumber) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Missing required fields: orderId, amount, phoneNumber' }));
      }

      // Simulate Cliq payment processing
      // In production, this would integrate with Cliq's API
      const paymentId = crypto.randomUUID();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        paymentId: paymentId,
        message: 'Payment initiated via Cliq. Please complete payment on your phone.',
        status: 'pending'
      }));
    }

    // PROCESS PAYMENT - Zain Cash
    if (pathname === '/payment/zain-cash' && req.method === 'POST') {
      const body = await parseBody(req);
      const { orderId, amount, phoneNumber } = body;

      if (!orderId || !amount || !phoneNumber) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Missing required fields: orderId, amount, phoneNumber' }));
      }

      // Simulate Zain Cash payment processing
      // In production, this would integrate with Zain Cash's API
      const paymentId = crypto.randomUUID();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        paymentId: paymentId,
        message: 'Payment initiated via Zain Cash. Please complete payment on your phone.',
        status: 'pending'
      }));
    }

    // PROCESS PAYMENT - Orange Money
    if (pathname === '/payment/orange-money' && req.method === 'POST') {
      const body = await parseBody(req);
      const { orderId, amount, phoneNumber } = body;

      if (!orderId || !amount || !phoneNumber) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Missing required fields: orderId, amount, phoneNumber' }));
      }

      // Simulate Orange Money payment processing
      // In production, this would integrate with Orange Money's API
      const paymentId = crypto.randomUUID();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        paymentId: paymentId,
        message: 'Payment initiated via Orange Money. Please complete payment on your phone.',
        status: 'pending'
      }));
    }

    // UPDATE STATUS (manual param parsing)
    if (pathname.startsWith('/dashboard/orders/') && pathname.endsWith('/status') && req.method === 'PATCH') {
      // Check authentication with JWT
      const token = req.headers['x-dashboard-token'];
      if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Unauthorized dashboard request.' }));
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'admin') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Forbidden: Admin access required.' }));
        }
      } catch (error) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid or expired token.' }));
      }

      const parts = pathname.split('/');
      const id = parts[3]; // /dashboard/orders/:id/status

      const body = await parseBody(req);
      const { status } = body;

      if (!['Pending', 'Paid', 'Unpaid', 'Cancelled'].includes(status)) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: 'Invalid status' }));
      }

      await loadOrders();

      const order = orders.find(o => o.id === id);
      if (!order) {
        res.writeHead(404);
        return res.end(JSON.stringify({ error: 'Not found' }));
      }

      order.paymentStatus = status;
      await saveOrders();

      res.writeHead(200);
      return res.end(JSON.stringify(order));
    }

    // DOWNLOAD FILE
    if (pathname.startsWith('/download/')) {
      const parts = pathname.split('/');
      const orderId = decodeURIComponent(parts[2]);
      const fileName = decodeURIComponent(parts[3]);

      const file = await getUploadedFile(orderId, fileName);

      if (!file) {
        res.writeHead(404);
        return res.end('Not found');
      }

      res.writeHead(200, {
        'Content-Disposition': `attachment; filename="${fileName}"`
      });

      return res.end(file);
    }

    // CHANGE PASSWORD
    if (pathname === '/dashboard/change-password' && req.method === 'POST') {
      // Check authentication with JWT
      const token = req.headers['x-dashboard-token'];
      if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Unauthorized dashboard request.' }));
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'admin') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Forbidden: Admin access required.' }));
        }
      } catch (error) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid or expired token.' }));
      }

      const body = await parseBody(req);
      const { currentPassword, newPassword } = body;

      if (!currentPassword || !newPassword) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Current password and new password are required.' }));
      }

      // Verify current password
      const passwordMatch = await bcrypt.compare(currentPassword, adminCredentials.passwordHash);
      if (!passwordMatch) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Current password is incorrect.' }));
      }

      // Hash new password and update
      adminCredentials.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, message: 'Password changed successfully.' }));
    }

    // GET LOGIN LOGS
    if (pathname === '/dashboard/login-logs' && req.method === 'GET') {
      // Check authentication with JWT
      const token = req.headers['x-dashboard-token'];
      if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Unauthorized dashboard request.' }));
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'admin') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Forbidden: Admin access required.' }));
        }
      } catch (error) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid or expired token.' }));
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ logs: loginLogs }));
    }

    // 404
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));

  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Server error' }));
  }
});

// Start
server.listen(PORT, async () => {
  await initialize();
  console.log(`Server running at http://localhost:${PORT}`);
});
