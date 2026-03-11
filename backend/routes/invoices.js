const express = require('express');
const { runQuery, getRow, getAllRows } = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get sales invoices
router.get('/sales', authMiddleware, async (req, res) => {
  try {
    // Get user's store
    const store = await getRow(
      'SELECT id FROM stores WHERE owner_id = ?',
      [req.user.id]
    );

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'لم تقم بإنشاء متجر بعد'
      });
    }

    const invoices = await getAllRows(`
      SELECT si.*, 
        (SELECT COUNT(*) FROM sales_transactions WHERE invoice_id = si.id) as items_count
      FROM sales_invoices si 
      WHERE si.store_id = ? 
      ORDER BY si.created_at DESC
    `, [store.id]);

    res.json({
      success: true,
      data: invoices
    });
  } catch (error) {
    console.error('Get sales invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Get purchase invoices
router.get('/purchases', authMiddleware, async (req, res) => {
  try {
    // Get user's store
    const store = await getRow(
      'SELECT id FROM stores WHERE owner_id = ?',
      [req.user.id]
    );

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'لم تقم بإنشاء متجر بعد'
      });
    }

    const invoices = await getAllRows(`
      SELECT pi.*,
        (SELECT COUNT(*) FROM purchase_transactions WHERE invoice_id = pi.id) as items_count
      FROM purchase_invoices pi 
      WHERE pi.store_id = ? 
      ORDER BY pi.created_at DESC
    `, [store.id]);

    res.json({
      success: true,
      data: invoices
    });
  } catch (error) {
    console.error('Get purchase invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Create sales invoice
router.post('/sales', authMiddleware, async (req, res) => {
  try {
    const { client_name, client_phone, items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إضافة منتجات للفاتورة'
      });
    }

    // Get user's store
    const store = await getRow(
      'SELECT id FROM stores WHERE owner_id = ?',
      [req.user.id]
    );

    if (!store) {
      return res.status(400).json({
        success: false,
        message: 'لم تقم بإنشاء متجر بعد'
      });
    }

    // Calculate total amount
    let totalAmount = 0;
    for (const item of items) {
      totalAmount += item.price * item.quantity;
    }

    // Insert invoice
    const invoiceResult = await runQuery(
      'INSERT INTO sales_invoices (store_id, client_name, client_phone, total_amount) VALUES (?, ?, ?, ?)',
      [store.id, client_name || '', client_phone || '', totalAmount]
    );

    const invoiceId = invoiceResult.lastID;

    // Insert transactions and update stock
    for (const item of items) {
      // Check stock
      const product = await getRow(
        'SELECT stock_quantity FROM products WHERE id = ? AND store_id = ?',
        [item.product_id, store.id]
      );

      if (!product) {
        throw new Error('المنتج غير موجود');
      }

      if (product.stock_quantity < item.quantity) {
        throw new Error('الكمية المتوفرة غير كافية');
      }

      // Insert transaction
      await runQuery(
        'INSERT INTO sales_transactions (invoice_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [invoiceId, item.product_id, item.quantity, item.price]
      );

      // Update stock
      await runQuery(
        'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    res.status(201).json({
      success: true,
      message: 'تم إنشاء فاتورة البيع بنجاح',
      data: {
        id: invoiceId,
        total_amount: totalAmount
      }
    });
  } catch (error) {
    console.error('Create sales invoice error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'خطأ في الخادم'
    });
  }
});

// Create purchase invoice
router.post('/purchases', authMiddleware, async (req, res) => {
  try {
    const { supplier_name, supplier_phone, items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إضافة منتجات للفاتورة'
      });
    }

    // Get user's store
    const store = await getRow(
      'SELECT id FROM stores WHERE owner_id = ?',
      [req.user.id]
    );

    if (!store) {
      return res.status(400).json({
        success: false,
        message: 'لم تقم بإنشاء متجر بعد'
      });
    }

    // Calculate total amount
    let totalAmount = 0;
    for (const item of items) {
      totalAmount += item.price * item.quantity;
    }

    // Insert invoice
    const invoiceResult = await runQuery(
      'INSERT INTO purchase_invoices (store_id, supplier_name, supplier_phone, total_amount) VALUES (?, ?, ?, ?)',
      [store.id, supplier_name || '', supplier_phone || '', totalAmount]
    );

    const invoiceId = invoiceResult.lastID;

    // Insert transactions and update stock
    for (const item of items) {
      // Insert or update product
      let productId = item.product_id;
      
      if (!productId) {
        // Create new product
        const productResult = await runQuery(
          'INSERT INTO products (store_id, product_name, price, stock_quantity, description) VALUES (?, ?, ?, ?, ?)',
          [store.id, item.product_name, item.price, item.quantity, item.description || '']
        );
        productId = productResult.lastID;
      }

      // Insert transaction
      await runQuery(
        'INSERT INTO purchase_transactions (invoice_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [invoiceId, productId, item.quantity, item.price]
      );

      // Update stock
      await runQuery(
        'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
        [item.quantity, productId]
      );
    }

    res.status(201).json({
      success: true,
      message: 'تم إنشاء فاتورة الشراء بنجاح',
      data: {
        id: invoiceId,
        total_amount: totalAmount
      }
    });
  } catch (error) {
    console.error('Create purchase invoice error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'خطأ في الخادم'
    });
  }
});

// Get invoice details
router.get('/sales/:id', authMiddleware, async (req, res) => {
  try {
    // Get user's store
    const store = await getRow(
      'SELECT id FROM stores WHERE owner_id = ?',
      [req.user.id]
    );

    if (!store) {
      return res.status(400).json({
        success: false,
        message: 'لم تقم بإنشاء متجر بعد'
      });
    }

    const invoice = await getRow(
      'SELECT * FROM sales_invoices WHERE id = ? AND store_id = ?',
      [req.params.id, store.id]
    );

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'الفاتورة غير موجودة'
      });
    }

    const transactions = await getAllRows(`
      SELECT st.*, p.product_name
      FROM sales_transactions st
      JOIN products p ON st.product_id = p.id
      WHERE st.invoice_id = ?
    `, [req.params.id]);

    res.json({
      success: true,
      data: {
        ...invoice,
        transactions
      }
    });
  } catch (error) {
    console.error('Get sales invoice details error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

router.get('/purchases/:id', authMiddleware, async (req, res) => {
  try {
    // Get user's store
    const store = await getRow(
      'SELECT id FROM stores WHERE owner_id = ?',
      [req.user.id]
    );

    if (!store) {
      return res.status(400).json({
        success: false,
        message: 'لم تقم بإنشاء متجر بعد'
      });
    }

    const invoice = await getRow(
      'SELECT * FROM purchase_invoices WHERE id = ? AND store_id = ?',
      [req.params.id, store.id]
    );

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'الفاتورة غير موجودة'
      });
    }

    const transactions = await getAllRows(`
      SELECT pt.*, p.product_name
      FROM purchase_transactions pt
      JOIN products p ON pt.product_id = p.id
      WHERE pt.invoice_id = ?
    `, [req.params.id]);

    res.json({
      success: true,
      data: {
        ...invoice,
        transactions
      }
    });
  } catch (error) {
    console.error('Get purchase invoice details error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

module.exports = router;
