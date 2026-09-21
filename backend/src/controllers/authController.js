const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db/pool');
const { asyncHandler } = require('../middleware/error');
const { sendPasswordResetEmail } = require('../services/email');

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}
function toPublicUser(row) {
  return { id: row.id, firstName: row.first_name, lastName: row.last_name, email: row.email, plan: row.plan };
}
const register = asyncHandler(async (req,res) => {
  const { firstName,lastName,email,password }=req.body;
  if(!firstName||!lastName||!email||!password)return res.status(400).json({error:'firstName, lastName, email and password are all required.'});
  if(password.length<8)return res.status(400).json({error:'Password must be at least 8 characters.'});
  const existing=await pool.query('SELECT id FROM users WHERE email = $1',[email.toLowerCase()]);
  if(existing.rows.length)return res.status(409).json({error:'An account with that email already exists.'});
  const passwordHash=await bcrypt.hash(password,10);
  const result=await pool.query('INSERT INTO users (first_name,last_name,email,password_hash) VALUES ($1,$2,$3,$4) RETURNING *',[firstName,lastName,email.toLowerCase(),passwordHash]);
  const user=result.rows[0]; res.status(201).json({user:toPublicUser(user),token:signToken(user)});
});
const login=asyncHandler(async(req,res)=>{
  const {email,password}=req.body;
  if(!email||!password)return res.status(400).json({error:'Email and password are required.'});
  const result=await pool.query('SELECT * FROM users WHERE email = $1',[email.toLowerCase()]);
  const user=result.rows[0]; if(!user)return res.status(401).json({error:'Invalid email or password.'});
  if(!(await bcrypt.compare(password,user.password_hash)))return res.status(401).json({error:'Invalid email or password.'});
  res.json({user:toPublicUser(user),token:signToken(user)});
});
const me=asyncHandler(async(req,res)=>{
  const result=await pool.query('SELECT * FROM users WHERE id=$1',[req.user.id]);
  const user=result.rows[0]; if(!user)return res.status(404).json({error:'User not found.'});
  res.json({user:toPublicUser(user)});
});
const forgotPassword=asyncHandler(async(req,res)=>{
  const email=String(req.body.email||'').trim().toLowerCase();
  if(!email)return res.status(400).json({error:'Email is required.'});
  const generic={message:'If an account exists for that email, a password reset link has been sent.'};
  const result=await pool.query('SELECT id,first_name,email FROM users WHERE email=$1',[email]);
  const user=result.rows[0];
  if(!user)return res.json(generic);
  const rawToken=crypto.randomBytes(32).toString('hex');
  const tokenHash=crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt=new Date(Date.now()+60*60*1000);
  await pool.query('DELETE FROM password_reset_tokens WHERE user_id=$1 OR expires_at<=now()',[user.id]);
  await pool.query('INSERT INTO password_reset_tokens (user_id,token_hash,expires_at) VALUES ($1,$2,$3)',[user.id,tokenHash,expiresAt]);
  const frontendUrl=(process.env.FRONTEND_URL||'https://new-seatflow.vercel.app').replace(/\/$/,'');
  const resetUrl=`${frontendUrl}/reset-password.html?token=${rawToken}`;
  try {
    await sendPasswordResetEmail({email:user.email,firstName:user.first_name,resetUrl});
  } catch(error) {
    await pool.query('DELETE FROM password_reset_tokens WHERE token_hash=$1',[tokenHash]);
    throw error;
  }
  res.json(generic);
});
const resetPassword=asyncHandler(async(req,res)=>{
  const token=String(req.body.token||'').trim();
  const password=String(req.body.password||'');
  if(!token||!password)return res.status(400).json({error:'Reset token and new password are required.'});
  if(password.length<8)return res.status(400).json({error:'Password must be at least 8 characters.'});
  const tokenHash=crypto.createHash('sha256').update(token).digest('hex');
  const result=await pool.query('SELECT id,user_id FROM password_reset_tokens WHERE token_hash=$1 AND expires_at>now()',[tokenHash]);
  const resetToken=result.rows[0];
  if(!resetToken)return res.status(400).json({error:'This reset link is invalid or has expired.'});
  const passwordHash = await bcrypt.hash(password, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE users SET password_hash=$1 WHERE id=$2',[passwordHash,resetToken.user_id]);
    await client.query('DELETE FROM password_reset_tokens WHERE user_id=$1',[resetToken.user_id]);
    await client.query('COMMIT');
  } catch(error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  res.json({message:'Your password has been reset. You can now log in.'});
});
module.exports={register,login,me,forgotPassword,resetPassword};
