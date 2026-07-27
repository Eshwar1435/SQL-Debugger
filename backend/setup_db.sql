-- ============================================================
-- SQL AI Agent — Sample Database Setup
-- Run this once in your PostgreSQL database:
--   psql -U postgres -d sql_ai_agent -f setup_db.sql
-- ============================================================

-- ── Tables ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(150) UNIQUE NOT NULL,
    country     VARCHAR(60),
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    category    VARCHAR(80),
    price       NUMERIC(10, 2) NOT NULL,
    stock       INTEGER DEFAULT 0,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id),
    status      VARCHAR(30) DEFAULT 'pending',
    total       NUMERIC(10, 2),
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id          SERIAL PRIMARY KEY,
    order_id    INTEGER REFERENCES orders(id),
    product_id  INTEGER REFERENCES products(id),
    quantity    INTEGER NOT NULL,
    unit_price  NUMERIC(10, 2) NOT NULL
);

-- ── Sample Data ───────────────────────────────────────────────

INSERT INTO users (name, email, country) VALUES
    ('Alice Johnson', 'alice@example.com', 'USA'),
    ('Bob Smith', 'bob@example.com', 'UK'),
    ('Carol White', 'carol@example.com', 'Canada'),
    ('David Brown', 'david@example.com', 'USA'),
    ('Eva Martinez', 'eva@example.com', 'Spain'),
    ('Frank Lee', 'frank@example.com', 'India'),
    ('Grace Kim', 'grace@example.com', 'South Korea'),
    ('Henry Wilson', 'henry@example.com', 'Australia')
ON CONFLICT DO NOTHING;

INSERT INTO products (name, category, price, stock) VALUES
    ('Laptop Pro 15',    'Electronics',  1299.99, 50),
    ('Wireless Mouse',   'Electronics',    29.99, 200),
    ('USB-C Hub',        'Electronics',    49.99, 150),
    ('Standing Desk',    'Furniture',     399.99, 30),
    ('Ergonomic Chair',  'Furniture',     299.99, 25),
    ('Notebook Set',     'Stationery',     12.99, 500),
    ('Monitor 27"',      'Electronics',   349.99, 60),
    ('Mechanical Keyboard', 'Electronics', 89.99, 80)
ON CONFLICT DO NOTHING;

INSERT INTO orders (user_id, status, total, created_at) VALUES
    (1, 'completed', 1329.98, NOW() - INTERVAL '10 days'),
    (1, 'completed',   49.99, NOW() - INTERVAL '5 days'),
    (2, 'pending',    399.99, NOW() - INTERVAL '2 days'),
    (3, 'completed',  349.99, NOW() - INTERVAL '15 days'),
    (4, 'cancelled',   89.99, NOW() - INTERVAL '7 days'),
    (5, 'completed',  299.99, NOW() - INTERVAL '3 days'),
    (6, 'pending',     29.99, NOW() - INTERVAL '1 day'),
    (7, 'completed',  439.98, NOW() - INTERVAL '20 days'),
    (8, 'completed',   62.98, NOW() - INTERVAL '8 days'),
    (2, 'completed',  349.99, NOW() - INTERVAL '30 days');

INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (1, 1, 1, 1299.99),
    (1, 2, 1,   29.99),
    (2, 3, 1,   49.99),
    (3, 4, 1,  399.99),
    (4, 7, 1,  349.99),
    (5, 8, 1,   89.99),
    (6, 5, 1,  299.99),
    (7, 2, 1,   29.99),
    (8, 4, 1,  399.99),
    (8, 6, 3,   12.99),
    (9, 2, 1,   29.99),
    (9, 6, 2,   12.99),
    (10, 7, 1, 349.99);

-- ── Verify ────────────────────────────────────────────────────

SELECT 'users'       AS table_name, COUNT(*) AS rows FROM users
UNION ALL
SELECT 'products',    COUNT(*) FROM products
UNION ALL
SELECT 'orders',      COUNT(*) FROM orders
UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items;