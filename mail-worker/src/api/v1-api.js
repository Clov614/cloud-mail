import { Hono } from 'hono';
import result from '../model/result';
import orm from '../entity/orm';
import { eq, and, desc, count } from 'drizzle-orm';
import Account from '../entity/account';
import Email from '../entity/email';
import accountService from '../service/account-service';

const v1Api = new Hono();

// [核心] 强制认证中间件
v1Api.use('*', async (c, next) => {
  const user = c.get('user');
  if (!user) {
    // 如果 `apiKeyAuthMiddleware` 旁路了 (因为没有 Key)，
    // 我们在这里拦截它，并返回一个清晰的 API 错误。
    return c.json(result.fail('X-API-Key header is required or invalid'), 401);
  }
  // 如果 user 存在 (来自 M6)，则继续
  await next();
});

v1Api.post('/emails/generate', async (c) => {
  const user = c.get('user'); // (已由中间件保证存在)
  const { name, domain } = await c.req.json();

  try {
    //
    const newAccount = await accountService.addAccount(c, name, domain, null, null, user.userId);
    return c.json(result.ok({
      id: newAccount.id,
      address: newAccount.email
    }));
  } catch (e) {
    return c.json(result.fail(e.message), 400);
  }
});

v1Api.get('/:emailAddress/messages', async (c) => {
  const user = c.get('user');
  const emailAddress = c.req.param('emailAddress');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '25');
  const offset = (page - 1) * limit;
  const db = orm(c);

  // [安全] 校验邮箱所有权
  const [account] = await db.select().from(Account)
    .where(and(eq(Account.email, emailAddress), eq(Account.userId, user.userId))).limit(1);
  if (!account) {
    return c.json(result.fail('Email address not found or access denied'), 404);
  }

  // [优化] 仅 select 列表所需的字段
  const [totalResult] = await db.select({ count: count() })
    .from(Email).where(eq(Email.address, emailAddress));

  const messages = await db.select({
      id: Email.id,
      from: Email.from,
      subject: Email.subject,
      date: Email.createTime //
    }).from(Email)
    .where(eq(Email.address, emailAddress))
    .orderBy(desc(Email.id))
    .limit(limit)
    .offset(offset);

  const totalItems = totalResult.count;
  const totalPages = Math.ceil(totalItems / limit);
  const pagination = { totalItems, totalPages, currentPage: page, limit };

  return c.json(result.ok({ data: messages, pagination }));
});

v1Api.get('/:emailAddress/messages/:messageId', async (c) => {
  const user = c.get('user');
  const emailAddress = c.req.param('emailAddress');
  const messageId = c.req.param('messageId');
  const db = orm(c);

  // [安全] 校验邮箱所有权
  const [account] = await db.select().from(Account)
    .where(and(eq(Account.email, emailAddress), eq(Account.userId, user.userId))).limit(1);
  if (!account) {
    return c.json(result.fail('Email address not found or access denied'), 404);
  }

  // [优化] `messageId` 在 `Email` 表中是 `id`
  const [message] = await db.select().from(Email)
    .where(and(
      eq(Email.address, emailAddress),
      eq(Email.id, parseInt(messageId)) // (id 是 integer)
    )).limit(1);

  if (!message) {
    return c.json(result.fail('Message not found'), 404);
  }

  // 返回完整邮件对象
  return c.json(result.ok(message));
});

export default v1Api;