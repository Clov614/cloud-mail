import app from './hono/webs';
import { email } from './email/email';
import userService from './service/user-service';
import verifyRecordService from './service/verify-record-service';
import emailService from './service/email-service';
import kvObjService from './service/kv-obj-service';
import v1Api from './api/v1-api.js';
import userContext from './security/user-context';
import {
	auth,
	adminAuth,
	apiKeyAuthMiddleware
} from './security/security';
app.use('/api/*', userContext)
app.use('/api/*', apiKeyAuthMiddleware)
app.use('/api/*', auth)

app.use('/v1/*', userContext)
app.use('/v1/*', apiKeyAuthMiddleware)

app.route('/v1', v1Api)

export default {
	 async fetch(req, env, ctx) {

		const url = new URL(req.url)

		if (url.pathname.startsWith('/api/')) {
			url.pathname = url.pathname.replace('/api', '')
			req = new Request(url.toString(), req)
			return app.fetch(req, env, ctx);
		}

		if (url.pathname.startsWith('/v1/')) {
			url.pathname = url.pathname.replace('/v1', '')
			req = new Request(url.toString(), req)
			return app.fetch(req, env, ctx);
		}

		 if (['/static/','/attachments/'].some(p => url.pathname.startsWith(p))) {
			 return await kvObjService.toObjResp( { env }, url.pathname.substring(1));
		 }

		return env.assets.fetch(req);
	},
	email: email,
	async scheduled(c, env, ctx) {
		await verifyRecordService.clearRecord({ env })
		await userService.resetDaySendCount({ env })
		await emailService.completeReceiveAll({ env })
	},
};
