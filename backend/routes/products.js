const express = require('express');
const { runQuery, getRow, getAllRows } = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get user's products
router.get('/my-products', authMiddleware, async (req, res) => {
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

    const products = await getAllRows(
      'SELECT * FROM products WHERE store_id = ? ORDER BY created_at DESC',
      [store.id]
    );

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Add product
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { product_name, price, stock_quantity, description, image_url } = req.body;

    if (!product_name || !price) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال اسم المنتج والسعر'
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

    const result = await runQuery(
      'INSERT INTO products (store_id, product_name, price, stock_quantity, description, image_url) VALUES (?, ?, ?, ?, ?, ?)',
      [store.id, product_name, price, stock_quantity || 0, description || '', image_url || '']
    );

    res.status(201).json({
      success: true,
      message: 'تمت إضافة المنتج بنجاح',
      data: {
        id: result.lastID,
        store_id: store.id,
        product_name,
        price,
        stock_quantity: stock_quantity || 0,
        description,
        image_url
      }
    });
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Update product
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { product_name, price, stock_quantity, description, image_url } = req.body;

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

    // Check if product belongs to user's store
    const product = await getRow(
      'SELECT id FROM products WHERE id = ? AND store_id = ?',
      [req.params.id, store.id]
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'المنتج غير موجود'
      });
    }

    await runQuery(
      'UPDATE products SET product_name = ?, price = ?, stock_quantity = ?, description = ?, image_url = ? WHERE id = ?',
      [product_name, price, stock_quantity, description, image_url, req.params.id]
    );

    res.json({
      success: true,
      message: 'تم تحديث المنتج بنجاح'
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Delete product
router.delete('/:id', authMiddleware, async (req, res) => {
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

    // Check if product belongs to user's store
    const product = await getRow(
      'SELECT id FROM products WHERE id = ? AND store_id = ?',
      [req.params.id, store.id]
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'المنتج غير موجود'
      });
    }

    await runQuery('DELETE FROM products WHERE id = ?', [req.params.id]);

    res.json({
      success: true,
      message: 'تم حذف المنتج بنجاح'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Get products from other stores
router.get('/marketplace', authMiddleware, async (req, res) => {
  try {
    // Get user's store
    const store = await getRow(
      'SELECT id FROM stores WHERE owner_id = ?',
      [req.user.id]
    );

    let query = `
      SELECT p.*, s.store_name, s.id as store_id, u.full_name as owner_name
      FROM products p
      JOIN stores s ON p.store_id = s.id
      JOIN users u ON s.owner_id = u.id
    `;
    
    const params = [];
    
    if (store) {
      query += ' WHERE p.store_id != ?';
      params.push(store.id);
    }
    
    query += ' ORDER BY p.created_at DESC';

    const products = await getAllRows(query, params);

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Get marketplace products error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Get products by store
router.get('/store/:storeId', authMiddleware, async (req, res) => {
  try {
    const products = await getAllRows(`
      SELECT p.*, s.store_name
      FROM products p
      JOIN stores s ON p.store_id = s.id
      WHERE p.store_id = ?
      ORDER BY p.created_at DESC
    `, [req.params.storeId]);

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Get store products error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

module.exports = router;
