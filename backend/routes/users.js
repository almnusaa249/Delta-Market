const express = require('express');
const { runQuery, getRow, getAllRows } = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // Get user store
    const store = await getRow(
      'SELECT * FROM stores WHERE owner_id = ?',
      [req.user.id]
    );

    res.json({
      success: true,
      data: {
        user: req.user,
        store: store || null
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Update current user profile
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const { full_name, email, phone } = req.body;

    await runQuery(
      'UPDATE users SET full_name = ?, email = ?, phone = ? WHERE id = ?',
      [full_name, email, phone, req.user.id]
    );

    res.json({
      success: true,
      message: 'تم تحديث الملف الشخصي بنجاح'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Get all users (admin only - placeholder)
router.get('/', authMiddleware, async (req, res) => {
  // In a real app, check if user is admin
  try {
    const users = await getAllRows('SELECT id, full_name, email, phone, role, created_at FROM users');
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Get user by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const user = await getRow('SELECT id, full_name, email, phone, role, created_at FROM users WHERE id = ?', [req.params.id]);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Update user (admin only - placeholder)
router.put('/:id', authMiddleware, async (req, res) => {
  // In a real app, check if user is admin
  try {
    const { full_name, email, phone, role } = req.body;
    await runQuery(
      'UPDATE users SET full_name = ?, email = ?, phone = ?, role = ? WHERE id = ?',
      [full_name, email, phone, role, req.params.id]
    );
    res.json({
      success: true,
      message: 'تم تحديث المستخدم بنجاح'
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Delete user (admin only - placeholder)
router.delete('/:id', authMiddleware, async (req, res) => {
  // In a real app, check if user is admin
  try {
    await runQuery('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({
      success: true,
      message: 'تم حذف المستخدم بنجاح'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

module.exports = router;