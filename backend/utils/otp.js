const { v4: uuidv4 } = require('uuid');
const { runQuery, getRow } = require('../config/database');

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const saveOTP = async (userId, otp) => {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  
  // Delete old OTPs for this user
  await runQuery('DELETE FROM otp_codes WHERE user_id = ?', [userId]);
  
  // Insert new OTP
  await runQuery(
    'INSERT INTO otp_codes (user_id, otp_code, expires_at) VALUES (?, ?, ?)',
    [userId, otp, expiresAt]
  );
  
  return expiresAt;
};

// Verify OTP but don't delete it (for password reset flow)
const verifyOTP = async (userId, otp) => {
  const result = await getRow(
    'SELECT * FROM otp_codes WHERE user_id = ? AND otp_code = ? AND expires_at > datetime("now")',
    [userId, otp]
  );
  
  return result ? true : false;
};

// Verify and delete OTP (for registration verification)
const verifyAndDeleteOTP = async (userId, otp) => {
  const result = await getRow(
    'SELECT * FROM otp_codes WHERE user_id = ? AND otp_code = ? AND expires_at > datetime("now")',
    [userId, otp]
  );
  
  if (result) {
    // Delete used OTP
    await runQuery('DELETE FROM otp_codes WHERE user_id = ?', [userId]);
    return true;
  }
  
  return false;
};

// Verify OTP and generate a reset token (for password reset flow)
const verifyOTPAndGenerateResetToken = async (userId, otp) => {
  const result = await getRow(
    'SELECT * FROM otp_codes WHERE user_id = ? AND otp_code = ? AND expires_at > datetime("now")',
    [userId, otp]
  );
  
  if (result) {
    // Generate a reset token
    const resetToken = uuidv4();
    const tokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes
    
    // Delete old reset tokens for this user and insert new one
    await runQuery('DELETE FROM reset_tokens WHERE user_id = ?', [userId]);
    await runQuery(
      'INSERT INTO reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [userId, resetToken, tokenExpiresAt]
    );
    
    return { success: true, token: resetToken };
  }
  
  return { success: false, token: null };
};

// Verify reset token
const verifyResetToken = async (userId, token) => {
  const result = await getRow(
    'SELECT * FROM reset_tokens WHERE user_id = ? AND token = ? AND expires_at > datetime("now")',
    [userId, token]
  );
  
  return result ? true : false;
};

// Delete reset token after password change
const deleteResetToken = async (userId) => {
  await runQuery('DELETE FROM reset_tokens WHERE user_id = ?', [userId]);
};

const deleteOTP = async (userId) => {
  await runQuery('DELETE FROM otp_codes WHERE user_id = ?', [userId]);
};

const generateResetToken = () => {
  return uuidv4();
};

module.exports = {
  generateOTP,
  saveOTP,
  verifyOTP,
  verifyAndDeleteOTP,
  verifyOTPAndGenerateResetToken,
  verifyResetToken,
  deleteResetToken,
  deleteOTP,
  generateResetToken
};
