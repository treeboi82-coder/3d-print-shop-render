import fs from 'fs/promises';
import path from 'path';
import { databaseService } from '../src/services/databaseService';

// Migration script to move from JSON files to PostgreSQL
async function migrateToPostgres() {
  console.log('Starting migration from JSON to PostgreSQL...');

  try {
    // Initialize database
    await databaseService.initialize();
    console.log('Database initialized successfully');

    // Read existing orders from JSON file
    const ordersPath = path.resolve('orders.json');
    let existingOrders: any[] = [];

    try {
      const ordersData = await fs.readFile(ordersPath, 'utf8');
      existingOrders = JSON.parse(ordersData);
      console.log(`Found ${existingOrders.length} orders in JSON file`);
    } catch (error) {
      console.log('No existing orders.json file found or could not read it');
    }

    if (existingOrders.length > 0) {
      // Migrate orders to PostgreSQL
      const migrationResult = await databaseService.migrateFromJson(existingOrders);
      
      console.log('Migration completed:');
      console.log(`✅ Successfully migrated: ${migrationResult.success} orders`);
      console.log(`❌ Failed to migrate: ${migrationResult.failed} orders`);
      
      if (migrationResult.errors.length > 0) {
        console.log('\nErrors:');
        migrationResult.errors.forEach(error => console.log(`  - ${error}`));
      }

      // Create backup of original JSON file
      const backupPath = path.resolve(`orders-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      await fs.copyFile(ordersPath, backupPath);
      console.log(`\n📁 Original JSON file backed up to: ${backupPath}`);
    } else {
      console.log('No orders to migrate');
    }

    // Verify migration
    const stats = await databaseService.getOrderStats();
    console.log('\n📊 Database Statistics:');
    console.log(`  Total Orders: ${stats.totalOrders}`);
    console.log(`  Paid Orders: ${stats.paidOrders}`);
    console.log(`  Unpaid Orders: ${stats.unpaidOrders}`);
    console.log(`  Total Revenue: ${stats.totalRevenue.toFixed(2)} JOD`);

    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateToPostgres();
}

export { migrateToPostgres };
