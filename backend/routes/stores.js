const express = require('express');
const { runQuery, getRow, getAllRows } = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get user's store
router.get('/my-store', authMiddleware, async (req, res) => {
  try {
    const store = await getRow(
      'SELECT * FROM stores WHERE owner_id = ?',
      [req.user.id]
    );

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'لم تقم بإنشاء متجر بعد'
      });
    }

    res.json({
      success: true,
      data: store
    });
  } catch (error) {
    console.error('Get store error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Create store
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { store_name, description } = req.body;

    if (!store_name) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال اسم المتجر'
      });
    }

    // Check if user already has a store
    const existingStore = await getRow(
      'SELECT id FROM stores WHERE owner_id = ?',
      [req.user.id]
    );

    if (existingStore) {
      return res.status(400).json({
        success: false,
        message: 'لديك متجر بالفعل'
      });
    }

    const result = await runQuery(
      'INSERT INTO stores (owner_id, store_name, description) VALUES (?, ?, ?)',
      [req.user.id, store_name, description || '']
    );

    res.status(201).json({
      success: true,
      message: 'تم إنشاء المتجر بنجاح',
      data: {
        id: result.lastID,
        owner_id: req.user.id,
        store_name,
        description
      }
    });
  } catch (error) {
    console.error('Create store error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Update store
router.put('/', authMiddleware, async (req, res) => {
  try {
    const { store_name, description } = req.body;

    const result = await runQuery(
      'UPDATE stores SET store_name = ?, description = ? WHERE owner_id = ?',
      [store_name, description, req.user.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'المتجر غير موجود'
      });
    }

    res.json({
      success: true,
      message: 'تم تحديث المتجر بنجاح'
    });
  } catch (error) {
    console.error('Update store error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Get all stores (for marketplace)
router.get('/all', authMiddleware, async (req, res) => {
  try {
    const stores = await getAllRows(`
      SELECT s.*, u.full_name as owner_name 
      FROM stores s 
      JOIN users u ON s.owner_id = u.id 
      WHERE s.owner_id != ?
      ORDER BY s.created_at DESC
    `, [req.user.id]);

    res.json({
      success: true,
      data: stores
    });
  } catch (error) {
    console.error('Get all stores error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Get store by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const store = await getRow(`
      SELECT s.*, u.full_name as owner_name 
      FROM stores s 
      JOIN users u ON s.owner_id = u.id 
      WHERE s.id = ?
    `, [req.params.id]);

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'المتجر غير موجود'
      });
    }

    res.json({
      success: true,
      data: store
    });
  } catch (error) {
    console.error('Get store error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

module.exports = router;
