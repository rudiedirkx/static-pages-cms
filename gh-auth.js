"use strict";

class GithubAuth {

	constructor(appId, env, tokenEndpoint, token) {
		this.appId = appId;
		this.env = env;
		this.tokenEndpoint = tokenEndpoint;
		this.token = token || sessionStorage.staticPagesCmsToken || '';

		this.BASE = 'https://api.github.com';
	}

	redirectURL() {
		return location.href.replace(/\?[^#]*/, '');
	}

	start() {
		sessionStorage.staticPagesCmsAuthState = Math.random();
		location.href = `https://github.com/login/oauth/authorize?client_id=${this.appId}&redirect_uri=${encodeURIComponent(this.redirectURL())}&state=${sessionStorage.staticPagesCmsAuthState}&scope=public_repo`;
	}

	fetchToken(code) {
		fetch(`${this.tokenEndpoint}?env=${this.env}&code=${code}`).then(rsp => rsp.json()).then(rsp => {
			this.token = sessionStorage.staticPagesCmsToken = rsp.access_token;
			delete sessionStorage.staticPagesCmsAuthState;
			location.href = this.redirectURL();
		});
	}

	process() {
		if (!this.token) {
			const query = new URLSearchParams(location.search);
			const code = query.get('code');
			if (code) {
				document.body.dataset.state = 'authenticating';
				this.fetchToken(code);
			}
		}
		else {
			document.body.dataset.state = 'authenticated';
			return true;
		}
	}

	getRepos() {
		return this.get('/user/repos?per_page=20&sort=pushed');
	}

	getFile(url) {
		return this.get(url).then(rsp => {
			rsp.raw = this.b64decode(rsp.content);
			return rsp;
		});
	}

	getHead(repo, branch) {
		return this.get(`/repos/${repo}/git/refs/heads/${branch}`);
	}

	async commitFiles(repo, branch, headId, message, files) {
		const commit0 = await this.get(`/repos/${repo}/git/commits/${headId}`);
console.log('0. current commit. ', commit0);

		const uploads = await Promise.all(files.map(async file => {
			const content = await file.getContent();
			return {
				content: this.b64encode(content),
				encoding: 'base64',
			};
		}));
// console.log(uploads);
// return;

		const blobs = await Promise.all(uploads.map(upload => {
			return this.post(`/repos/${repo}/git/blobs`, upload);
		}));
console.log('1. new blobs. ', blobs);

		const tree = await this.post(`/repos/${repo}/git/trees`, {
			base_tree: commit0.tree.sha,
			tree: files.map((file, i) => {
				return {
					path: file.path,
					mode: '100644',
					type: 'blob',
					sha: blobs[i].sha,
				};
			}),
		});
console.log('2. new tree. ', tree);

		const commit = await this.post(`/repos/${repo}/git/commits`, {
			tree: tree.sha,
			parents: [commit0.sha],
			message,
		});
console.log('3. new commit. ', commit);

		const ref = await this.patch(`/repos/${repo}/git/refs/heads/${branch}`, {
			sha: commit.sha,
		});
console.log('4. new ref', ref);

		return commit.sha;
	}

	url(uri) {
		return uri[0] == '/' ? this.BASE + uri : uri;
	}

	get(uri) {
		return fetch(new Request(this.url(uri), {
			headers: {
				"Authorization": `token ${this.token}`,
				"Accept": 'application/vnd.github.v3+json',
			},
		})).then(x => x.json());
	}

	post(uri, body, method) {
		return fetch(new Request(this.url(uri), {
			method: method || 'POST',
			headers: {
				"Authorization": `token ${this.token}`,
				"Content-type": 'application/json',
				"Accept": 'application/vnd.github.v3+json',
			},
			body: JSON.stringify(body),
		})).then(x => x.json());
	}

	patch(uri, body) {
		return this.post(uri, body, 'PATCH');
	}

	b64decode(str) {
		return Base64.decode(str);
	}

	b64encode(raw) {
		return raw instanceof ArrayBuffer ? Base64.fromUint8Array(new Uint8Array(raw)) : Base64.encode(raw);
	}

}
