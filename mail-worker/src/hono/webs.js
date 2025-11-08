import app from './hono';
import '../security/security';

import '../api/email-api';
import '../api/user-api';
import '../api/login-api';
import '../api/setting-api';
import '../api/account-api';
import '../api/star-api';
import '../api/test-api';
import '../api/r2-api';
import '../api/resend-api';
import '../api/user-api';
import '../api/my-api';
import '../api/role-api'
import '../api/all-email-api'
import '../api/init-api'
import '../api/analysis-api'
import '../api/reg-key-api'
import '../api/public-api'
import '../api/telegram-api'

// 挂载 v1 API
import v1Api from '../api/v1-api.js';
app.route('/v1', v1Api);

export default app;
