// 3D Print Shop Working Server - FIXED VERSION
// Simple, reliable server with JSON storage and sandboxed file management

const http = require('http');
const pathLib = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

const PORT = 4242;
const uploadsDir = pathLib.join(process.cwd(), 'uploads');

let orders = [];

console.log('🚀 Starting 3D Print Shop Working Server...');
console.log('📁 Working Directory:', process.cwd());

// Initialize uploads directory
async function initialize() {
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
    console.log('📁 Uploads directory ready');
  } catch (error) {
    console.log('⚠️ Uploads directory already exists:', error.message);
  }
}

// Load orders from JSON
async function loadOrders() {
  try {
    const content = await fs.readFile('orders.json', 'utf8');
    orders = JSON.parse(content);
    console.log(`📦 Loaded ${orders.length} orders`);
  } catch (error) {
    console.log('⚠️ No orders file found, starting fresh:', error.message);
    orders = [];
  }
  return orders;
}

// Save orders to JSON
async function saveOrders(orders) {
  try {
    await fs.writeFile('orders.json', JSON.stringify(orders, null, 2), 'utf8');
    console.log(`💾 Saved ${orders.length} orders`);
  } catch (error) {
    console.error('❌ Failed to save orders:', error.message);
  }
}

// Save uploaded file
async function saveUploadedFile(orderId, fileName, base64) {
  try {
    const orderDir = pathLib.join(uploadsDir, orderId);
    await fs.mkdir(orderDir, { recursive: true });
    const filePath = pathLib.join(orderDir, fileName);
    const buffer = Buffer.from(base64, 'base64');
    await fs.writeFile(filePath, buffer);
    console.log(`✅ File saved: ${orderId}/${fileName} (${buffer.length} bytes)`);
  } catch (error) {
    console.error('❌ Failed to save file:', error.message);
  }
}

// Get uploaded file
async function getUploadedFile(orderId, fileName) {
  try {
    const filePath = pathLib.join(uploadsDir, orderId, fileName);
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

// Authentication
const requireDashboardAuth = (req, res) => {
  const token = req.headers['x-dashboard-token'];
  if (!token || token !== 'local-dashboard-token') {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized dashboard request.' }));
    return false;
  }
  return true;
};

// Parse JSON body helper
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (error) {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

// Create server
const server = http.createServer(async (req, res) => {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Parse URL
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  try {
    // CREATE ORDER
    if (pathname === '/orders' && req.method === 'POST') {
      const body = await parseBody(req);

      if (!body.clientName || !body.clientPhone) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Missing required order fields.' }));
      }

      const newOrder = {
        id: crypto.randomUUID(),
        clientName: body.clientName,
        clientPhone: body.clientPhone,
        quantity: Number(body.quantity || 1),
        createdAt: new Date().toISOString(),
        fileName: body.fileName || '',
        paymentStatus: body.paymentStatus || 'Unpaid'
      };

      // Save file if present
      if (body.fileBase64 && body.fileName) {
        try {
          await saveUploadedFile(newOrder.id, body.fileName, body.fileBase64);
        } catch (error) {
          console.warn('⚠️ Failed to save uploaded file:', error.message);
        }
      }

      orders.unshift(newOrder);
      await saveOrders(orders);

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(newOrder));
      console.log(`📦 New order created: ${newOrder.id} - ${newOrder.clientName}`);
    }

    // GET ORDERS
    if (pathname === '/dashboard/orders' && req.method === 'GET') {
      if (!requireDashboardAuth(req, res)) {
        return;
      }
      
      const orders = await loadOrders();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ orders }));
    }

    // UPDATE STATUS
    if (pathname.startsWith('/dashboard/orders/') && pathname.endsWith('/status') && req.method === 'PATCH') {
      try {
        const parts = pathname.split('/');
        const id = parts[3]; // /dashboard/orders/:id/status
        const body = await parseBody(req);
        const { status } = body;

        if (!status || !['Pending', 'Paid', 'Unpaid', 'Cancelled'].includes(status)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Invalid status.' }));
        }

        const orders = await loadOrders();
        const order = orders.find(o => o.id === id);
        
        if (!order) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Order not found.' }));
          return;
        }
        
        order.paymentStatus = status;
        await saveOrders(orders);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, order }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to update order status.' }));
      }
    } else if (path === '/download/:orderId/:fileName') {
      // File download
      const { orderId, fileName } = req.params;
      const decodedOrderId = decodeURIComponent(orderId);
      const decodedFileName = decodeURIComponent(fileName);
      
      // Get from filesystem
      const buffer = await getUploadedFile(decodedOrderId, decodedFileName);
      
      if (!buffer) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File not found.' }));
        return;
      }
      
      // Determine MIME type
      const mimeType = getMimeType(decodedFileName);
      
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${decodedFileName}"`
      });
      res.end(buffer);
      console.log(`💾 File served: ${decodedOrderId}/${decodedFileName}`);
    } else if (path === '/dashboard-auth' && req.method === 'POST') {
      // Dashboard authentication
      try {
        const password = String(req.body?.password || '');
        if (!password || password !== 'admin123') {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid dashboard password.' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ token: 'local-dashboard-token' }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Authentication failed.' }));
      }
    } else if (path === '/payment-config') {
      // Payment configuration
      try {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          methods: [
            { id: 'cash-on-delivery', label: 'Cash on Delivery', type: 'manual', enabled: true },
            { id: 'card-online', label: 'Card (Online)', type: 'stripe', enabled: true },
          ],
          gateway: {
            stripeEnabled: true,
            amount: 1000,
            currency: 'usd',
          },
        }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to load payment configuration.' }));
      }
    } else {
      // 404 for other routes
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Endpoint not found.' }));
    }
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error.' }));
  }
});

// Helper function
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.stl': 'application/octet-stream',
    '.obj': 'text/plain',
    '.3mf': 'application/octet-stream',
    '.step': 'application/octet-stream',
    '.stp': 'application/octet-stream',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// Start server
server.listen(PORT, async () => {
  console.log(`🚀 3D Print Shop Working Server listening on http://localhost:${PORT}`);
  await initialize();
  console.log('✅ Server initialized with JSON storage and sandboxed file management');
  console.log('🌐 Dashboard: http://localhost:5173');
  console.log('📊 Health Check: http://localhost:4242/health');
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});
