-- 3D Print Shop Database Schema
-- PostgreSQL Database Schema for Orders and File Management

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_name VARCHAR(255) NOT NULL,
    client_phone VARCHAR(50) NOT NULL,
    print_material VARCHAR(100) NOT NULL,
    payment_method VARCHAR(100) NOT NULL,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Pending', 'Paid', 'Unpaid', 'Cancelled')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    color VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Jordan',
    governorate VARCHAR(100) NOT NULL,
    delivery_address TEXT NOT NULL,
    weight_grams DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    file_name VARCHAR(500),
    file_size BIGINT DEFAULT 0,
    file_type VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- File storage table
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    file_name VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    file_type VARCHAR(100),
    file_path VARCHAR(1000) NOT NULL,
    mime_type VARCHAR(100),
    checksum VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payment configuration table
CREATE TABLE IF NOT EXISTS payment_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_enabled BOOLEAN DEFAULT true,
    amount DECIMAL(10,2) DEFAULT 1000.00,
    currency VARCHAR(10) DEFAULT 'usd',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payment methods table
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    label VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('stripe', 'manual')),
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_client_name ON orders(client_name);
CREATE INDEX IF NOT EXISTS idx_orders_governorate ON orders(governorate);
CREATE INDEX IF NOT EXISTS idx_files_order_id ON files(order_id);
CREATE INDEX IF NOT EXISTS idx_files_file_name ON files(file_name);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_config_updated_at BEFORE UPDATE ON payment_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default payment configuration
INSERT INTO payment_config (id, stripe_enabled, amount, currency)
VALUES (uuid_generate_v4(), true, 1000.00, 'usd')
ON CONFLICT DO NOTHING;

-- Insert default payment methods
INSERT INTO payment_methods (id, label, type, enabled)
VALUES 
    (uuid_generate_v4(), 'Cash on Delivery', 'manual', true),
    (uuid_generate_v4(), 'Card (Online)', 'stripe', true)
ON CONFLICT DO NOTHING;
