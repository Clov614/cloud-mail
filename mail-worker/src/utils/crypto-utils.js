const encoder = new TextEncoder();

const saltHashUtils = {

	generateSalt(length = 16) {
		const array = new Uint8Array(length);
		crypto.getRandomValues(array);
		return btoa(String.fromCharCode(...array));
	},


	async hashPassword(password) {
		const salt = this.generateSalt();
		const hash = await this.genHashPassword(password, salt);
		return { salt, hash };
	},

	async genHashPassword(password, salt) {
		const data = encoder.encode(salt + password);
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return btoa(String.fromCharCode(...hashArray));
	},

	async verifyPassword(inputPassword, salt, storedHash) {
		const hash = await this.genHashPassword(inputPassword, salt);
		return hash === storedHash;
	},

	genRandomPwd(length = 8) {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		let result = '';
		for (let i = 0; i < length; i++) {
			result += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return result;
	}
};

export function generateApiKey() {
	const secret = crypto.randomUUID().replaceAll('-', '');
	const fullKey = 'cm_sk_' + secret;
	const prefix = fullKey.substring(0, 8); // 提取 'cm_sk_' + 前2位secret, e.g., "cm_sk_a1"
	return { fullKey, prefix };
}

export async function hashApiKey(key) {
	const data = encoder.encode(key);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return Array.from(hashArray, byte => byte.toString(16).padStart(2, '0')).join('');
}


/**
	* 时序安全的字符串比较函数
	* @param {string} a - a 字符串
	* @param {string} b - b 字符串
	* @returns {boolean} - 如果 a === b, 返回 true
	*/
export function timingSafeEqual(a, b) {
	if (a.length !== b.length) {
		return false;
	}

	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}

	return diff === 0;
}

export default saltHashUtils;
