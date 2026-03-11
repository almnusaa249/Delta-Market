const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { runQuery, getRow, getAllRows } = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { generateOTP, saveOTP, verifyOTP, verifyAndDeleteOTP, verifyOTPAndGenerateResetToken, verifyResetToken, deleteResetToken, deleteOTP } = require('../utils/otp');

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { full_name, email, phone, password } = req.body;

    if (!full_name || !password || (!email && !phone)) {
      return res.status(400).json({
        success: false,
        message: 'يرجى填写 جميع البيانات المطلوبة'
      });
    }

    // Check if user exists
    const existingUser = await getRow(
      'SELECT id FROM users WHERE email = ? OR phone = ?',
      [email || null, phone || null]
    );

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'المستخدم موجود بالفعل'
      });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Insert user
    const result = await runQuery(
      'INSERT INTO users (full_name, email, phone, password_hash) VALUES (?, ?, ?, ?)',
      [full_name, email || null, phone || null, password_hash]
    );

    // Generate OTP for verification
    const otp = generateOTP();
    await saveOTP(result.lastID, otp);

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الحساب بنجاح',
      data: {
        user_id: result.lastID,
        otp: otp // In production, send via SMS/Email
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    if (!password || (!email && !phone)) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال البريد الإلكتروني/رقم الهاتف وكلمة المرور'
      });
    }

    // Find user
    const user = await getRow(
      'SELECT * FROM users WHERE email = ? OR phone = ?',
      [email || null, phone || null]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'كلمة المرور غير صحيحة'
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Get user store
    const store = await getRow(
      'SELECT * FROM stores WHERE owner_id = ?',
      [user.id]
    );

    res.json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      data: {
        token,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          role: user.role
        },
        store: store || null
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Verify OTP (for registration)
router.post('/verify-otp', async (req, res) => {
  try {
    const { user_id, otp } = req.body;

    if (!user_id || !otp) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال رمز التحقق'
      });
    }

    const isValid = await verifyAndDeleteOTP(user_id, otp);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'رمز التحقق غير صحيح أو منتهي الصلاحية'
      });
    }

    res.json({
      success: true,
      message: 'تم التحقق بنجاح'
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Verify OTP for password reset and generate reset token
router.post('/verify-reset-otp', async (req, res) => {
  try {
    const { user_id, otp } = req.body;

    if (!user_id || !otp) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال رمز التحقق'
      });
    }

    const result = await verifyOTPAndGenerateResetToken(user_id, otp);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'رمز التحقق غير صحيح أو منتهي الصلاحية'
      });
    }

    res.json({
      success: true,
      message: 'تم التحقق بنجاح',
      data: {
        reset_token: result.token
      }
    });
  } catch (error) {
    console.error('Verify reset OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال البريد الإلكتروني أو رقم الهاتف'
      });
    }

    // Find user
    const user = await getRow(
      'SELECT id FROM users WHERE email = ? OR phone = ?',
      [email || null, phone || null]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    // Generate OTP
    const otp = generateOTP();
    await saveOTP(user.id, otp);

    res.json({
      success: true,
      message: 'تم إرسال رمز التحقق',
      data: {
        user_id: user.id,
        otp: otp // In production, send via SMS/Email
      }
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { user_id, reset_token, new_password } = req.body;

    if (!user_id || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال جميع البيانات المطلوبة'
      });
    }

    // Verify using reset token (new flow)
    let isValid = false;
    if (reset_token) {
      isValid = await verifyResetToken(user_id, reset_token);
    }

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'رمز التحقق غير صحيح أو منتهي الصلاحية'
      });
    }

    // Hash new password
    const password_hash = await bcrypt.hash(new_password, 10);

    // Update password
    await runQuery(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [password_hash, user_id]
    );

    // Delete used reset token and OTP after password change
    await deleteResetToken(user_id);
    await deleteOTP(user_id);

    res.json({
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

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

// Update profile
router.put('/profile', authMiddleware, async (req, res) => {
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

module.exports = router;
