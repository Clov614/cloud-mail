import { Hono } from 'hono';
import result from '../model/result';
import BizError from '../error/biz-error';
import orm from '../entity/orm';
import { eq, and, desc, count } from 'drizzle-orm';
import { isDel } from '../const/entity-const';
import Account from '../entity/account';
import Email from '../entity/email';
import accountService from '../service/account-service';
import { apiKeyAuthMiddleware } from '../security/security';

const v1Api = new Hono();

// 应用 API Key 认证中间件
v1Api.use('*', apiKeyAuthMiddleware);

// [核心] 强制认证中间件 - 确保用户已通过 API Key 认证
v1Api.use('*', async (c, next) => {
  const user = c.get('user');
  if (!user) {
    // 如果没有 user，说明 API Key 认证失败或未提供
    return c.json(result.fail('X-API-Key header is required or invalid'), 401);
  }
  // 用户已认证，继续处理
  await next();
});

// 获取当前用户的所有邮箱列表
v1Api.get('/emails', async (c) => {
	// 权限检查
	const apiScopes = c.get('api_scopes');
	if (apiScopes && !apiScopes.includes('api:email-list') && !apiScopes.includes('admin')) {
		return c.json(result.fail('权限不足 (Insufficient Scope)'), 403);
	}

	const user = c.get('user');
	const page = parseInt(c.req.query('page') || '1');
	const limit = parseInt(c.req.query('limit') || '25');
	const offset = (page - 1) * limit;
	const db = orm(c);

	// 查询总数
	const [totalResult] = await db.select({ count: count() })
		.from(Account)
		.where(and(eq(Account.userId, user.userId), eq(Account.isDel, isDel.NORMAL)));

	// 查询分页数据
	const accounts = await db.select({
		id: Account.accountId,
		address: Account.email,
		name: Account.name,
		created_at: Account.createTime
	}).from(Account)
		.where(and(eq(Account.userId, user.userId), eq(Account.isDel, isDel.NORMAL)))
		.orderBy(desc(Account.accountId))
		.limit(limit)
		.offset(offset);

	const totalItems = totalResult.count;
	const totalPages = Math.ceil(totalItems / limit);
	const pagination = { totalItems, totalPages, currentPage: page, limit };

	return c.json(result.ok({ data: accounts, pagination }));
});

// 生成临时邮箱地址
v1Api.post('/emails/generate', async (c) => {
  // 权限检查
  const apiScopes = c.get('api_scopes');
  if (apiScopes && !apiScopes.includes('api:email-generate') && !apiScopes.includes('admin')) {
    return c.json(result.fail('权限不足 (Insufficient Scope)'), 403);
  }

  const user = c.get('user'); // (已由中间件保证存在)
  const { name, domain } = await c.req.json();

  try {
  	// 构造 email
  	const email = `${name}@${domain}`;
  	// 构造调用 accountService.add 所需的参数
  	const params = { email, token: null }; // API调用不需要人机验证token
  	const newAccount = await accountService.add(c, params, user.userId);
 
  	return c.json(result.ok({
  		id: newAccount.accountId,
  		address: newAccount.email
  	}));
  } catch (e) {
  	const statusCode = e instanceof BizError ? e.statusCode : 400;
  	return c.json(result.fail(e.message), statusCode);
  }
});

// 获取邮箱的邮件列表
v1Api.get('/messages', async (c) => {
  // 权限检查
  const apiScopes = c.get('api_scopes');
  if (apiScopes && !apiScopes.includes('api:email-list') && !apiScopes.includes('admin')) {
    return c.json(result.fail('权限不足 (Insufficient Scope)'), 403);
  }

  const user = c.get('user');
  const emailAddress = c.req.query('emailAddress');
  if (!emailAddress) {
    return c.json(result.fail('Query parameter "emailAddress" is required'), 400);
  }
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
  	date: Email.createTime
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

// 获取单个邮件详情
v1Api.get('/messages/:messageId', async (c) => {
  // 权限检查
  const apiScopes = c.get('api_scopes');
  if (apiScopes && !apiScopes.includes('api:email-detail') && !apiScopes.includes('admin')) {
    return c.json(result.fail('权限不足 (Insufficient Scope)'), 403);
  }

  const user = c.get('user');
  const emailAddress = c.req.query('emailAddress');
  if (!emailAddress) {
    return c.json(result.fail('Query parameter "emailAddress" is required'), 400);
  }
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
  		eq(Email.id, parseInt(messageId))
  	)).limit(1);

  if (!message) {
    return c.json(result.fail('Message not found'), 404);
  }

  // 返回完整邮件对象
  return c.json(result.ok(message));
});

export default v1Api;