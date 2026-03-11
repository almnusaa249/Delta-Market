const express = require('express');
const { runQuery, getRow, getAllRows } = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get conversations
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const conversations = await getAllRows(`
      SELECT 
        CASE 
          WHEN m.sender_id = ? THEN m.receiver_id 
          ELSE m.sender_id 
        END as other_user_id,
        u.full_name as other_user_name,
        MAX(m.created_at) as last_message_time,
        (SELECT content FROM messages 
         WHERE (sender_id = ? AND receiver_id = u.id) OR (sender_id = u.id AND receiver_id = ?) 
         ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT COUNT(*) FROM messages WHERE receiver_id = ? AND is_read = 0 AND sender_id = u.id) as unread_count
      FROM messages m
      JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END
      WHERE m.sender_id = ? OR m.receiver_id = ?
      GROUP BY other_user_id, u.full_name
      ORDER BY last_message_time DESC
    `, [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]);

    res.json({
      success: true,
      data: conversations
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Get messages with a specific user
router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const otherUserId = req.params.userId;

    // Mark messages as read
    await runQuery(
      'UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ?',
      [otherUserId, req.user.id]
    );

    const messages = await getAllRows(`
      SELECT m.*, 
        (SELECT full_name FROM users WHERE id = m.sender_id) as sender_name
      FROM messages m
      WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
      ORDER BY m.created_at ASC
    `, [req.user.id, otherUserId, otherUserId, req.user.id]);

    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Send message
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { receiver_id, content } = req.body;

    if (!receiver_id || !content) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال المستلم والرسالة'
      });
    }

    // Check if receiver exists
    const receiver = await getRow(
      'SELECT id FROM users WHERE id = ?',
      [receiver_id]
    );

    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }

    const result = await runQuery(
      'INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)',
      [req.user.id, receiver_id, content]
    );

    res.status(201).json({
      success: true,
      message: 'تم إرسال الرسالة بنجاح',
      data: {
        id: result.lastID,
        sender_id: req.user.id,
        receiver_id,
        content
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// Get unread messages count
router.get('/unread/count', authMiddleware, async (req, res) => {
  try {
    const result = await getRow(
      'SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = 0',
      [req.user.id]
    );

    res.json({
      success: true,
      data: {
        count: result.count
      }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

module.exports = router;
