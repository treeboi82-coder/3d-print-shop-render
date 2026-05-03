import db from '../../database/connection';
import { fileManager } from './fileManager';
import path from 'path';

// Order record type matching database schema
export type OrderRecord = {
  id: string;
  client_name: string;
  client_phone: string;
  print_material: string;
  payment_method: string;
  payment_status: "Pending" | "Paid" | "Unpaid" | "Cancelled";
  quantity: number;
  color: string;
  country: string;
  governorate: string;
  delivery_address: string;
  weight_grams: number;
  unit_price: number;
  total_price: number;
  file_name?: string;
  file_size?: number;
  file_type?: string;
  created_at: string;
  updated_at: string;
};

// File record type
export type FileRecord = {
  id: string;
  order_id: string;
  file_name: string;
  file_size: number;
  file_type?: string;
  file_path: string;
  mime_type?: string;
  checksum?: string;
  created_at: string;
  updated_at: string;
};

// Payment configuration type
export type PaymentConfig = {
  id: string;
  stripe_enabled: boolean;
  amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
};

// Payment method type
export type PaymentMethod = {
  id: string;
  label: string;
  type: "stripe" | "manual";
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

// Database service class
export class DatabaseService {
  // Initialize database and file manager
  async initialize(): Promise<void> {
    try {
      // Test database connection
      const connected = await db.testConnection();
      if (!connected) {
        throw new Error('Failed to connect to database');
      }

      // Initialize schema
      await db.initializeSchema();

      // Initialize file manager
      await fileManager.initialize();

      console.log('Database service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database service:', error);
      throw error;
    }
  }

  // Order management methods
  async createOrder(orderData: Omit<OrderRecord, 'id' | 'created_at' | 'updated_at'>): Promise<OrderRecord> {
    const query = `
      INSERT INTO orders (
        client_name, client_phone, print_material, payment_method, payment_status,
        quantity, color, country, governorate, delivery_address,
        weight_grams, unit_price, total_price, file_name, file_size, file_type
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;

    const values = [
      orderData.client_name,
      orderData.client_phone,
      orderData.print_material,
      orderData.payment_method,
      orderData.payment_status,
      orderData.quantity,
      orderData.color,
      orderData.country,
      orderData.governorate,
      orderData.delivery_address,
      orderData.weight_grams,
      orderData.unit_price,
      orderData.total_price,
      orderData.file_name || null,
      orderData.file_size || 0,
      orderData.file_type || null,
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  async getAllOrders(): Promise<OrderRecord[]> {
    const query = `
      SELECT * FROM orders 
      ORDER BY created_at DESC
    `;
    
    const result = await db.query(query);
    return result.rows;
  }

  async getOrderById(id: string): Promise<OrderRecord | null> {
    const query = `SELECT * FROM orders WHERE id = $1`;
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  async updateOrderStatus(id: string, status: OrderRecord['payment_status']): Promise<OrderRecord | null> {
    const query = `
      UPDATE orders 
      SET payment_status = $2, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1 
      RETURNING *
    `;
    
    const result = await db.query(query, [id, status]);
    return result.rows[0] || null;
  }

  async deleteOrder(id: string): Promise<boolean> {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      
      // Get order to find files
      const orderResult = await client.query('SELECT * FROM orders WHERE id = $1', [id]);
      const order = orderResult.rows[0];
      
      if (order) {
        // Delete files from file system
        if (order.file_name) {
          await fileManager.deleteFile(id, order.file_name);
        }
        
        // Delete order directory
        await fileManager.deleteOrderDirectory(id);
      }
      
      // Delete from database
      const deleteResult = await client.query('DELETE FROM orders WHERE id = $1', [id]);
      
      await client.query('COMMIT');
      return deleteResult.rowCount > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async searchOrders(searchTerm: string): Promise<OrderRecord[]> {
    const query = `
      SELECT * FROM orders 
      WHERE 
        LOWER(client_name) LIKE LOWER($1) OR
        client_phone LIKE $2 OR
        LOWER(print_material) LIKE LOWER($1) OR
        LOWER(payment_method) LIKE LOWER($1) OR
        LOWER(governorate) LIKE LOWER($1) OR
        LOWER(file_name) LIKE LOWER($1) OR
        LOWER(id) LIKE LOWER($1)
      ORDER BY created_at DESC
    `;
    
    const searchPattern = `%${searchTerm}%`;
    const result = await db.query(query, [searchPattern, searchPattern]);
    return result.rows;
  }

  async getOrdersByStatus(status: OrderRecord['payment_status']): Promise<OrderRecord[]> {
    const query = `SELECT * FROM orders WHERE payment_status = $1 ORDER BY created_at DESC`;
    const result = await db.query(query, [status]);
    return result.rows;
  }

  // File management methods
  async saveFile(
    orderId: string, 
    filename: string, 
    fileData: string | Buffer,
    mimeType?: string
  ): Promise<{
    success: boolean;
    filePath?: string;
    checksum?: string;
    error?: string;
  }> {
    try {
      // Save to file system
      const saveResult = await fileManager.saveFile(orderId, filename, fileData, mimeType);
      if (!saveResult.success) {
        return saveResult;
      }

      // Record in database
      const query = `
        INSERT INTO files (order_id, file_name, file_size, file_type, file_path, mime_type, checksum)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const buffer = Buffer.isBuffer(fileData) ? fileData : Buffer.from(fileData, 'base64');
      const values = [
        orderId,
        filename,
        buffer.length,
        path.extname(filename),
        saveResult.filePath!,
        mimeType || 'application/octet-stream',
        saveResult.checksum!,
      ];

      await db.query(query, values);

      return {
        success: true,
        filePath: saveResult.filePath,
        checksum: saveResult.checksum,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save file',
      };
    }
  }

  async getFile(orderId: string, filename: string): Promise<{
    success: boolean;
    buffer?: Buffer;
    mimeType?: string;
    error?: string;
  }> {
    return await fileManager.getFile(orderId, filename);
  }

  // Payment configuration methods
  async getPaymentConfig(): Promise<PaymentConfig | null> {
    const query = `SELECT * FROM payment_config ORDER BY created_at DESC LIMIT 1`;
    const result = await db.query(query);
    return result.rows[0] || null;
  }

  async updatePaymentConfig(config: Omit<PaymentConfig, 'id' | 'created_at' | 'updated_at'>): Promise<PaymentConfig> {
    const query = `
      UPDATE payment_config 
      SET stripe_enabled = $2, amount = $3, currency = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = (SELECT id FROM payment_config ORDER BY created_at DESC LIMIT 1)
      RETURNING *
    `;
    
    const result = await db.query(query, [config.stripe_enabled, config.amount, config.currency]);
    return result.rows[0];
  }

  // Payment methods
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const query = `SELECT * FROM payment_methods WHERE enabled = true ORDER BY created_at`;
    const result = await db.query(query);
    return result.rows;
  }

  async createPaymentMethod(method: Omit<PaymentMethod, 'id' | 'created_at' | 'updated_at'>): Promise<PaymentMethod> {
    const query = `
      INSERT INTO payment_methods (label, type, enabled)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const result = await db.query(query, [method.label, method.type, method.enabled]);
    return result.rows[0];
  }

  async updatePaymentMethod(id: string, method: Partial<PaymentMethod>): Promise<PaymentMethod | null> {
    const fields = Object.keys(method).filter(key => key !== 'id');
    if (fields.length === 0) return null;

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [id, ...Object.values(method)];
    
    const query = `
      UPDATE payment_methods 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await db.query(query, values);
    return result.rows[0] || null;
  }

  // Statistics and analytics
  async getOrderStats(): Promise<{
    totalOrders: number;
    paidOrders: number;
    unpaidOrders: number;
    pendingOrders: number;
    cancelledOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN payment_status = 'Paid' THEN 1 END) as paid_orders,
        COUNT(CASE WHEN payment_status = 'Unpaid' THEN 1 END) as unpaid_orders,
        COUNT(CASE WHEN payment_status = 'Pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN payment_status = 'Cancelled' THEN 1 END) as cancelled_orders,
        COALESCE(SUM(CASE WHEN payment_status = 'Paid' THEN total_price END), 0) as total_revenue,
        COALESCE(AVG(total_price), 0) as average_order_value
      FROM orders
    `;
    
    const result = await db.query(query);
    const stats = result.rows[0];
    
    return {
      totalOrders: parseInt(stats.total_orders),
      paidOrders: parseInt(stats.paid_orders),
      unpaidOrders: parseInt(stats.unpaid_orders),
      pendingOrders: parseInt(stats.pending_orders),
      cancelledOrders: parseInt(stats.cancelled_orders),
      totalRevenue: parseFloat(stats.total_revenue),
      averageOrderValue: parseFloat(stats.average_order_value),
    };
  }

  // Migration helper
  async migrateFromJson(jsonData: any[]): Promise<{ success: number; failed: number; errors: string[] }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const order of jsonData) {
      try {
        const orderData: Omit<OrderRecord, 'id' | 'created_at' | 'updated_at'> = {
          client_name: order.clientName,
          client_phone: order.clientPhone,
          print_material: order.printMaterial,
          payment_method: order.paymentMethod,
          payment_status: order.paymentStatus,
          quantity: order.quantity,
          color: order.color,
          country: order.country,
          governorate: order.governorate,
          delivery_address: order.deliveryAddress,
          weight_grams: order.weightGrams,
          unit_price: order.unitPrice,
          total_price: order.totalPrice,
          file_name: order.fileName,
          file_size: order.fileSize,
          file_type: order.fileType,
        };

        await this.createOrder(orderData);
        success++;
      } catch (error) {
        failed++;
        errors.push(`Failed to migrate order ${order.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { success, failed, errors };
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();
