/**
 * 邮件发送服务
 * 使用 Resend API 发送邮件
 * 
 * 功能：
 * - 发送密码重置邮件
 * - 发送邮箱验证邮件
 * 
 * 注意：使用延迟初始化，避免缺少 API Key 时导致应用崩溃
 */

import { Resend } from 'resend';

// 延迟初始化 Resend 客户端
let resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

// 发件人地址（使用 Resend 默认域名，或配置自定义域名）
const FROM_EMAIL = process.env.FROM_EMAIL || 'DataReach <onboarding@resend.dev>';

/**
 * 检查邮件服务是否可用
 */
export function isEmailServiceAvailable(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/**
 * 发送密码重置邮件
 * @param email 收件人邮箱
 * @param token 重置令牌
 * @returns 是否发送成功
 */
export async function sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
  const client = getResendClient();
  
  if (!client) {
    console.warn('[Email] 邮件服务未配置 (缺少 RESEND_API_KEY)，跳过发送密码重置邮件');
    return false;
  }
  
  try {
    const resetUrl = `${process.env.VITE_APP_URL || 'https://www.datareach.co'}/reset-password?token=${token}`;
    
    const { data, error } = await client.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'DataReach - 密码重置请求',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">密码重置请求</h2>
          <p>您好，</p>
          <p>我们收到了您的密码重置请求。请点击下方按钮重置您的密码：</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #4F46E5; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              重置密码
            </a>
          </div>
          <p>或者复制以下链接到浏览器：</p>
          <p style="color: #666; word-break: break-all;">${resetUrl}</p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            此链接将在1小时后过期。如果您没有请求重置密码，请忽略此邮件。
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">
            © DataReach Pro - 全球商业数据平台
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('[Email] 发送密码重置邮件失败:', error);
      return false;
    }

    console.log('[Email] 密码重置邮件已发送:', data?.id);
    return true;
  } catch (err) {
    console.error('[Email] 发送邮件异常:', err);
    return false;
  }
}

/**
 * 发送邮箱验证邮件
 * @param email 收件人邮箱
 * @param token 验证令牌
 * @returns 是否发送成功
 */
export async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
  const client = getResendClient();
  
  if (!client) {
    console.warn('[Email] 邮件服务未配置 (缺少 RESEND_API_KEY)，跳过发送验证邮件');
    return false;
  }
  
  try {
    const verifyUrl = `${process.env.VITE_APP_URL || 'https://www.datareach.co'}/verify-email?token=${token}`;
    
    const { data, error } = await client.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'DataReach - 验证您的邮箱',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">验证您的邮箱</h2>
          <p>您好，</p>
          <p>感谢您注册 DataReach Pro！请点击下方按钮验证您的邮箱：</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" 
               style="background-color: #4F46E5; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              验证邮箱
            </a>
          </div>
          <p>或者复制以下链接到浏览器：</p>
          <p style="color: #666; word-break: break-all;">${verifyUrl}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">
            © DataReach Pro - 全球商业数据平台
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('[Email] 发送验证邮件失败:', error);
      return false;
    }

    console.log('[Email] 验证邮件已发送:', data?.id);
    return true;
  } catch (err) {
    console.error('[Email] 发送邮件异常:', err);
    return false;
  }
}
